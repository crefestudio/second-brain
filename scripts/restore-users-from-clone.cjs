const auth = require('C:/Users/leemoongi/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth');

const project = 'notionable-secondbrain';
const sourceDb = 'users-recovery-20261012';
const targetDb = '(default)';
let token;
let copied = 0;

async function api(url, options = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(`https://firestore.googleapis.com/v1/${url}`, {
        ...options, signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    clearTimeout(timeout);
    if (response.ok) return response.json();
    const detail = await response.text();
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 5) throw new Error(`${response.status}: ${detail}`);
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}

async function copyDocument(document) {
  const suffix = document.name.split(`/databases/${sourceDb}/documents/`)[1];
  const targetName = `projects/${project}/databases/${targetDb}/documents/${suffix}`;
  await api(`projects/${project}/databases/${targetDb}/documents:commit`, {
    method: 'POST', body: JSON.stringify({ writes: [{ update: { name: targetName, fields: document.fields || {} } }] })
  });
  copied++;
  let pageToken;
  do {
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    const listed = await api(`${document.name}:listCollectionIds${query}`, { method: 'POST', body: '{}' });
    for (const collectionId of listed.collectionIds || []) await copyCollection(`${document.name}/${collectionId}`);
    pageToken = listed.nextPageToken;
  } while (pageToken);
}

async function copyCollection(path) {
  let pageToken;
  do {
    const query = new URLSearchParams({ pageSize: '300' });
    if (pageToken) query.set('pageToken', pageToken);
    const listed = await api(`${path}?${query}`);
    for (const document of listed.documents || []) await copyDocument(document);
    pageToken = listed.nextPageToken;
  } while (pageToken);
}

(async () => {
  const account = auth.getGlobalDefaultAccount();
  const credentials = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  token = credentials.access_token;
  await copyCollection(`projects/${project}/databases/${sourceDb}/documents/users`);
  console.log(JSON.stringify({ copied }));
})().catch(error => { console.error(error.message); process.exit(1); });
