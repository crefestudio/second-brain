/* eslint-disable */
function rows(value: any): any[] {
    if (Array.isArray(value)) return value.flatMap(rows);
    if (!value || typeof value !== 'object') return [];
    return [value, ...['list', 'items', 'prod_orders', 'prodOrders', 'data'].flatMap(key => rows(value[key]))];
}

export function imwebPurchaseOption(value: unknown, sku: string): string {
    // Match the item itself, not a parent order containing another item's SKU.
    const item = rows(value).find(row => [row.sku, row.product_sku, row.productSku,
        row.option_sku, row.optionSku, row.prod_sku_no, row.prodSkuNo,
        row.prod_custom_code, row.prodCustomCode].some(code => typeof code === 'string' && code.trim() === sku));
    if (!item) return '';
    const values = (options: any): string[] => {
        if (Array.isArray(options)) return options.flatMap(values);
        if (!options || typeof options !== 'object') return [];
        const selected = options.value_name_list;
        return Array.isArray(selected) ? selected.filter((v: any) => typeof v === 'string').map((v: string) => v.trim()).filter(Boolean) : [];
    };
    const selected = values(item.options);
    if (selected.length) return [...new Set(selected)].join(' / ');
    const option = item.option_name ?? item.optionName ?? item.option_title ?? item.optionTitle ?? item.option_value ?? item.optionValue;
    const legacy = Array.isArray(option)
        ? option.map(v => typeof v === 'string' ? v : v?.name || v?.label || v?.value || '').filter(Boolean).join(' / ')
        : typeof option === 'string' || typeof option === 'number' ? String(option) : String(option?.name || option?.label || option?.value || '');
    return legacy.trim() || String(item.prod_name || item.product_name || item.productName || item.name || '').trim();
}
