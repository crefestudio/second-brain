// Uses the existing Firebase CLI login without printing credentials.
// Read-only by default; --grant explicitly adds self-signing permission only.
const path = require('node:path');
const cliRoot = process.argv[2];
if (!cliRoot) throw Error('Pass the installed firebase-tools directory');
const cliAuth = require(path.join(cliRoot, 'lib/auth'));
const { requireAuth } = require(path.join(cliRoot, 'lib/requireAuth'));
const { Client } = require(path.join(cliRoot, 'lib/apiv2'));
const project = 'notionable-secondbrain';

(async () => {
    const account = cliAuth.getGlobalDefaultAccount();
    if (!account) throw Error('Firebase CLI login is required');
    await requireAuth({ project, ...account });
    const functions = new Client({ urlPrefix: 'https://cloudfunctions.googleapis.com', apiVersion: 'v2' });
    const fn = (await functions.get(`/projects/${project}/locations/us-central1/functions/verifyPurchaseLoginCode`,
        { skipLog: { resBody: true } })).body;
    const email = fn.serviceConfig.serviceAccountEmail;
    const resource = `/projects/${project}/serviceAccounts/${email}`;
    const iam = new Client({ urlPrefix: 'https://iam.googleapis.com', apiVersion: 'v1' });
    let policy = (await iam.post(`${resource}:getIamPolicy`, { options: { requestedPolicyVersion: 3 } },
        { skipLog: { resBody: true } })).body;
    const member = `serviceAccount:${email}`;
    const role = 'roles/iam.serviceAccountTokenCreator';
    const hasBinding = () => (policy.bindings || []).some(b => b.role === role && !b.condition && b.members.includes(member));
    if (!hasBinding() && process.argv.includes('--grant')) {
        policy.bindings ||= [];
        const binding = policy.bindings.find(b => b.role === role && !b.condition);
        if (binding) binding.members.push(member);
        else policy.bindings.push({ role, members: [member] });
        await iam.post(`${resource}:setIamPolicy`, { policy }, { skipLog: { resBody: true } });
        policy = (await iam.post(`${resource}:getIamPolicy`, {}, { skipLog: { resBody: true } })).body;
    }
    const usage = new Client({ urlPrefix: 'https://serviceusage.googleapis.com', apiVersion: 'v1' });
    const servicePath = `/projects/${project}/services/iamcredentials.googleapis.com`;
    let state = (await usage.get(servicePath)).body.state;
    if (state !== 'ENABLED' && process.argv.includes('--grant')) {
        await usage.post(servicePath + ':enable', {});
        state = (await usage.get(servicePath)).body.state;
    }
    console.log(JSON.stringify({ functionState: fn.state, runtimeServiceAccount: email,
        selfSigningPermission: hasBinding(), iamCredentialsApi: state }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
