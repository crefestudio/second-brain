const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../../docs/imweb-app-embed.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function mount(search) {
    let src;
    let writes = 0;
    const listeners = {};
    const messages = [];
    const frame = { contentWindow: { postMessage: (data, origin) => messages.push({ data, origin }) },
        getAttribute: () => src, setAttribute: (_key, value) => { src = value; writes++; } };
    const shell = { style: {}, getBoundingClientRect: () => ({ top: 120 }) };
    const window = { innerHeight: 800, requestAnimationFrame: callback => callback(),
        location: { pathname: '/app', search }, addEventListener: (name, callback) => { listeners[name] = callback; } };
    window.history = { replaceState: (_state, _title, url) => {
        const [pathname, nextSearch = ''] = url.split('?');
        window.location.pathname = pathname;
        window.location.search = nextSearch ? '?' + nextSearch : '';
    } };
    vm.runInNewContext(script, { URLSearchParams, window, document: {
        getElementById: id => id === 'notionable-app-shell' ? shell : frame
    } });
    return { src: () => src, writes: () => writes, window, listeners, frame, messages, shell };
}

test('short links resolve workspace menus and standard pages', () => {
    for (const [query, expected] of [
        ['', '/workspace/home'],
        ['?menu=routine&sub=dashboard', '/workspace/routine/dashboard'],
        ['?page=download&sub=lifeup', '/download/lifeup'],
        ['?menu=studio&sub=template', '/workspace/studio/template'],
        ['?menu=routine', '/workspace/routine'],
        ['?page=mypage&sub=profile', '/mypage/profile'],
        ['?page=download&sub=lifeup&sub2=3333', '/download/lifeup/3333'],
        ['?menu=care&sub=migration', '/workspace/care/migration']
    ]) assert.equal(mount(query).src(), 'https://app.notionable.net' + expected);
});

test('iframe fits remaining viewport height including a mobile keyboard resize', () => {
    const h = mount('');
    assert.equal(h.shell.style.height, '680px');
    h.window.visualViewport = { height: 400, offsetTop: 0 };
    h.listeners.resize();
    assert.equal(h.shell.style.height, '280px');
    h.shell.getBoundingClientRect = () => ({ top: -100 });
    h.listeners.scroll();
    assert.equal(h.shell.style.height, '400px');
});

test('unknown and malicious routes cannot select arbitrary iframe targets', () => {
    for (const query of ['?menu=__proto__', '?menu=https://example.com', '?page=download&sub=../../admin',
        '?menu=routine&page=mypage', '?page=mypage&sub=%2Fadmin', '?page=download&sub2=3333']) {
        assert.equal(mount(query).src(), 'https://app.notionable.net/workspace/home');
    }
});

test('browser history navigates the same iframe without reloading an unchanged target', () => {
    const h = mount('?menu=routine');
    h.listeners.popstate();
    assert.equal(h.writes(), 1);
    h.window.location.search = '?page=download&sub=lifeup';
    h.listeners.popstate();
    assert.equal(h.src(), 'https://app.notionable.net/download/lifeup');
    assert.equal(h.writes(), 2);
});

test('app route changes update the parent URL using standard safe segments', () => {
    const h = mount('?menu=routine&sub=dashboard');
    const origin = 'https://app.notionable.net';
    const event = path => ({ origin, source: h.frame.contentWindow, data: { type: 'APP_ROUTE_CHANGED', path } });
    h.listeners.message(event('/workspace/studio/template'));
    assert.equal(h.window.location.search, '?menu=studio&sub=template');
    h.listeners.message(event('/download/lifeup?from=email'));
    assert.equal(h.window.location.search, '?page=download&sub=lifeup');
    h.listeners.message(event('/workspace/home'));
    assert.equal(h.window.location.search, '');
    h.listeners.message(event('/workspace/unknown'));
    assert.equal(h.window.location.search, '?menu=unknown');
    h.listeners.message({ ...event('/workspace/routine/find'), origin: 'https://example.com' });
    assert.equal(h.window.location.search, '?menu=unknown');
});

test('member hint is sent only to the configured app iframe and reflects logout', () => {
    const h = mount('');
    const origin = 'https://app.notionable.net';
    const event = { origin, source: h.frame.contentWindow, data: { type: 'CHECK_AUTH' } };
    h.window.MEMBER_UID = ' member-1 ';
    h.listeners.message({ ...event, origin: 'https://example.com' });
    h.listeners.message({ ...event, source: {} });
    h.listeners.message({ ...event, data: { type: 'OTHER' } });
    assert.equal(h.messages.length, 0);
    h.listeners.message(event);
    assert.equal(h.messages[0].data.memberUid, 'member-1');
    assert.equal(h.messages[0].origin, origin);
    h.window.MEMBER_UID = null;
    h.listeners.message(event);
    assert.equal(h.messages[1].data.memberUid, null);
});
