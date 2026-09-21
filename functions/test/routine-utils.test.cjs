const { test } = require('node:test');
const assert = require('node:assert/strict');
const { habitDayRange, uniqueHabitLogs } = require('../lib/routine-utils');

test('Korean day includes the last second and crosses month/year boundaries', () => {
    assert.deepEqual(habitDayRange('2026-12-31'), {
        start: '2026-12-30T15:00:00.000Z', end: '2026-12-31T15:00:00.000Z'
    });
    assert.deepEqual(habitDayRange('2028-02-29'), {
        start: '2028-02-28T15:00:00.000Z', end: '2028-02-29T15:00:00.000Z'
    });
});

const page = (id, habitId, completed) => ({ id, properties: {
    habitId: { rich_text: habitId ? [{ plain_text: habitId }] : [] },
    완료: { checkbox: completed }
} });

test('duplicate habit records count once and preserve completion regardless of order', () => {
    const pages = [page('a', 'habit-a', false), page('b', 'habit-a', true), page('c', 'habit-b', false)];
    for (const input of [pages, [...pages].reverse()]) {
        const result = uniqueHabitLogs(input);
        assert.equal(result.length, 2);
        assert.equal(result.filter(p => p.properties.완료.checkbox).length, 1);
    }
});

test('Notion-only records without habitId remain distinct', () => {
    assert.equal(uniqueHabitLogs([page('a', '', true), page('b', '', false)]).length, 2);
});
