// Shared by Functions and Angular. IMWEB_PRODUCT_SKU_MAP retains legacy aliases.
export type TemplateId = 'lifeUp' | 'lifeUpScrapbook' | 'lifeupPlanner' | 'lifeupPlannerLite';
export type AutomationId = 'kakao-capture' | 'routine' | 'secondbrain';
export interface TemplateProduct {
    nameEnFull: string; nameEnShort: string; nameKoFull: string; nameKoShort: string;
    slug: string; sku: string; releaseUrl: string; pdfFileName: string; displayPrice: number;
    salesUrls: { normal: string; reward: string; rewardSale: string };
    agents: Record<AutomationId, boolean>;
    kakaoCaptureScope: 'all' | 'reference' | 'task';
    // null keeps LifeUp's legacy/version-based database naming rules.
    notionDbSuffix: string | null;
    welcome: { displayName: string; usageName: string; introductionVideoUrl: string | null; reviewEvent: 'lifeup' | 'standard' | null };
}
export const TEMPLATE_PRODUCTS: Record<TemplateId, TemplateProduct> = {
    lifeUp: {
        nameEnFull: 'LifeUp', nameEnShort: 'LifeUp', nameKoFull: '라이프업', nameKoShort: '라이프업',
        slug: 'lifeup', sku: 'lifeUp', displayPrice: 79000,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-3e3eea79fd8c80b39dc7e4aa9c8982ec?source=copy_link',
        pdfFileName: 'LifeUp1.5.pdf',
        salesUrls: { normal: 'https://notionable.net/shop_view?idx=1', reward: 'https://notionable.net/shop_view?idx=9', rewardSale: 'https://notionable.net/shop_view?idx=10' },
        agents: { 'kakao-capture': true, routine: true, secondbrain: true },
        kakaoCaptureScope: 'all',
        notionDbSuffix: null,
        welcome: { displayName: '라이프업 1.5', usageName: '라이프업', introductionVideoUrl: 'https://www.youtube.com/watch?v=IZEwNYIEGck', reviewEvent: 'lifeup' }
    },
    lifeUpScrapbook: {
        nameEnFull: 'LifeUp Scrapbook', nameEnShort: 'Scrapbook', nameKoFull: '라이프업 스크랩북', nameKoShort: '라이프업 스크랩북',
        slug: 'lifeup-scrapbook', sku: 'lifeUpScrapbook', displayPrice: 0,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-3f3eea79fd8c808fa425e6f222f33bfb?source=copy_link',
        pdfFileName: 'LifeUp1.5-Scrapbook.pdf',
        salesUrls: { normal: 'https://notionable.net/shop_view?idx=6', reward: 'https://notionable.net/shop_view?idx=9', rewardSale: 'https://notionable.net/shop_view?idx=10' },
        agents: { 'kakao-capture': true, routine: false, secondbrain: false },
        kakaoCaptureScope: 'reference',
        notionDbSuffix: 'Scrapbook',
        welcome: { displayName: '라이프업 1.5 스크랩북', usageName: '스크랩북', introductionVideoUrl: null, reviewEvent: null }
    },
    lifeupPlanner: {
        nameEnFull: 'Lifeup GTD Planner', nameEnShort: 'Lifeup GTD Planner', nameKoFull: '라이프업 GTD 플래너', nameKoShort: '라이프업 플래너',
        slug: 'lifeup-planner', sku: 'lifeUpPlanner', displayPrice: 19000,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-GTD-3faeea79fd8c803cbcd7ec17d7c989a9?source=copy_link',
        pdfFileName: 'LifeUp1.5-Planner.pdf',
        salesUrls: { normal: 'https://notionable.net/shop_view?idx=8', reward: 'https://notionable.net/shop_view?idx=12', rewardSale: 'https://notionable.net/shop_view?idx=11' },
        agents: { 'kakao-capture': true, routine: true, secondbrain: false },
        kakaoCaptureScope: 'task',
        notionDbSuffix: 'Planner',
        welcome: { displayName: '라이프업 1.5 GTD 플래너', usageName: 'GTD 플래너', introductionVideoUrl: 'https://www.youtube.com/watch?v=0LgzGdr8luU', reviewEvent: 'standard' }
    },
    lifeupPlannerLite: {
        nameEnFull: 'Lifeup GTD Planner Lite', nameEnShort: 'LifeUp Planner Lite',
        nameKoFull: '라이프업 GTD 플래너 Lite', nameKoShort: '라이프업 플래너 Lite',
        slug: 'lifeup-planner-lite', sku: 'lifeUpPlannerLite', displayPrice: 0,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-GTD-LITE-3fceea79fd8c80378e40f927e0306fbc?source=copy_link',
        pdfFileName: 'LifeUp1.5-Planner-Lite.pdf',
        salesUrls: { normal: 'https://notionable.net/shop_view?idx=13', reward: 'https://notionable.net/shop_view?idx=9', rewardSale: 'https://notionable.net/shop_view?idx=10' },
        agents: { 'kakao-capture': true, routine: false, secondbrain: false },
        kakaoCaptureScope: 'task',
        notionDbSuffix: 'PlannerLite',
        welcome: { displayName: '라이프업 1.5 GTD 플래너 Lite', usageName: 'GTD 플래너 Lite', introductionVideoUrl: 'https://www.youtube.com/watch?v=0LgzGdr8luU', reviewEvent: null }
    }
};
// Product presentation order. Keep this explicit so UI lists and batch flows do
// not change when the catalog object is rearranged.
export const TEMPLATE_IDS: TemplateId[] = ['lifeUp', 'lifeupPlanner', 'lifeupPlannerLite', 'lifeUpScrapbook'];
export function isTemplateId(value: unknown): value is TemplateId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATE_PRODUCTS, value);
}
// Only missing IDs on legacy LifeUp records default to LifeUp. Unknown IDs must
// never gain LifeUp permissions or accidentally bind to its workspace.
export function templateIdOrLegacy(value: unknown): TemplateId {
    if (value === undefined || value === null || value === '') return 'lifeUp';
    if (!isTemplateId(value)) throw new Error('INVALID_TEMPLATE_ID');
    return value;
}
export function canUseAgent(templateId: unknown, agentId: string): boolean {
    return isTemplateId(templateId) && TEMPLATE_PRODUCTS[templateId].agents[agentId as AutomationId] === true;
}
export function templateDownloadPath(templateId: unknown): string {
    return isTemplateId(templateId) ? `/download/${TEMPLATE_PRODUCTS[templateId].slug}` : '';
}
