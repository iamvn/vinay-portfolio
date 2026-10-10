import { prisma } from '@/lib/prisma';
import { importDesign } from './ai-template';
import { createCustomTemplate, listAllCustomTemplates, replaceCustomTemplateDesign } from './custom-templates';
import { OWNER_TEMPLATES } from './owner-templates';

/**
 * Adds the owner's templates (lib/design/owner-templates.ts) to the MAIN site's "Your templates" once each, and keeps
 * that copy on the template's latest version. A flag per template remembers it was added (and which copy), so
 * deleting it doesn't bring it back. Pages already made from a template don't change. Call on the main site only.
 */
type Flag = { addedAt: string; id?: string; version?: number };

export async function seedOwnerTemplates() {
  for (const template of OWNER_TEMPLATES) {
    const key = `design.ownerTemplate.${template.key}`;
    const source = `owner:${template.key}`;
    const row = await prisma.setting.findUnique({ where: { key } });
    let flag: Flag | null = null;
    if (row) { try { flag = JSON.parse(row.value) as Flag; } catch { flag = { addedAt: '' }; } }
    if (flag && (flag.version ?? 1) >= template.version) continue;

    const result = importDesign(template.data, 'home');
    if (result.problem !== undefined) { console.error(`Owner template ${template.key}: ${result.problem}`); continue; }
    if (result.fixes.length) console.warn(`Owner template ${template.key} needed fixes:`, result.fixes);

    if (!flag) {
      // Flag first: two admin tabs opening at once must not add it twice.
      const created = await prisma.setting.create({ data: { key, value: JSON.stringify({ addedAt: new Date().toISOString(), version: template.version }) } }).catch(() => null);
      if (!created) continue;
      const meta = await createCustomTemplate({ name: template.name, description: template.description, kind: 'home', data: result.data, blocks: result.blocks, by: 'Platform', source, version: template.version })
        .catch((error) => { console.error(`Owner template ${template.key}:`, error); return null; });
      if (meta) await prisma.setting.update({ where: { key }, data: { value: JSON.stringify({ addedAt: new Date().toISOString(), id: meta.id, version: template.version }) } });
      continue;
    }

    // An older version was added: update that copy if it's still there (found by id, or for copies added before ids
    // were remembered, by being the platform's template of that name).
    const list = await listAllCustomTemplates();
    const copy = list.find((t) => t.id === flag.id) ?? list.find((t) => t.source === source) ?? list.find((t) => t.createdBy === 'Platform' && t.name === template.name);
    if (copy) await replaceCustomTemplateDesign(copy.id, { data: result.data, blocks: result.blocks, description: template.description, source, version: template.version });
    await prisma.setting.update({ where: { key }, data: { value: JSON.stringify({ ...flag, ...(copy ? { id: copy.id } : {}), version: template.version }) } });
  }
}
