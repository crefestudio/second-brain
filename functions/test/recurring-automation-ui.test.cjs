const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const catalog = require('../lib/template-catalog');

function load(relativePath, dependencies = {}) {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src/app', relativePath), 'utf8');
    const exports = {};
    const context = { exports, console, Error, require(name) {
        if (name.endsWith('template-catalog')) return catalog;
        if (name.endsWith('user.service')) return { UserService: dependencies.users };
        if (name.endsWith('toast.service')) return { ToastService: { show() {}, error() {} } };
        if (name === '@angular/core') return { Component: () => target => target };
        return {};
    } };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true
    } }).outputText, context);
    return exports;
}

test('recurring automation is available only to LifeUp and Planner', () => {
    for (const template of catalog.TEMPLATE_IDS) {
        assert.equal(catalog.canUseAgent(template, 'recurringSchedules'), ['lifeUp', 'lifeupPlanner'].includes(template));
    }
});

test('manager uses the authenticated recurring API and rolls back a failed toggle', async () => {
    const requests = [];
    let fail = false;
    const users = {
        updateUserAutomation: () => assert.fail('Recurring settings must not be written directly from the browser'),
        getAutomationStatus: async (_uid, id, enabled) => { assert.equal(id, 'recurringSchedules'); return enabled ? 'running' : 'waiting'; }
    };
    const { AutoManagerComponent } = load('components/pages/workspace/pages/auto-manager/auto-manager.component.ts', { users });
    const component = new AutoManagerComponent({}, { templateId: 'lifeUp' }, {
        request: async (uid, action, data) => { requests.push({ uid, action, ...data }); if (fail) throw new Error('connection failed'); return { enabled: data.enabled }; }
    });
    component.userId = 'workspace'; component.notionAccessToken = 'connected';
    const agent = component.automationAgents.find(item => item.id === 'recurringSchedules');
    assert.equal(agent.name, '반복 일정 동기화');
    assert.equal(Array.from(agent.category).join(' > '), 'LifeUp > 일정');
    agent.enabled = true; await component.onChangeAgentEnabled(agent);
    assert.equal(requests[0].action, 'enable'); assert.equal(requests[0].enabled, true); assert.equal(agent.status, 'running');
    agent.enabled = false; await component.onChangeAgentEnabled(agent);
    assert.equal(requests[1].enabled, false); assert.equal(agent.status, 'waiting');
    fail = true; agent.enabled = true; await component.onChangeAgentEnabled(agent);
    assert.equal(agent.enabled, false); assert.equal(component.updatingAgentIds.size, 0);
});

test('workspace status and counters include recurring events, and log filters use the display name', async () => {
    const users = {
        getUserIntegrations: async () => ({ recurringSchedules: { enabled: true } }),
        getAutomationStatus: async (_uid, id) => id === 'recurringSchedules' ? 'error' : 'running',
        getTodayEventCount: async (_uid, id) => id === 'recurringSchedules' ? 4 : 0
    };
    const { WorkspaceComponent } = load('components/pages/workspace/workspace.component.ts', { users });
    const component = new WorkspaceComponent({}, { templateId: 'lifeUp' });
    component.userId = 'workspace';
    component.updateSession = component.updatePurchaseInfo = component.loadLifeupTemplateInfo = async () => {};
    await component.initData();
    assert.equal(component.automationAgents.find(item => item.id === 'recurringSchedules').status, 'error');
    assert.equal(component.recurringCount, 4);
    const { EventLogComponent } = load('components/pages/workspace/pages/event-log/event-log.component.ts', { users });
    const logs = new EventLogComponent({}, {}, {});
    assert.equal(logs.getAgentName('recurringSchedules'), '반복 일정 동기화');
    assert.ok(logs.agents.some(item => item.id === 'recurringSchedules'));
});
