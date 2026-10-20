// Shared by Functions and Angular. IMWEB_PRODUCT_SKU_MAP retains legacy aliases.
export type TemplateId = keyof typeof TEMPLATE_PRODUCTS;
export type AutomationId = 'kakao-capture' | 'routine' | 'secondbrain';
export interface TemplateProduct {
    order: number;
    admin: { purchaseKey: string; customerGrade: string; welcomeTemplateId: string };
    nameEnFull: string; nameEnShort: string; nameKoFull: string; nameKoShort: string;
    slug: string; sku: string; releaseUrl: string; pdfFileName: string; displayPrice: number;
    imwebProductNo?: number;
    // Public links always pass through the app so product inflows are recorded.
    salesUrls: { normal: string; reward: string; rewardSale: string };
    // Actual checkout destinations used only after the tracking redirect.
    checkoutUrls: { normal: string; reward: string; rewardSale: string };
    agents: Record<AutomationId, boolean>;
    kakaoCaptureScope: 'all' | 'reference' | 'task' | 'note';
    // null keeps LifeUp's legacy/version-based database naming rules.
    notionDbSuffix: string | null;
    databaseNames: string[] | null;
    upgradeKind: 'single' | 'pack';
    welcome: { displayName: string; usageName: string; introductionVideoUrl: string | null; reviewEvent: 'lifeup-review' | 'review' | null };
}
export const TEMPLATE_PRODUCTS = {
    lifeUpSecondBrainOSLite: {
        order: 5, upgradeKind: 'single', admin: { purchaseKey: 'secondBrainLite', customerGrade: 'secondBrainLite', welcomeTemplateId: 'secondbrain-lite-purchaser-welcome' },
        nameEnFull: 'LifeUp Second Brain OS Lite', nameEnShort: 'LifeUp Second Brain OS Lite',
        nameKoFull: '라이프업 세컨드브레인 OS Lite', nameKoShort: '라이프업 세컨드브레인 OS Lite',
        slug: 'lifeup-secondbrain-lite', sku: 'lifeUpSecondBrainOSLite', displayPrice: 0,
        imwebProductNo: 15,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-Second-Brain-OS-LITE-3ffeea79fd8c80b3b3ecdbc7f2ca7392?source=copy_link',
        pdfFileName: 'LifeUp1.5-SecondBrainOSLite.pdf',
        salesUrls: { normal: 'https://app.notionable.net/store/lifeup-secondbrain-lite', reward: 'https://app.notionable.net/store/lifeup-reward', rewardSale: 'https://app.notionable.net/store/lifeup-reward-sale' },
        checkoutUrls: { normal: 'https://notionable.net/store/?idx=15', reward: 'https://notionable.net/store/?idx=9', rewardSale: 'https://notionable.net/store/?idx=10' },
        agents: { 'kakao-capture': true, routine: false, secondbrain: false },
        kakaoCaptureScope: 'note', notionDbSuffix: 'secondbrainLite', databaseNames: ['lifeup info', 'apps', 'note'],
        welcome: { displayName: '라이프업 세컨드브레인 OS Lite', usageName: '라이프업 세컨드브레인 OS Lite', introductionVideoUrl: 'https://youtu.be/yUlK0I64p3w', reviewEvent: null }
    },
    lifeUpSecondBrainOS: {
        order: 2, upgradeKind: 'pack', admin: { purchaseKey: 'secondBrain', customerGrade: 'secondBrain', welcomeTemplateId: 'secondbrain-purchaser-welcome' },
        nameEnFull: 'LifeUp Second Brain OS', nameEnShort: 'LifeUp Second Brain OS',
        nameKoFull: '라이프업 세컨드브레인 OS', nameKoShort: '라이프업 세컨드브레인 OS',
        slug: 'lifeup-secondbrain', sku: 'lifeUpSecondBrainOS', displayPrice: 19000,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-Second-Brain-OS-3feeea79fd8c801a8a9fcad10b71a229?source=copy_link',
        pdfFileName: 'LifeUp1.5-SecondBrainOS.pdf',
        salesUrls: { normal: 'https://app.notionable.net/store/lifeup-secondbrain-os', reward: 'https://app.notionable.net/store/lifeup-reward-pack', rewardSale: 'https://app.notionable.net/store/lifeup-reward-pack-sale' },
        checkoutUrls: { normal: 'https://notionable.net/store/?idx=14', reward: 'https://notionable.net/store/?idx=11', rewardSale: 'https://notionable.net/store/?idx=12' },
        agents: { 'kakao-capture': true, routine: false, secondbrain: true },
        kakaoCaptureScope: 'note', notionDbSuffix: 'secondbrain', databaseNames: ['lifeup info', 'apps', 'note'],
        welcome: { displayName: '라이프업 1.5 세컨드브레인 OS', usageName: '세컨드브레인 OS', introductionVideoUrl: 'https://youtu.be/yUlK0I64p3w', reviewEvent: 'review' }
    },
    lifeUp: {
        order: 0, upgradeKind: 'single', admin: { purchaseKey: 'standard', customerGrade: 'standard', welcomeTemplateId: 'standard-purchaser-welcome' },
        nameEnFull: 'LifeUp', nameEnShort: 'LifeUp', nameKoFull: '라이프업', nameKoShort: '라이프업',
        slug: 'lifeup', sku: 'lifeUp', displayPrice: 79000,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-3e3eea79fd8c80b39dc7e4aa9c8982ec?source=copy_link',
        pdfFileName: 'LifeUp1.5.pdf',
        salesUrls: { normal: 'https://app.notionable.net/store/lifeup', reward: 'https://app.notionable.net/store/lifeup-reward', rewardSale: 'https://app.notionable.net/store/lifeup-reward-sale' },
        checkoutUrls: { normal: 'https://notionable.net/store/?idx=1', reward: 'https://notionable.net/store/?idx=9', rewardSale: 'https://notionable.net/store/?idx=10' },
        agents: { 'kakao-capture': true, routine: true, secondbrain: true },
        kakaoCaptureScope: 'all',
        notionDbSuffix: null, databaseNames: null,
        welcome: { displayName: '라이프업 1.5', usageName: '라이프업', introductionVideoUrl: 'https://www.youtube.com/watch?v=IZEwNYIEGck', reviewEvent: 'lifeup-review' }
    },
    lifeUpScrapbook: {
        order: 4, upgradeKind: 'single', admin: { purchaseKey: 'scrapbook', customerGrade: 'scrapbook', welcomeTemplateId: 'scrapbook-purchaser-welcome' },
        nameEnFull: 'LifeUp Scrapbook', nameEnShort: 'Scrapbook', nameKoFull: '라이프업 스크랩북', nameKoShort: '라이프업 스크랩북',
        slug: 'lifeup-scrapbook', sku: 'lifeUpScrapbook', displayPrice: 0,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-3f3eea79fd8c808fa425e6f222f33bfb?source=copy_link',
        pdfFileName: 'LifeUp1.5-Scrapbook.pdf',
        salesUrls: { normal: 'https://app.notionable.net/store/lifeup-scrapbook', reward: 'https://app.notionable.net/store/lifeup-reward', rewardSale: 'https://app.notionable.net/store/lifeup-reward-sale' },
        checkoutUrls: { normal: 'https://notionable.net/store/?idx=6', reward: 'https://notionable.net/store/?idx=9', rewardSale: 'https://notionable.net/store/?idx=10' },
        agents: { 'kakao-capture': true, routine: false, secondbrain: false },
        kakaoCaptureScope: 'reference',
        notionDbSuffix: 'Scrapbook', databaseNames: ['lifeup info', 'apps', 'reference', 'reference tag', 'reference sub tag', 'reference type'],
        welcome: { displayName: '라이프업 1.5 스크랩북', usageName: '스크랩북', introductionVideoUrl: null, reviewEvent: null }
    },
    lifeupPlanner: {
        order: 1, upgradeKind: 'pack', admin: { purchaseKey: 'planner', customerGrade: 'planner', welcomeTemplateId: 'planner-purchaser-welcome' },
        nameEnFull: 'Lifeup GTD Planner', nameEnShort: 'Lifeup GTD Planner', nameKoFull: '라이프업 GTD 플래너', nameKoShort: '라이프업 플래너',
        slug: 'lifeup-planner', sku: 'lifeUpPlanner', displayPrice: 19000,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-GTD-3faeea79fd8c803cbcd7ec17d7c989a9?source=copy_link',
        pdfFileName: 'LifeUp1.5-Planner.pdf',
        salesUrls: { normal: 'https://app.notionable.net/store/lifeup-planner', reward: 'https://app.notionable.net/store/lifeup-reward-pack', rewardSale: 'https://app.notionable.net/store/lifeup-reward-pack-sale' },
        checkoutUrls: { normal: 'https://notionable.net/store/?idx=8', reward: 'https://notionable.net/store/?idx=11', rewardSale: 'https://notionable.net/store/?idx=12' },
        agents: { 'kakao-capture': true, routine: true, secondbrain: false },
        kakaoCaptureScope: 'task',
        notionDbSuffix: 'Planner', databaseNames: ['lifeup info', 'apps', 'task', 'habit', 'habit log'],
        welcome: { displayName: '라이프업 1.5 GTD 플래너', usageName: 'GTD 플래너', introductionVideoUrl: 'https://www.youtube.com/watch?v=0LgzGdr8luU', reviewEvent: 'review' }
    },
    lifeupPlannerLite: {
        order: 3, upgradeKind: 'single', admin: { purchaseKey: 'plannerLite', customerGrade: 'planner', welcomeTemplateId: 'planner-lite-purchaser-welcome' },
        nameEnFull: 'Lifeup GTD Planner Lite', nameEnShort: 'LifeUp Planner Lite',
        nameKoFull: '라이프업 GTD 플래너 Lite', nameKoShort: '라이프업 플래너 Lite',
        slug: 'lifeup-planner-lite', sku: 'lifeUpPlannerLite', displayPrice: 0,
        releaseUrl: 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-GTD-LITE-3fceea79fd8c80378e40f927e0306fbc?source=copy_link',
        pdfFileName: 'LifeUp1.5-Planner-Lite.pdf',
        salesUrls: { normal: 'https://app.notionable.net/store/lifeup-planner-lite', reward: 'https://app.notionable.net/store/lifeup-reward', rewardSale: 'https://app.notionable.net/store/lifeup-reward-sale' },
        checkoutUrls: { normal: 'https://notionable.net/store/?idx=13', reward: 'https://notionable.net/store/?idx=9', rewardSale: 'https://notionable.net/store/?idx=10' },
        agents: { 'kakao-capture': true, routine: false, secondbrain: false },
        kakaoCaptureScope: 'task',
        notionDbSuffix: 'PlannerLite', databaseNames: ['lifeup info', 'apps', 'task'],
        welcome: { displayName: '라이프업 1.5 GTD 플래너 Lite', usageName: 'GTD 플래너 Lite', introductionVideoUrl: 'https://www.youtube.com/watch?v=0LgzGdr8luU', reviewEvent: null }
    }
} satisfies Record<string, TemplateProduct>;
// Derive membership from the catalog; order lives with each product.
export const TEMPLATE_IDS = (Object.keys(TEMPLATE_PRODUCTS) as TemplateId[])
    .sort((a, b) => TEMPLATE_PRODUCTS[a].order - TEMPLATE_PRODUCTS[b].order);
export const PRODUCT_OPTIONS = TEMPLATE_IDS.map(templateId => ({
    id: TEMPLATE_PRODUCTS[templateId].admin.purchaseKey, templateId,
    name: TEMPLATE_PRODUCTS[templateId].nameKoShort
}));
export const PURCHASE_OPTIONS = [...PRODUCT_OPTIONS,
    { id: 'premium', templateId: 'lifeUp' as TemplateId, name: '라이프업 프리미엄' },
    { id: 'upgrade', templateId: 'lifeUp' as TemplateId, name: '라이프업 프리미엄 승격' }];
export const CUSTOMER_GRADES = [...new Set(TEMPLATE_IDS.map(id => TEMPLATE_PRODUCTS[id].admin.customerGrade)), 'premium'];
export function customerGradeLabel(grade: unknown): string {
    if (grade === 'premium') return '라이프업 프리미엄';
    const id = TEMPLATE_IDS.find(id => TEMPLATE_PRODUCTS[id].admin.customerGrade === grade);
    return id ? TEMPLATE_PRODUCTS[id].nameKoShort : '';
}
export const WELCOME_MAIL_OPTIONS = TEMPLATE_IDS.map(id => ({
    id: TEMPLATE_PRODUCTS[id].admin.welcomeTemplateId, name: TEMPLATE_PRODUCTS[id].nameKoShort + ' - 구매 안내'
}));
export const MAIL_OPTIONS = [...WELCOME_MAIL_OPTIONS,
    { id: 'standard-purchaser-update', name: '라이프업 - 일반 - 업데이트' },
    { id: 'premium-purchaser-update', name: '라이프업 - 프리미엄 - 업데이트' },
    { id: 'premium-purchaser-welcome', name: '라이프업 프리미엄 - 구매 안내' }];
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

export function templateSlugs(id: TemplateId): string[] {
    return [...new Set([TEMPLATE_PRODUCTS[id].slug, new URL(TEMPLATE_PRODUCTS[id].salesUrls.normal).pathname.split('/').pop()!])];
}
export const TEMPLATE_STORE_DESTINATIONS: Record<string, string> = Object.fromEntries(TEMPLATE_IDS.flatMap(id =>
    templateSlugs(id).map(slug => ['store/' + slug, TEMPLATE_PRODUCTS[id].checkoutUrls.normal])));
