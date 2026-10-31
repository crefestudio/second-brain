/* eslint-disable @typescript-eslint/no-explicit-any */
const skuFields = ['sku', 'product_sku', 'productSku', 'option_sku', 'optionSku', 'prod_sku_no', 'prodSkuNo', 'prod_custom_code', 'prodCustomCode'];
export interface ImwebPurchasedItem { sku: string; paymentAmount: number; item: any }

// https://old-developers.imweb.me/orders/prodorders: item payment fields are
// distinct from the order payment. Never attach an entire basket to each SKU.
export function imwebPurchasedItems(value: unknown, knownSkus: ReadonlySet<string>, orderAmount: number): ImwebPurchasedItem[] {
    const items: any[] = [];
    const visit = (node: any): void => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object') return;
        if (skuFields.some(key => typeof node[key] === 'string' && node[key].trim())) items.push(node);
        else for (const key of ['list', 'items', 'prod_orders', 'prodOrders', 'data']) visit(node[key]);
    };
    visit(value);
    const groups = new Map<string, ImwebPurchasedItem>();
    for (const item of items) {
        const sku = skuFields.map(key => item[key]).find(value => typeof value === 'string' && knownSkus.has(value.trim()))?.trim();
        if (!sku) continue;
        let amount: number;
        if (items.length === 1) {
            amount = orderAmount;
        } else {
            const payments = Array.isArray(item.payment) ? item.payment : [item.payment];
            amount = payments.reduce((sum: number, payment: any) => {
                if (!payment || payment.price === undefined || payment.price === null || payment.price === '') throw new Error('IMWEB_ITEM_PAYMENT_UNAVAILABLE');
                const price = Number(payment.price);
                // Use the supplied item price directly. Subtracting discount
                // metadata again makes valid zero-price baskets negative.
                if (!Number.isFinite(price) || price < 0) throw new Error('IMWEB_ITEM_PAYMENT_UNAVAILABLE');
                return sum + price;
            }, 0);
        }
        if (!Number.isFinite(amount) || amount < 0) throw new Error('IMWEB_ITEM_PAYMENT_UNAVAILABLE');
        const previous = groups.get(sku);
        if (previous) previous.paymentAmount += amount;
        else groups.set(sku, { sku, paymentAmount: amount, item });
    }
    if ([...groups.values()].reduce((sum, item) => sum + item.paymentAmount, 0) > orderAmount) throw new Error('IMWEB_ITEM_PAYMENT_MISMATCH');
    return [...groups.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}
