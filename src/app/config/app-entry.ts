import { TemplateId, TEMPLATE_IDS, templateSlugs } from './template-catalog';

export function entryTemplate(value: string | null): TemplateId | undefined {
    if (!value) return undefined;
    const aliases: Record<string, TemplateId> = Object.fromEntries(TEMPLATE_IDS.flatMap(id =>
        [id.toLowerCase(), ...templateSlugs(id)].map(alias => [alias, id])));
    aliases['plannerlite'] = 'lifeupPlannerLite'; // Historical public alias.
    return aliases[value.toLowerCase()];
}

export function appEntryUrl(templateId: TemplateId, menu?: string): string {
    return `https://notionable.net/app?${menu ? `menu=${encodeURIComponent(menu)}&` : ''}templateId=${templateId}`;
}

export function safeAppReturn(value: string | null): string {
    return value && /^\/(workspace|mypage)(\/|\?|$)/.test(value) && !/[\\\r\n]/.test(value)
        ? value : '/workspace/home';
}
