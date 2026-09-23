const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

// Exercise the actual handler without initializing Firebase or sending mail.
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const handlerSource = source.slice(source.indexOf('export const latpeedPaymentWebhook ='),
    source.indexOf('const purchaseLogin ='));
function setup(validSignature = true, duplicate = false, purchaseOption = 'test option') {
    const logs = [];
    let databaseCalls = 0;
    const context = {
        exports: {}, Buffer, crypto, LATPEED_WEBHOOK_SECRET: {},
        onRequest: (_, handler) => handler,
        logger: { info: (message, data) => logs.push({ message, ...data }) },
        isValidLatpeedWebhook: () => validSignature,
        latpeedAmount: value => Number(value) || 0,
        latpeedPurchaseOption: () => purchaseOption,
        formatLatpeedDate: () => '', lifeupMemberType: () => 'standard', isLifeupUpgrade: () => false,
        db: {
            collection: () => { databaseCalls++; return { doc: () => ({}) }; },
            runTransaction: async () => !duplicate
        }
    };
    vm.runInNewContext(ts.transpileModule(handlerSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS }
    }).outputText, context);
    return {
        logs, databaseCalls: () => databaseCalls,
        async send(body, method = 'POST') {
            const res = new EventEmitter();
            res.status = code => { res.statusCode = code; return res; };
            res.json = res.send = value => { res.body = value; res.emit('finish'); return res; };
            await context.exports.latpeedPaymentWebhook({ body, method, rawBody: Buffer.from(JSON.stringify(body)) }, res);
            return res;
        }
    };
}
const payment = amount => ({ type: 'NORMAL_PAYMENT', payment: {
    amount, status: 'SUCCESS', orderId: 'order-123', email: 'private@example.com', phoneNumber: '01012345678'
} });

test('free deliveries are logged individually with order metadata and skip reason', async () => {
    const app = setup();
    for (let i = 0; i < 4; i++) {
        const response = await app.send(payment(0));
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.processed, false);
    }
    const received = app.logs.filter(log => log.message.endsWith('received'));
    const completed = app.logs.filter(log => log.message.endsWith('completed'));
    assert.equal(new Set(received.map(log => log.deliveryId)).size, 4);
    assert.equal(completed.length, 4);
    received.forEach((log, i) => {
        assert.equal(log.orderId, 'order-123');
        assert.equal(log.rawAmount, 0);
        assert.equal(log.deliveryId, completed[i].deliveryId);
        assert.equal(completed[i].outcome, 'zero_or_invalid_amount');
    });
    assert.equal(app.databaseCalls(), 0);
    assert.ok(!JSON.stringify(app.logs).includes('private@example.com'));
    assert.ok(!JSON.stringify(app.logs).includes('01012345678'));
});

test('invalid signatures and unsupported methods are recorded before rejection', async () => {
    for (const [valid, method, status, outcome] of [
        [false, 'POST', 401, 'invalid_signature'], [true, 'GET', 405, 'method_not_allowed']
    ]) {
        const app = setup(valid);
        const response = await app.send(payment(100), method);
        assert.equal(response.statusCode, status);
        assert.equal(app.logs.length, 2);
        assert.equal(app.logs[1].outcome, outcome);
        assert.equal(app.databaseCalls(), 0);
    }
});

test('duplicate paid deliveries are recorded without repeating downstream processing', async () => {
    const app = setup(true, true);
    const response = await app.send(payment(100));
    assert.equal(response.body.duplicate, true);
    assert.equal(app.logs[1].outcome, 'duplicate');
    assert.equal(app.logs[1].emailStatus, 'not_attempted');
});

test('free [테스트] purchases use the paid test amount and enter the normal purchase flow', async () => {
    const app = setup(true, true, '[테스트] 라이프업 1.5 올인원 - 얼리버드 특별 할인 판매');
    const response = await app.send(payment(0));
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.duplicate, true);
    assert.equal(app.logs[0].rawAmount, 0);
    assert.equal(app.logs[0].effectiveAmount, 10_000);
    assert.equal(app.logs[0].isTestPurchase, true);
    assert.equal(app.logs[1].outcome, 'duplicate');
});
