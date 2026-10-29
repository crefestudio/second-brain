const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real component methods without contacting Firebase or Notion.
const source = fs.readFileSync(require.resolve('../src/app/components/pages/workspace/pages/routine/pages/my-rountine/my-routine.component.ts'), 'utf8');
const tree = ts.createSourceFile('routine.ts', source, ts.ScriptTarget.Latest, true);
const component = tree.statements.find(node => ts.isClassDeclaration(node));
const names = ['startHabitDrag', 'moveHabitDrag', 'cancelHabitDrag', 'finishHabitDrag', 'getHabitTop'];
const methods = component.members.filter(node => names.includes(node.name?.getText(tree)))
    .map(node => node.getText(tree).replace(/@HostListener\([^\n]+\)\s*/, '')).join('\n');
const compiled = ts.transpileModule(`class Subject { ${methods} } globalThis.Subject = Subject;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 }
}).outputText;

function setup({ success = true, syncSuccess = true } = {}) {
    const calls = { saves: [], syncs: [], notices: [], loads: 0 };
    const context = vm.createContext({ console,
        UserService: { updateUserHabit: async (userId, habit) => {
            calls.saves.push({ userId, habit }); return { success, message: success ? '' : '시간 중복' };
        } },
        ToastService: Object.fromEntries(['warning', 'error', 'show'].map(key => [key, message => calls.notices.push(message)]))
    });
    vm.runInContext(compiled, context);
    const subject = new context.Subject();
    Object.assign(subject, { startHour: 5, hourHeight: 120, userId: 'test-user', habitDrag: null,
        isMovingHabit: false, loadHabits: async () => { calls.loads++; },
        userService: { syncMyHabitsWithUserId: async (...args) => { calls.syncs.push(args); return { success: syncSuccess }; } }
    });
    const habit = { id: 'habit-1', icon: '🌱', name: '🌱 스트레칭', days: ['월', '수'], time: '07:00', duration: 5 };
    let captured = false;
    const column = { dataset: { day: '화' }, getBoundingClientRect: () => ({ top: 100 }) };
    const element = {
        getBoundingClientRect: () => ({ top: 340 }),
        closest: () => ({ contains: candidate => candidate === column }),
        ownerDocument: { elementFromPoint: () => ({ closest: () => column }) },
        setPointerCapture: () => { captured = true; },
        hasPointerCapture: () => captured,
        releasePointerCapture: () => { captured = false; }
    };
    const event = (x, y) => ({ button: 0, isPrimary: true, pointerId: 1, clientX: x, clientY: y,
        currentTarget: element, target: { closest: () => null } });
    const start = () => subject.startHabitDrag(event(100, 350), habit, '월');
    return { subject, calls, column, element, habit, event, start };
}

test('dragging across columns changes only time, preserves every weekday, and syncs the saved routine', async () => {
    const s = setup(); s.start();
    await s.subject.finishHabitDrag(s.event(200, 470)); // 08:00, with original grab offset
    const saved = s.calls.saves[0].habit;
    assert.deepEqual(Array.from(saved.days), ['월', '수']);
    assert.equal(saved.time, '08:00');
    assert.equal(saved.name, '스트레칭');
    assert.deepEqual(s.habit.days, ['월', '수']);
    assert.equal(s.habit.time, '07:00');
    assert.deepEqual(s.calls.syncs, [['test-user', 'habit-1']]);
    assert.equal(s.subject.isMovingHabit, false);
});

test('horizontal movement alone never saves, even for an off-grid original time', async () => {
    const s = setup(); s.habit.time = '01:06'; s.start();
    await s.subject.finishHabitDrag(s.event(200, 350));
    assert.equal(s.calls.saves.length, 0);
    assert.equal(s.habit.time, '01:06');
});

test('preview stays in the source column and dropping over a repeat day preserves all days', async () => {
    const s = setup(); s.column.dataset.day = '수'; s.start();
    s.subject.moveHabitDrag(s.event(200, 470));
    assert.equal(s.subject.habitDrag.day, '월');
    await s.subject.finishHabitDrag(s.event(200, 470));
    assert.deepEqual(Array.from(s.calls.saves[0].habit.days), ['월', '수']);
});

test('early morning drop and display agree at every zoom, with five-minute snapping', () => {
    for (const height of [60, 120, 180, 240]) {
        const s = setup(); s.subject.hourHeight = height; s.start();
        s.subject.moveHabitDrag(s.event(200, 110 + (20 * 60 + 6) / 60 * height));
        assert.equal(s.subject.habitDrag.time, '01:05');
        assert.ok(Math.abs(s.subject.getHabitTop({ time: '01:05' }) - s.subject.habitDrag.top) < 1e-8);
    }
});

test('clicks, cancellation and dropping outside the calendar never save', async () => {
    const click = setup(); click.start(); await click.subject.finishHabitDrag(click.event(102, 351));
    assert.equal(click.calls.saves.length, 0);
    const cancel = setup(); cancel.start(); cancel.subject.cancelHabitDrag();
    await cancel.subject.finishHabitDrag(cancel.event(200, 470));
    assert.equal(cancel.calls.saves.length, 0);
    const outside = setup(); outside.start(); outside.element.ownerDocument.elementFromPoint = () => null;
    await outside.subject.finishHabitDrag(outside.event(200, 470));
    assert.equal(outside.calls.saves.length, 0);
});

test('overlap rejection preserves the routine and does not sync', async () => {
    const s = setup({ success: false }); s.start();
    await s.subject.finishHabitDrag(s.event(200, 470));
    assert.equal(s.habit.time, '07:00');
    assert.equal(s.calls.loads, 0);
    assert.equal(s.calls.syncs.length, 0);
    assert.equal(s.calls.notices[0], '시간 중복');
    assert.equal(s.subject.isMovingHabit, false);
});

test('sync failure reports that the move was saved', async () => {
    const s = setup({ syncSuccess: false }); s.start();
    await s.subject.finishHabitDrag(s.event(200, 470));
    assert.equal(s.calls.loads, 1);
    assert.match(s.calls.notices[0], /이동은 저장됐지만/);
    assert.equal(s.subject.isMovingHabit, false);
});

test('edit/delete buttons and an in-flight save do not start another drag', () => {
    const s = setup();
    const event = s.event(100, 350); event.target.closest = () => ({});
    s.subject.startHabitDrag(event, s.habit, '월');
    assert.equal(s.subject.habitDrag, null);
    s.subject.isMovingHabit = true; s.start();
    assert.equal(s.subject.habitDrag, null);
});
