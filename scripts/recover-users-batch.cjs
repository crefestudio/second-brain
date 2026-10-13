const auth = require('C:/Users/leemoongi/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');
const base = 'projects/notionable-secondbrain/databases/';
const source = base + 'users-recovery-20261012/documents';
const target = base + '(default)/documents';
let token;
async function api(path, body) {
  for (let n = 0; n < 8; n++) {
    try {
      const r = await fetch('https://firestore.googleapis.com/v1/' + path, {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return data;
    } catch (e) { if (n === 7) throw e; await new Promise(r => setTimeout(r, 1500)); }
  }
}
async function inventory(root) {
  const all = [];
  let last;
  for (;;) {
    const q = { from: [{ allDescendants: true }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: '__name__' }, op: 'GREATER_THAN_OR_EQUAL', value: { referenceValue: root + '/users/__id-9223372036854775808__' } } },
        { fieldFilter: { field: { fieldPath: '__name__' }, op: 'LESS_THAN', value: { referenceValue: root + '/users\u0000/__id-9223372036854775808__' } } }
      ] } }, orderBy: [{ field: { fieldPath: '__name__' } }], limit: 500 };
    if (last) q.startAt = { values: [{ referenceValue: last }], before: false };
    const rows = await api(root + ':runQuery', { structuredQuery: q });
    const docs = rows.filter(x => x.document).map(x => x.document);
    for (const d of docs) {
      if (!d.name.startsWith(root + '/users/')) throw new Error('OUT_OF_SCOPE');
      all.push(d);
    }
    console.log(JSON.stringify({ inventory: root.includes('recovery') ? 'clone' : 'live', documents: all.length }));
    if (docs.length < 500) return all;
    last = docs[docs.length - 1].name;
  }
}
(async () => {
  const a = auth.getGlobalDefaultAccount();
  token = (await auth.getAccessToken(a.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])).access_token;
  const original = await inventory(source);
  const live = await inventory(target);
  const existing = new Set(live.map(d => d.name));
  const missing = original.filter(d => !existing.has(d.name.replace(source + '/', target + '/')));
  console.log(JSON.stringify({ source: original.length, live: live.length, missing: missing.length }));
  let restored = 0;
  for (let i = 0; i < missing.length; i += 100) {
    const writes = missing.slice(i, i + 100).map(d => ({ update: { name: d.name.replace(source + '/', target + '/'), fields: d.fields || {} }, currentDocument: { exists: false } }));
    await api(target + ':commit', { writes });
    restored += writes.length;
    console.log(JSON.stringify({ restored, total: missing.length }));
  }
  const final = await inventory(target);
  const names = new Set(final.map(d => d.name));
  const remaining = original.filter(d => !names.has(d.name.replace(source + '/', target + '/'))).length;
  console.log(JSON.stringify({ COMPLETE: remaining === 0, sourceDocuments: original.length, targetDocuments: final.length, remaining }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
