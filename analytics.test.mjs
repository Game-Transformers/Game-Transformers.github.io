import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import vm from 'node:vm';

const root = new URL('./', import.meta.url);
const source = await readFile(new URL('analytics.js', root), 'utf8');
const index = await readFile(new URL('index.html', root), 'utf8');
const measurementId = index.match(/data-measurement-id="([^"]+)"/)[1];
const storageKey = 'gameTransformers.analytics-consent.v1';
const disableKey = `ga-disable-${measurementId}`;
const plain = value => JSON.parse(JSON.stringify(value));

function fixture({ saved = null, blockedStorage = false, blockedStorageWrites = false, hostname = 'game-transformers.github.io', protocol = 'https:', lateLoad = false, id = measurementId } = {}) {
  const storage = new Map(saved === null ? [] : [[storageKey, saved]]);
  const requests = [];
  const cookieWrites = [];
  const listeners = new Map();
  const document = { readyState: lateLoad ? 'complete' : 'loading', currentScript: { dataset: { measurementId: id } }, referrer: 'https://referrer.example/private-name?token=secret#private' };

  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.hidden = false; }
    setAttribute(name, value) { this.attributes[name] = value; }
    appendChild(child) {
      this.children.push(child);
      if (child.tagName === 'script' && child.src) requests.push(child);
      return child;
    }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    click() { this.listeners.click?.(); }
    focus() { document.activeElement = this; }
    querySelector(tag) {
      for (const child of this.children) {
        if (child.tagName === tag) return child;
        const found = child.querySelector(tag);
        if (found) return found;
      }
      return null;
    }
  }
  document.createElement = tag => new Element(tag);
  document.head = new Element('head');
  document.body = new Element('body');
  Object.defineProperty(document, 'cookie', { set(value) { cookieWrites.push(value); } });
  const localStorage = {
    getItem(key) { if (blockedStorage) throw new Error('storage unavailable'); return storage.get(key) ?? null; },
    removeItem(key) { if (blockedStorage) throw new Error('storage unavailable'); storage.delete(key); },
    setItem(key, value) { if (blockedStorage || blockedStorageWrites) throw new Error('storage unavailable'); storage.set(key, value); },
  };
  const context = vm.createContext({
    document, localStorage, URL, Date,
    location: new URL(`${protocol}//${hostname}/?email=private%40example.test#private-token`),
    addEventListener(name, callback, options) {
      const list = listeners.get(name) || [];
      list.push({ callback, once: Boolean(options?.once) });
      listeners.set(name, list);
    },
    dispatchEvent(event) {
      for (const item of [...(listeners.get(event.type) || [])]) {
        if (item.once) listeners.set(event.type, listeners.get(event.type).filter(other => other !== item));
        item.callback(event);
      }
    },
  });
  context.window = context;
  const execute = () => vm.runInContext(source, context, { filename: 'analytics.js' });
  execute();
  const all = element => [element, ...element.children.flatMap(all)];
  const find = id => all(document.body).find(element => element.id === id);
  const click = label => {
    const button = all(document.body).find(element => element.tagName === 'button' && element.textContent === label);
    assert.ok(button, `button exists: ${label}`);
    button.click();
  };
  const commands = () => (context.dataLayer || []).map(command => plain(Array.from(command)));
  const finishDocument = () => {
    const originalBody = document.body;
    document.readyState = 'complete';
    document.currentScript = null;
    context.dispatchEvent({ type: 'DOMContentLoaded' });
    return originalBody;
  };
  return { context, document, storage, requests, cookieWrites, execute, commands, finishDocument, find, click };
}

test('the existing application stays byte-for-byte identical apart from one loader line', () => {
  const insertion = `  <script defer src="/analytics.js" data-measurement-id="${measurementId}"></script>\n`;
  assert.equal(index.split(insertion).length - 1, 1);
  const baseline = Buffer.from(index.replace(insertion, ''));
  const hash = createHash('sha1').update(`blob ${baseline.length}\0`).update(baseline).digest('hex');
  assert.equal(hash, 'f9b4d2b0c9f062edc9b8d3dba413171523e5fd2b');
  assert.equal(measurementId, 'G-WH32NXZK3Z');
});

test('late script arrival mounts from the ready document without a second initialization', () => {
  const f = fixture({ lateLoad: true });
  assert.equal(f.find('gt-analytics-consent').hidden, false);
  assert.equal(f.requests.length, 0);
  f.click('Accept');
  f.context.dispatchEvent({ type: 'DOMContentLoaded' });
  assert.equal(f.requests.length, 1);
  assert.equal(f.commands().filter(command => command[0] === 'config').length, 1);
  assert.equal(f.document.body.children.filter(child => child.id === 'gt-analytics-consent').length, 1);
  const returning = fixture({ saved: 'accepted', lateLoad: true });
  assert.equal(returning.requests.length, 1);
  assert.equal(returning.find('gt-analytics-consent').hidden, true);
});

test('unknown consent sends nothing and mounts Accept/Decline only after DOM readiness', () => {
  const f = fixture();
  assert.equal(f.requests.length, 0);
  assert.equal(f.document.body.children.length, 0);
  const oldBody = f.finishDocument();
  assert.equal(oldBody, f.document.body);
  assert.equal(oldBody.children.length, 2);
  assert.equal(f.find('gt-analytics-consent').hidden, false);
  assert.equal(f.context[disableKey], true);
  f.click('Decline');
  assert.equal(f.requests.length, 0);
  assert.equal(f.commands().length, 0);
  assert.equal(f.storage.get(storageKey), 'declined');
  assert.equal(f.find('gt-analytics-consent').hidden, true);
  assert.equal(f.find('gt-analytics-settings').hidden, false);
});

test('acceptance loads one tag, preserves denied advertising consent and strips private URL fields', () => {
  const f = fixture();
  f.finishDocument();
  f.click('Accept');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].src, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
  assert.equal(f.requests[0].referrerPolicy, 'origin');
  assert.equal(f.requests[0].async, true);
  assert.equal(f.storage.get(storageKey), 'accepted');
  assert.equal(f.context[disableKey], false);
  const commands = f.commands();
  assert.deepEqual(commands[0], ['consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  }]);
  const updates = commands.filter(command => command[0] === 'consent' && command[1] === 'update');
  assert.equal(updates.at(-1)[2].analytics_storage, 'granted');
  for (const kind of ['ad_storage', 'ad_user_data', 'ad_personalization']) assert.equal(updates.at(-1)[2][kind], 'denied');
  const config = commands.find(command => command[0] === 'config');
  assert.equal(config[1], measurementId);
  assert.equal(config[2].send_page_view, true);
  assert.equal(config[2].allow_google_signals, false);
  assert.equal(config[2].allow_ad_personalization_signals, false);
  assert.equal(config[2].page_location, 'https://game-transformers.github.io/');
  assert.equal(config[2].page_referrer, 'https://referrer.example');
  assert.equal(config[2].page_title, 'Game Transformers');
  assert.equal(config[2].cookie_domain, 'none');
  assert.equal(config[2].user_id, undefined);
  assert.equal(config[2].user_properties, undefined);
  assert.equal(JSON.stringify(commands).includes('private'), false);
});

test('remembered decline remains off and can be changed through Analytics settings', () => {
  const f = fixture({ saved: 'declined' });
  f.finishDocument();
  assert.equal(f.requests.length, 0);
  assert.equal(f.find('gt-analytics-consent').hidden, true);
  f.click('Analytics settings');
  assert.equal(f.find('gt-analytics-consent').hidden, false);
  f.click('Accept');
  assert.equal(f.requests.length, 1);
});

test('remembered acceptance waits for DOM readiness; repeated DOM readiness, script and acceptance do not duplicate initialization', () => {
  const f = fixture({ saved: 'accepted' });
  assert.equal(f.requests.length, 0);
  f.finishDocument();
  assert.equal(f.requests.length, 1);
  f.context.dispatchEvent({ type: 'DOMContentLoaded' });
  f.document.currentScript = { dataset: { measurementId } };
  f.execute();
  f.click('Analytics settings');
  f.click('Accept');
  assert.equal(f.requests.length, 1);
  assert.equal(f.commands().filter(command => command[0] === 'config').length, 1);
  assert.equal(f.document.body.children.filter(child => child.id === 'gt-analytics-consent').length, 1);
});

test('withdrawal disables collection before consent update and expires only this installation cookies', () => {
  const f = fixture();
  f.finishDocument();
  f.click('Accept');
  const flagsAtUpdate = [];
  const original = f.context.gtag;
  f.context.gtag = (...args) => { flagsAtUpdate.push(f.context[disableKey]); original(...args); };
  f.click('Analytics settings');
  f.click('Decline');
  assert.equal(f.context[disableKey], true);
  assert.deepEqual(flagsAtUpdate, [true]);
  assert.equal(f.commands().at(-1)[2].analytics_storage, 'denied');
  assert.deepEqual(f.cookieWrites.map(value => value.split('=')[0]), ['_ga', `_ga_${measurementId.slice(2)}`]);
  assert.ok(f.cookieWrites.every(value => value.includes('Max-Age=0; Path=/;')));
  assert.equal(f.storage.get(storageKey), 'declined');
  assert.equal(f.requests.length, 1);
});

test('unavailable browser storage neither crashes nor grants consent implicitly', () => {
  const f = fixture({ blockedStorage: true });
  f.finishDocument();
  assert.equal(f.requests.length, 0);
  f.click('Accept');
  assert.equal(f.requests.length, 1);
  f.click('Analytics settings');
  f.click('Decline');
  assert.equal(f.context[disableKey], true);
  const reload = fixture({ blockedStorage: true });
  reload.finishDocument();
  assert.equal(reload.requests.length, 0);
  assert.equal(reload.find('gt-analytics-consent').hidden, false);
});

test('an unrecognized saved value does not count as acceptance', () => {
  const f = fixture({ saved: 'yes' });
  f.finishDocument();
  assert.equal(f.requests.length, 0);
  assert.equal(f.find('gt-analytics-consent').hidden, false);
});

test('a failed withdrawal write cannot keep an old grant when removing that grant succeeds', () => {
  const f = fixture({ saved: 'accepted', blockedStorageWrites: true });
  f.finishDocument();
  assert.equal(f.requests.length, 1);
  f.click('Analytics settings');
  f.click('Decline');
  assert.equal(f.context[disableKey], true);
  assert.equal(f.storage.has(storageKey), false);
  const reload = fixture({ saved: f.storage.get(storageKey) ?? null });
  reload.finishDocument();
  assert.equal(reload.requests.length, 0);
  assert.equal(reload.find('gt-analytics-consent').hidden, false);
});

test('preview hostnames never load the production Google tag even after acceptance', () => {
  for (const hostname of ['localhost', 'encapsulatorp.github.io', 'unrelated.example']) {
    const f = fixture({ hostname });
    f.finishDocument();
    f.click('Accept');
    assert.equal(f.requests.length, 0);
    assert.equal(f.commands().length, 0);
    assert.equal(f.context[disableKey], true);
  }
});

test('HTTP never loads the production Google tag even on an allowed hostname', () => {
  for (const hostname of ['game-transformers.github.io']) {
    const f = fixture({ hostname, protocol: 'http:' });
    f.finishDocument();
    f.click('Accept');
    assert.equal(f.requests.length, 0);
    assert.equal(f.commands().length, 0);
    assert.equal(f.context[disableKey], true);
  }
});

test('missing or invalid stream IDs fail closed', () => {
  for (const id of ['', 'PENDING_MEASUREMENT_ID', 'G-INVALID_ID']) {
    const f = fixture({ id });
    f.finishDocument();
    assert.equal(f.requests.length, 0);
    assert.equal(f.document.body.children.length, 0);
  }
});

test('withdrawing or clearing consent in another tab disables this tab too', () => {
  const f = fixture({ saved: 'accepted' });
  f.finishDocument();
  f.storage.set(storageKey, 'declined');
  f.context.dispatchEvent({ type: 'storage', key: storageKey });
  assert.equal(f.context[disableKey], true);
  assert.equal(f.find('gt-analytics-consent').hidden, true);
  f.storage.clear();
  f.context.dispatchEvent({ type: 'storage', key: null });
  assert.equal(f.context[disableKey], true);
  assert.equal(f.find('gt-analytics-consent').hidden, false);
  assert.equal(f.requests.length, 1);
});
