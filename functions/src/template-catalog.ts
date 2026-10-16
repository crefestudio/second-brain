// Shared by Functions and Angular. IMWEB_PRODUCT_SKU_MAP retains legacy aliases.
export type TemplateId = 'lifeUp' | 'lifeUpScrapbook' | 'lifeupPlanner';
export type AutomationId = 'kakao-capture' | 'routine' | 'secondbrain';
export interface TemplateProduct {
    nameEnFull: string; nameEnShort: string; nameKoFull: string; nameKoShort: string;
    slug: string; sku: string; releaseUrl: string; pdfFileName: string; displayPrice: number;
    salesUrls: { normal: string; reward: string; rewardSale: string };
    agents: Record<AutomationId, boolean>;
}
export const TEMPLATE_PRODUCTS: Record<TemplateId, TemplateProduct> = {
    lifeUp: {
        nameEnFull: 'LifeUp', nameEnShort: 'LifeUp', nameKoFull: '라이프업', nameKoShort: '라이프업',
        slug: 'lifeup', sku: 'lifeUp', displayPrice: 79000,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-3e3eea79fd8c80b39dc7e4aa9c8982ec?source=copy_link',
        pdfFileName: 'LifeUp1.5.pdf',
        salesUrls: { normal: 'https://notionable.net/shop_view?idx=1', reward: 'https://notionable.net/shop_view?idx=9', rewardSale: 'https://notionable.net/shop_view?idx=10' },
        agents: { 'kakao-capture': true, routine: true, secondbrain: true }
    },
    lifeUpScrapbook: {
        nameEnFull: 'LifeUp Scrapbook', nameEnShort: 'LifeUp 스크랩북', nameKoFull: '라이프업 스크랩북', nameKoShort: '라이프업 스크랩북',
        slug: 'lifeup-scrapbook', sku: 'lifeUpScrapbook', displayPrice: 0,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-3f3eea79fd8c808fa425e6f222f33bfb?source=copy_link',
        pdfFileName: 'LifeUp1.5-Scrapbook.pdf',
        salesUrls: { normal: 'https://notionable.net/shop_view?idx=6', reward: 'https://notionable.net/shop_view?idx=9', rewardSale: 'https://notionable.net/shop_view?idx=10' },
        agents: { 'kakao-capture': true, routine: false, secondbrain: false }
    },
    lifeupPlanner: {
        nameEnFull: 'Lifeup GTD플래너', nameEnShort: 'LifeUp 플래너', nameKoFull: '라이프업 GTD 플래너', nameKoShort: '라이프업 플래너',
        slug: 'lifeup-planner', sku: 'lifeUpPlanner', displayPrice: 19000,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-GTD-3faeea79fd8c803cbcd7ec17d7c989a9?source=copy_link',
        pdfFileName: 'LifeUp1.5-Planner.pdf',
        salesUrls: { normal: 'https://notionable.net/shop_view?idx=8', reward: 'https://notionable.net/shop_view?idx=12', rewardSale: 'https://notionable.net/shop_view?idx=11' },
        agents: { 'kakao-capture': true, routine: true, secondbrain: false }
    }
};
// Product presentation order. Keep this explicit so UI lists and batch flows do
// not change when the catalog object is rearranged.
export const TEMPLATE_IDS: TemplateId[] = ['lifeUp', 'lifeupPlanner', 'lifeUpScrapbook'];
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
