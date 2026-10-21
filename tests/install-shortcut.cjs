const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map();
class Element {
  constructor(tag) { this.tag = tag; this.nodes = new Map(); this.events = {}; this.isConnected = true; this.classList = { remove() {} }; }
  set id(value) { this._id = value; elements.set(value, this); }
  get id() { return this._id; }
  append() {}
  insertBefore(child) { this.inserted = child; }
  querySelector(selector) {
    if (selector === '[data-action="logout"]') return null;
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element('button'));
    return this.nodes.get(selector);
  }
  querySelectorAll() { return []; }
  addEventListener(name, handler) { this.events[name] = handler; }
  remove() { if (this.id) elements.delete(this.id); }
  focus() {}
  click() { this.clicked = true; this.onclick?.(); }
}
const menu = new Element('menu'); menu.id = 'userMenu';
const loginCard = new Element('div'); loginCard.id = 'test-login-card';
const eventHandlers = {};
const objectUrls = [];
const timers = [];
const anchors = [];
const context = {
  Blob,
  URL: { createObjectURL(blob) { objectUrls.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
  navigator: { serviceWorker: { register() { throw new Error('Must not register a caching worker'); } } },
  document: {
    readyState: 'complete', activeElement: null, head: new Element('head'), body: new Element('body'),
    getElementById(id) { return elements.get(id) || null; },
    createElement(tag) { const el = new Element(tag); if (tag === 'a') anchors.push(el); return el; },
    querySelector(selector) { return selector === '#loginView .login-card' ? loginCard : null; }
  },
  window: {
    matchMedia() { return { matches: false }; },
    addEventListener(name, handler) { eventHandlers[name] = handler; },
    setTimeout(fn) { timers.push(fn); }
  },
  installApp() { throw new Error('Legacy install must be replaced'); },
  initInstall() { throw new Error('Legacy worker must be replaced'); }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('install-shortcut.js', 'utf8'), context);
assert.equal(menu.inserted.textContent, 'Instalar / criar atalho');
assert.equal(!!context.window.helionShortcut, true);
assert.equal(elements.get('helionInstallLogin').textContent, 'Instalar Helion');
assert.doesNotThrow(() => context.initInstall());
let promptCount = 0;
let preventCount = 0;
eventHandlers.beforeinstallprompt({ preventDefault() { preventCount++; }, async prompt() { promptCount++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
assert.equal(preventCount, 1);
assert.equal(promptCount, 0, 'install must never open automatically');
elements.get('helionInstallLogin').onclick();
assert.equal(elements.get('helionShortcutDialog').querySelector('[data-shortcut-install]').hidden, false);
elements.get('helionShortcutDialog').querySelector('[data-shortcut-close]').onclick();
context.navigator.userAgent='Android';
elements.get('helionInstallLogin').onclick();
assert.equal(elements.get('helionShortcutDialog').querySelector('[data-shortcut-download]').hidden,true);
assert.equal(elements.get('helionShortcutDialog').querySelector('[data-shortcut-mobile-help]').hidden,false);
context.window.helionShortcut.downloadWindowsShortcut();
assert.equal(anchors[0].download, 'Helion.url');
assert.equal(anchors[0].clicked, true);
(async () => {
  assert.equal(await objectUrls[0].text(), '[InternetShortcut]\r\nURL=https://nyllime.github.io/helion-beta/\r\n');
  await elements.get('helionShortcutDialog').querySelector('[data-shortcut-install]').onclick();
  assert.equal(promptCount, 1);
  assert.equal(elements.get('helionShortcutDialog').querySelector('[data-shortcut-install]').hidden, true);
  elements.get('helionShortcutDialog').querySelector('[data-shortcut-close]').onclick();
  assert.equal(elements.has('helionShortcutDialog'), false);
  timers.forEach(fn => fn());
  console.log('Shortcut runtime checks passed: explicit install only, canonical downloadable URL, no service-worker registration, closeable dialog.');
})().catch(error => { console.error(error); process.exitCode = 1; });
