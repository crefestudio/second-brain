/* eslint-disable */
export interface CustomerRow {
    id: string; name?: string; phone?: string; phoneDisplay?: string; emails?: string[];
    purchasedAt?: string; memberType?: string | null; membership?: string; notificationConsent?: string;
}
export function customerListOptions(body: Record<string, unknown>) {
    const choice = (key: string, values: string[], fallback: string) => {
        const value = String(body[key] || fallback);
        if (!values.includes(value)) throw new Error('INVALID_CUSTOMER_QUERY');
        return value;
    };
    return {
        search: String(body.search || '').trim().toLowerCase().slice(0, 200),
        memberFilter: choice('memberFilter', ['all', 'standard', 'premium', 'scrapbook', 'none'], 'all'),
        membershipFilter: choice('membershipFilter', ['all', 'standard', 'premium', 'scrapbook', 'none'], 'all'),
        notifyFilter: choice('notifyFilter', ['all', 'yes', 'no', 'blocked'], 'all'),
        sort: choice('sort', ['purchasedAt', 'name', 'phone'], 'purchasedAt'),
        direction: choice('direction', ['asc', 'desc'], 'desc')
    };
}
type Options = ReturnType<typeof customerListOptions>;
function sortValue(row: CustomerRow, options: Options): string | number {
    if (options.sort !== 'purchasedAt') return String(options.sort === 'name' ? row.name || '' : row.phone || row.phoneDisplay || '').toLowerCase();
    const match = String(row.purchasedAt || '').match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    return match ? Date.UTC(Number(match[1]) < 100 ? 2000 + Number(match[1]) : Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0)) : 0;
}
// Keep only one result page in memory while scanning bounded source batches.
export class CustomerListPage<T extends CustomerRow> {
    totalCount = 0;
    filteredCount = 0;
    private rows: T[] = [];
    private after?: { id: string; value: string | number };
    constructor(private options: Options, cursor?: string) {
        if (cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
                if (decoded.query !== JSON.stringify(options) || typeof decoded.id !== 'string' ||
                    typeof decoded.value !== (options.sort === 'purchasedAt' ? 'number' : 'string')) throw Error();
                this.after = decoded;
            } catch { throw new Error('INVALID_CUSTOMER_CURSOR'); }
        }
    }
    private compare(a: {id: string; value: string | number}, b: {id: string; value: string | number}) {
        const delta = typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : String(a.value).localeCompare(String(b.value), 'ko');
        return (this.options.direction === 'desc' ? -delta : delta) || a.id.localeCompare(b.id);
    }
    add(row: T) {
        this.totalCount++;
        const o = this.options;
        if (o.search && ![row.name, row.phone, row.phoneDisplay, ...(row.emails || [])].join(' ').toLowerCase().includes(o.search)) return;
        if (o.memberFilter !== 'all' && (row.memberType || 'none') !== o.memberFilter) return;
        if (o.membershipFilter !== 'all' && row.membership !== o.membershipFilter) return;
        if (o.notifyFilter !== 'all' && !(o.notifyFilter === 'yes' ? row.notificationConsent === '예' : o.notifyFilter === 'blocked' ? row.notificationConsent === '차단' : ['아니오', '미응답'].includes(row.notificationConsent || '미응답'))) return;
        this.filteredCount++;
        if (this.after && this.compare({id: row.id, value: sortValue(row, o)}, this.after) <= 0) return;
        this.rows.push(row);
        this.rows.sort((a, b) => this.compare({id: a.id, value: sortValue(a, o)}, {id: b.id, value: sortValue(b, o)}));
        if (this.rows.length > 101) this.rows.pop();
    }
    result() {
        const customers = this.rows.slice(0, 100);
        const last = customers[customers.length - 1];
        return { customers, totalCount: this.totalCount, filteredCount: this.filteredCount,
            nextCursor: this.rows.length > 100 ? Buffer.from(JSON.stringify({query: JSON.stringify(this.options), id: last.id, value: sortValue(last, this.options)})).toString('base64url') : null };
    }
}
