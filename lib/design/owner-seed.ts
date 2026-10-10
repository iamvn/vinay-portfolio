import { prisma } from '@/lib/prisma';
import { importDesign } from './ai-template';
import { createCustomTemplate } from './custom-templates';
import { OWNER_TEMPLATES } from './owner-templates';

/**
 * Adds the owner's templates (lib/design/owner-templates.ts) to the MAIN site's "Your templates" once each.
 * A flag per template remembers it was added, so deleting it doesn't bring it back. Call on the main site only.
 */
export async function seedOwnerTemplates() {
  for (const template of OWNER_TEMPLATES) {
    const flag = `design.ownerTemplate.${template.key}`;
    if (await prisma.setting.findUnique({ where: { key: flag } })) continue;
    // Flag first: two admin tabs opening at once must not add it twice.
    await prisma.setting.create({ data: { key: flag, value: JSON.stringify({ addedAt: new Date().toISOString() }) } }).catch(() => null);
    const result = importDesign(template.data, 'home');
    if (result.problem !== undefined) { console.error(`Owner template ${template.key}: ${result.problem}`); continue; }
    if (result.fixes.length) console.warn(`Owner template ${template.key} needed fixes:`, result.fixes);
    await createCustomTemplate({ name: template.name, description: template.description, kind: 'home', data: result.data, blocks: result.blocks, by: 'Platform' })
      .catch((error) => console.error(`Owner template ${template.key}:`, error));
  }
}
