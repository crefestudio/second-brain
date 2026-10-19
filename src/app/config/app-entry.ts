import { TemplateId } from './template-catalog';

export function entryTemplate(value: string | null): TemplateId | undefined {
    if (!value) return undefined;
    const aliases: Record<string, TemplateId> = {
        lifeupsecondbrainos: 'lifeUpSecondBrainOS', 'lifeup-secondbrain': 'lifeUpSecondBrainOS', 'lifeup-secondbrain-os': 'lifeUpSecondBrainOS',
        lifeup: 'lifeUp', lifeupscrapbook: 'lifeUpScrapbook', 'lifeup-scrapbook': 'lifeUpScrapbook',
        lifeupplanner: 'lifeupPlanner', 'lifeup-planner': 'lifeupPlanner',
        lifeupplannerlite: 'lifeupPlannerLite', plannerlite: 'lifeupPlannerLite', 'lifeup-planner-lite': 'lifeupPlannerLite'
    };
    return aliases[value.toLowerCase()];
}

export function appEntryUrl(templateId: TemplateId, menu?: string): string {
    return `https://notionable.net/app?${menu ? `menu=${encodeURIComponent(menu)}&` : ''}templateId=${templateId}`;
}

export function safeAppReturn(value: string | null): string {
    return value && /^\/(workspace|mypage)(\/|\?|$)/.test(value) && !/[\\\r\n]/.test(value)
        ? value : '/workspace/home';
}
