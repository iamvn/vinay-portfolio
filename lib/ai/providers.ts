/**
 * Adapters for the AI services "Ask my resume" can use.
 *  - anthropic          → POST {baseUrl}/v1/messages           (Anthropic Messages API)
 *  - openai             → POST {baseUrl}/chat/completions      (OpenAI; uses max_completion_tokens)
 *  - openai-compatible  → POST {baseUrl}/chat/completions      (Gemini, Groq, OpenRouter, Mistral, DeepSeek, Ollama…)
 */
export const PROVIDER_KINDS = ['anthropic', 'openai', 'openai-compatible'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

/** Starting points for the admin form. Model names change often, so check the provider's model list. */
export const PROVIDER_PRESETS: { id: string; label: string; kind: ProviderKind; baseUrl: string; model: string; docs: string }[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-4-5-20251001', docs: 'https://docs.claude.com/en/docs/about-claude/models/overview' },
  { id: 'openai', label: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: '', docs: 'https://platform.openai.com/docs/models' },
  { id: 'gemini', label: 'Google Gemini', kind: 'openai-compatible', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '', docs: 'https://ai.google.dev/gemini-api/docs/models' },
  { id: 'groq', label: 'Groq', kind: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', model: '', docs: 'https://console.groq.com/docs/models' },
  { id: 'openrouter', label: 'OpenRouter', kind: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', model: '', docs: 'https://openrouter.ai/models' },
  { id: 'mistral', label: 'Mistral', kind: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1', model: '', docs: 'https://docs.mistral.ai/getting-started/models/' },
  { id: 'deepseek', label: 'DeepSeek', kind: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1', model: '', docs: 'https://api-docs.deepseek.com/' },
  { id: 'custom', label: 'Other (OpenAI-compatible)', kind: 'openai-compatible', baseUrl: '', model: '', docs: '' },
];

export type ProviderConfig = {
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature?: number;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export class ProviderError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

const trimSlash = (url: string) => url.trim().replace(/\/+$/, '');

async function readError(response: Response) {
  const text = await response.text().catch(() => '');
  try {
    const data = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    const message = typeof data.error === 'string' ? data.error : data.error?.message ?? data.message;
    if (message) return message.slice(0, 300);
  } catch { /* not JSON */ }
  return (text || response.statusText).slice(0, 300);
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new ProviderError(timedOut ? 'The provider did not answer in time.' : `Could not reach ${new URL(url).host}.`);
  }
  if (!response.ok) throw new ProviderError(`${response.status}: ${await readError(response)}`, response.status);
  return response.json() as Promise<Record<string, unknown>>;
}

/**
 * Sends one conversation to one provider and returns the answer text.
 * `system` has the fixed rules and the (large, cacheable) portfolio text separately.
 */
export async function callProvider(
  config: ProviderConfig,
  input: { rules: string; context: string; messages: ChatMessage[]; maxTokens: number; timeoutMs?: number },
): Promise<string> {
  const timeoutMs = input.timeoutMs ?? 25_000;
  if (!config.apiKey) throw new ProviderError('No API key set.');
  if (!config.model) throw new ProviderError('No model set.');

  if (config.kind === 'anthropic') {
    // Accept either "https://api.anthropic.com" or ".../v1".
    const base = trimSlash(config.baseUrl || 'https://api.anthropic.com').replace(/\/v1$/, '');
    const data = await post(`${base}/v1/messages`, { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }, {
      model: config.model,
      max_tokens: input.maxTokens,
      ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
      system: [
        { type: 'text', text: input.rules },
        // Same for every visitor: cacheable, so repeat questions can cost less.
        { type: 'text', text: input.context, cache_control: { type: 'ephemeral' } },
      ],
      messages: input.messages,
    }, timeoutMs);
    const parts = (data.content as { type: string; text?: string }[] | undefined) ?? [];
    const text = parts.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('').trim();
    if (!text) throw new ProviderError(data.stop_reason === 'max_tokens' ? 'The answer was cut off. Raise "Max answer length".' : 'Empty answer.');
    return text;
  }

  // OpenAI and OpenAI-compatible APIs
  const base = trimSlash(config.baseUrl);
  if (!base) throw new ProviderError('No base URL set.');
  const limitField = config.kind === 'openai' ? 'max_completion_tokens' : 'max_tokens';
  const data = await post(`${base}/chat/completions`, { authorization: `Bearer ${config.apiKey}` }, {
    model: config.model,
    [limitField]: input.maxTokens,
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    messages: [{ role: 'system', content: `${input.rules}\n\n${input.context}` }, ...input.messages],
  }, timeoutMs);
  const choice = (data.choices as { message?: { content?: unknown }; finish_reason?: string }[] | undefined)?.[0];
  const content = choice?.message?.content;
  const text = (typeof content === 'string'
    ? content
    : Array.isArray(content) ? content.map((part: { text?: string }) => part?.text ?? '').join('') : ''
  ).trim();
  if (!text) throw new ProviderError(choice?.finish_reason === 'length' ? 'The answer was cut off. Raise "Max answer length" (reasoning models need more).' : 'Empty answer.');
  return text;
}
