// Uses the existing Firebase CLI login; never stores credentials.
// Google Cloud log-match policies require no scheduled application worker.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const firebaseRoot = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools')
    : path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'firebase-tools');
const auth = require(path.join(firebaseRoot, 'lib/auth'));
const project = 'notionable-secondbrain';
const recipient = 'toto791@gmail.com';
const groupMatch = pattern => ['service_name', 'function_name', 'job_id']
    .map(field => `resource.labels.${field}=~"(?i)${pattern}"`).join(' OR ');
const purchase = `(${groupMatch('purchase|verificationemail|verifycode|latpeed|imweb|payment')})`;
const kakao = `(${groupMatch('kakao')})`;
const errors = '(severity>=ERROR OR httpRequest.status>=500)';
const resources = '(resource.type="cloud_run_revision" OR resource.type="cloud_function" OR resource.type="cloud_scheduler_job")';
const groups = [
    { id: 'purchase', title: '구매·결제 동기화 오류', filter: `${resources} AND ${purchase} AND ${errors}`,
        help: '구매 동기화의 마지막 성공 시각과 누락 주문을 확인하세요. 복구 후 과거 주문이 등록되면 구매 안내 메일이 일괄 발송될 수 있으므로 대기 주문·메일 수를 먼저 확인하세요.' },
    { id: 'kakao', title: '카카오톡 처리 오류', filter: `${resources} AND ${kakao} AND (${errors} OR textPayload:"[KAKAO CALLBACK] rejected" OR textPayload:"[KAKAO FIFO] callback unavailable")`,
        help: '카카오 응답 실패, 작업 큐, 노션 저장 결과를 확인하세요. 사용자 입력과 토큰 등 개인정보를 공유하지 마세요.' },
    { id: 'functions', title: 'Firebase 함수·스케줄 오류', filter: `(${resources} AND NOT ${purchase} AND NOT ${kakao} AND ${errors}) OR (resource.type="global" AND log_id("notionable-alert-test") AND severity=ERROR)`,
        help: '오류 로그의 함수명·HTTP 상태·실행 시각을 확인하세요. ALERT_TEST 표시는 운영 장애가 아닌 알림 전달 시험입니다.' }
];

(async () => {
    const account = auth.getGlobalDefaultAccount();
    if (!account) throw new Error('Firebase CLI login required');
    const token = (await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])).access_token;
    async function api(base, endpoint, method = 'GET', body) {
        const response = await fetch(`${base}/${endpoint}`, { method,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}) });
        const data = await response.json();
        if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(data.error)}`);
        return data;
    }
    const monitoring = 'https://monitoring.googleapis.com/v3';
    const root = `projects/${project}`;
    // Validate every filter against existing logs before creating resources.
    for (const group of groups) {
        const data = await api('https://logging.googleapis.com/v2', 'entries:list', 'POST', {
            resourceNames: [root], filter: `${group.filter} AND timestamp>="2026-10-31T00:00:00Z"`, pageSize: 1
        });
        console.log(JSON.stringify({ filter: group.id, valid: true, historicalMatch: !!data.entries?.length }));
    }
    const channels = await api(monitoring, `${root}/notificationChannels`);
    let channel = (channels.notificationChannels || []).find(c => c.type === 'email' && c.labels?.email_address === recipient && c.enabled !== false);
    if (!channel) channel = await api(monitoring, `${root}/notificationChannels`, 'POST', {
        type: 'email', displayName: 'NotionAble 운영 오류 알림', labels: { email_address: recipient }, enabled: true
    });
    const existing = await api(monitoring, `${root}/alertPolicies`);
    for (const group of groups) {
        const policy = {
            displayName: `[NotionAble 운영] ${group.title}`,
            documentation: { mimeType: 'text/markdown', content: `${group.help}\n\n첫 오류 발견 후 동일 그룹의 추가 알림은 최소 1시간 간격으로 제한합니다. 오류 수와 메일 수는 다릅니다. 로그 기반 알림의 자동 종료는 복구 확인을 의미하지 않습니다.\n\n[운영 로그 보기](https://console.cloud.google.com/logs/query?project=${project})` },
            conditions: [{ displayName: group.title, conditionMatchedLog: { filter: group.filter } }],
            combiner: 'OR', enabled: true, severity: 'ERROR',
            alertStrategy: { notificationRateLimit: { period: '3600s' }, autoClose: '3600s' },
            notificationChannels: [channel.name], userLabels: { managed_by: 'notionable-ops', alert_group: group.id }
        };
        const old = (existing.alertPolicies || []).find(p => p.userLabels?.managed_by === 'notionable-ops' && p.userLabels?.alert_group === group.id);
        const saved = old ? await api(monitoring, `${old.name}?updateMask=displayName,documentation,conditions,combiner,enabled,severity,alertStrategy,notificationChannels,userLabels`, 'PATCH', { ...policy, name: old.name })
            : await api(monitoring, `${root}/alertPolicies`, 'POST', policy);
        console.log(JSON.stringify({ policy: saved.name, group: group.id, enabled: saved.enabled, rate: saved.alertStrategy?.notificationRateLimit, channel: channel.name }));
    }
    if (process.argv.includes('--test')) {
        await api('https://logging.googleapis.com/v2', 'entries:write', 'POST', {
            logName: `${root}/logs/notionable-alert-test`, resource: { type: 'global', labels: { project_id: project } },
            entries: [{ severity: 'ERROR', insertId: `ops-alert-test-${Date.now()}`, jsonPayload: {
                message: 'ALERT_TEST: 운영 오류 알림 전달 시험입니다. 실제 장애가 아닙니다.', synthetic: true
            } }]
        });
        console.log('One clearly marked test log submitted; inbox delivery is not independently verified.');
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
