const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function subject(file, names, globals = {}) {
    const source = fs.readFileSync(file, 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const cls = tree.statements.find(ts.isClassDeclaration);
    const members = cls.members.filter(node => names.includes(node.name?.getText(tree)))
        .map(node => node.getText(tree)).join('\n');
    const context = vm.createContext({ ...globals });
    vm.runInContext(ts.transpileModule(`class Subject { ${members} } globalThis.Subject = Subject;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2020 }
    }).outputText, context);
    return context.Subject;
}

const invalid = [undefined, null, '', '종일', '식사 전', '식사 후', '24:00', '09:60', '9:00', ' 09:00 '];
test('invalid times are rejected before any database access for create and update', async () => {
    const Service = subject('src/app/services/user.service.ts', ['isValidHabitTime', 'addUserHabit', 'updateUserHabit']);
    for (const time of invalid) {
        assert.equal(Service.isValidHabitTime(time), false);
        const habit = { id: 'habit', name: 'test', time };
        assert.equal((await Service.addUserHabit('user', habit)).success, false);
        assert.equal((await Service.updateUserHabit('user', habit)).success, false);
    }
    for (const time of ['00:00', '09:00', '23:59']) assert.equal(Service.isValidHabitTime(time), true);
});

const base = 'src/app/components/pages/workspace/pages/routine/pages/';
test('all suggested routines have usable times', () => {
    const Component = subject(base + 'rountine-find/routine-find.component.ts', ['habits', 'isValidTime']);
    const component = new Component();
    assert.ok(component.habits.length > 0);
    for (const habit of component.habits) assert.ok(component.isValidTime(habit.time), habit.name);
    for (const name of ['6000보 이상 걷기', '식사 전 물 한 컵']) {
        assert.equal(component.habits.find(habit => habit.name === name).time, '09:00');
    }
});

test('add and edit screens stop invalid times before saving', async () => {
    const notices = [];
    const globals = { ToastService: { warning: message => notices.push(message) } };
    const Find = subject(base + 'rountine-find/routine-find.component.ts', ['isValidTime', 'addHabit'], globals);
    const Mine = subject(base + 'my-rountine/my-routine.component.ts', ['isValidTime', 'saveHabit'], globals);
    for (const time of invalid) {
        await new Find().addHabit({ time });
        const mine = new Mine();
        mine.editingHabit = { name: 'test', days: ['월'], time };
        await mine.saveHabit();
    }
    assert.equal(notices.length, invalid.length * 2);
});
