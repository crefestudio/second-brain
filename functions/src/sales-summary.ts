import { TEMPLATE_PRODUCTS, isTemplateId } from './template-catalog';
export function storeVisitDayWindows(now = Date.now()): Array<{ start: number; end: number }> {
    const day = 86400000, offset = 9 * 3600000;
    const today = Math.floor((now + offset) / day) * day - offset;
    return [0, 1, 2].map(age => ({ start: today - age * day, end: age === 0 ? now + 1 : today - (age - 1) * day }));
}

export function summarizeProductSales(purchases: Array<Record<string, unknown>>, monthKey: string, excludedEmails: ReadonlySet<string> = new Set()): Record<string, { count: number; revenue: number; freeCount?: number }> {
    const result: Record<string, { count: number; revenue: number; freeCount?: number }> = {};
    for (const purchase of purchases) {
        const email = String(purchase.email || '').trim().toLowerCase();
        if (email && excludedEmails.has(email)) continue;
        const date = String(purchase.purchasedAt || '').match(/^(\d{4}|\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]/);
        if (!date) continue;
        const year = date[1].length === 2 ? `20${date[1]}` : date[1];
        if (`${year}-${date[2].padStart(2, '0')}` !== monthKey) continue;
        const rawAmount = purchase.paymentAmount ?? purchase.amount;
        const amount = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount ?? '').replace(/[,\s원₩]/g, ''));
        if (!Number.isFinite(amount) || amount < 0) continue;
        const option = String(purchase.purchaseOption || '').replace(/\s+/g, '');
        const comparableOption = option.replace(/[-_·]/g, '');
        const isImwebLifeup = purchase.source === 'imweb' && purchase.templateId === 'lifeUp';
        if (!isTemplateId(purchase.templateId) && !isImwebLifeup && !option.includes('라이프업')) continue;
        // The three Imweb LifeUp listings intentionally share the canonical
        // SKU (`lifeup`).  A product title may be absent when Imweb returns a
        // selected option, so both the short option labels and full names are
        // accepted for sales reporting.
        const lifeupListing: Record<string, string> = { '1': 'lifeup-imweb', '9': 'lifeup-reward', '10': 'lifeup-reward-sale', '12': 'lifeup-reward-pack', '11': 'lifeup-reward-pack-sale' };
        const product = purchase.templateId === 'lifeupPlanner' || purchase.templateId === 'lifeupPlannerLite' || purchase.templateId === 'lifeUpScrapbook'
            ? TEMPLATE_PRODUCTS[purchase.templateId].slug
            : purchase.source === 'imweb' && lifeupListing[String(purchase.productNo)] ? lifeupListing[String(purchase.productNo)]
            : comparableOption.includes('묶음') && comparableOption.includes('타임세일') ? 'lifeup-reward-pack-sale'
            : comparableOption.includes('묶음') ? 'lifeup-reward-pack'
            : comparableOption.includes('보상타임세일') ? 'lifeup-reward-sale'
            : comparableOption.includes('보상') ? 'lifeup-reward'
                : purchase.source === 'imweb' ? 'lifeup-imweb' : 'lifeup';
        const current = result[product] || { count: 0, revenue: 0 };
        if (amount === 0 || purchase.purchaseKind === 'free') {
            current.freeCount = (current.freeCount || 0) + 1;
            result[product] = current;
            continue;
        }
        if (amount < 1000) continue;
        current.count++;
        current.revenue += amount;
        result[product] = current;
    }
    return result;
}
