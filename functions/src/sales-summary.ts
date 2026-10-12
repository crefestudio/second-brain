export function storeVisitDayWindows(now = Date.now()): Array<{ start: number; end: number }> {
    const day = 86400000, offset = 9 * 3600000;
    const today = Math.floor((now + offset) / day) * day - offset;
    return [0, 1, 2].map(age => ({ start: today - age * day, end: age === 0 ? now + 1 : today - (age - 1) * day }));
}

export function summarizeProductSales(purchases: Array<Record<string, unknown>>, monthKey: string): Record<string, { count: number; revenue: number }> {
    const result: Record<string, { count: number; revenue: number }> = {};
    for (const purchase of purchases) {
        const date = String(purchase.purchasedAt || '').match(/^(\d{4}|\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]/);
        if (!date) continue;
        const year = date[1].length === 2 ? `20${date[1]}` : date[1];
        if (`${year}-${date[2].padStart(2, '0')}` !== monthKey) continue;
        const rawAmount = purchase.paymentAmount ?? purchase.amount;
        const amount = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount ?? '').replace(/[,\s원₩]/g, ''));
        if (!Number.isFinite(amount) || amount < 1000) continue;
        const option = String(purchase.purchaseOption || '').replace(/\s+/g, '');
        if (!option.includes('라이프업')) continue;
        const product = option.includes('라이프업보상타임세일') ? 'lifeup-reward-sale'
            : option.includes('라이프업보상') ? 'lifeup-reward'
                : purchase.source === 'imweb' ? 'lifeup-imweb' : 'lifeup';
        const current = result[product] || { count: 0, revenue: 0 };
        current.count++;
        current.revenue += amount;
        result[product] = current;
    }
    return result;
}
