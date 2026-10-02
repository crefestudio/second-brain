const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTaskKinds } = require('../lib/task-classification');

test('a resolved date overrides an AI inbox classification', () => {
    assert.equal(resolveTaskKinds({ dateData: { date: '2026-10-02' }, kinds: '수집함' }), '일정');
});

test('a resolved date takes priority over every explicit task classification', () => {
    for (const kinds of [undefined, '다음', '대기중', '나중에', '일정']) {
        assert.equal(resolveTaskKinds({ dateData: { date: '2026-10-02' }, kinds }), '일정');
    }
});

test('undated tasks preserve their classification or default to inbox', () => {
    assert.equal(resolveTaskKinds({}), '수집함');
    assert.equal(resolveTaskKinds({ dateData: {}, kinds: '나중에' }), '나중에');
    assert.equal(resolveTaskKinds({ kinds: '대기중' }), '대기중');
});
