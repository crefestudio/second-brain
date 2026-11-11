const assert = require('node:assert/strict');
function memoryDb(seed) {
    const rows = new Map(Object.entries(structuredClone(seed))), writes = [];
    const field = (data, key) => String(key).split('.').reduce((v, k) => v?.[k], data);
    const snapshot = path => ({id: path.split('/').at(-1), ref: ref(path), exists: rows.has(path),
        data: () => structuredClone(rows.get(path)), get: key => field(rows.get(path), key)});
    function write(path, data, merge) {
        const previous = rows.get(path) || {};
        rows.set(path, structuredClone(merge ? {...previous, ...data} : data));
        writes.push(path);
    }
    function ref(path) { return {path, id: path.split('/').at(-1), get: async () => snapshot(path),
        collection: name => query(path + '/' + name),
        set: async (data, options) => write(path, data, (options?.merge || !!options?.mergeFields)),
        update: async data => write(path, data, true)}; }
    function query(path, filters = [], orders = [], point = [], size = Infinity) {
        return {doc: id => ref(path + '/' + id),
            where: (key, op, value) => { assert.ok(['==','>'].includes(op)); return query(path, [...filters, [key, value, op]], orders, point, size); },
            orderBy: (key, direction = 'asc') => query(path, filters, [...orders, [typeof key === 'string' ? key : '__name__', direction]], point, size),
            startAfter: (...values) => query(path, filters, orders, values, size),
            select: () => query(path, filters, orders, point, size),
            limit: n => query(path, filters, orders, point, n),
            get: async () => {
                const value = (d, key) => key === '__name__' ? d.id : d.get(key);
                const compare = (a, b) => { for (const [key, direction] of orders) { const x = value(a, key), y = value(b, key); if (x !== y) return (x < y ? -1 : 1) * (direction === 'desc' ? -1 : 1); } return 0; };
                let docs = [...rows.keys()].filter(p => p.startsWith(path + '/') && p.split('/').length === path.split('/').length + 1).map(snapshot)
                    .filter(d => filters.every(([k, v, op]) => op === '>' ? d.get(k) > v : d.get(k) === v)).sort(compare);
                if (point.length) { const cursor = {id: point[orders.findIndex(([k]) => k === '__name__')], get: key => point[orders.findIndex(([k]) => k === key)]}; docs = docs.filter(d => compare(d, cursor) > 0); }
                docs = docs.slice(0, size); return {docs, size: docs.length, empty: !docs.length};
            }};
    }
    const db = {collection: query, getAll: async (...refs) => refs.filter(r => r.path).map(r => snapshot(r.path)),
        runTransaction: async callback => {
            const pending = []; let writing = false;
            const read = r => { assert.equal(writing, false, 'transaction reads must precede writes'); return snapshot(r.path); };
            const tx = {get: async r => read(r), getAll: async (...refs) => refs.map(read),
                delete: r => { writing = true; pending.push(() => rows.delete(r.path)); },
                set: (r, data, options) => { writing = true; pending.push(() => write(r.path, data, options?.merge || !!options?.mergeFields)); },
                update: (r, data) => { writing = true; pending.push(() => write(r.path, data, true)); },
                create: (r, data) => { assert.equal(rows.has(r.path), false); writing = true; pending.push(() => write(r.path, data, false)); }};
            const result = await callback(tx); pending.forEach(fn => fn()); return result;
        }};
    return {db, rows, writes};
}

module.exports = {memoryDb};
