/* Optional desktop/mobile shortcut. No service worker or automatic install prompt. */
(() => {
  'use strict';
  if (window.helionShortcut) return;
  const officialUrl = 'https://nyllime.github.io/helion-beta/';
  const windowsShortcut = '[InternetShortcut]\r\nURL=' + officialUrl + '\r\n';
  let deferredPrompt = null;
  let promptBusy = false;
  let previousFocus = null;
  const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

  function updateDialog() {
    const root = document.getElementById('helionShortcutDialog');
    if (!root) return;
    const install = root.querySelector('[data-shortcut-install]');
    install.hidden = !deferredPrompt || installed();
    install.disabled = promptBusy;
    const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent || '') || window.matchMedia?.('(max-width:760px)').matches;
    root.querySelector('[data-shortcut-download]').hidden = mobile;
    root.querySelector('[data-shortcut-windows-help]').hidden = mobile;
    root.querySelector('[data-shortcut-mobile-help]').hidden = !mobile;
    const message = root.querySelector('[data-shortcut-status]');
    if (installed()) message.textContent = 'O Helion já está aberto como aplicativo neste aparelho.';
  }

  function close() {
    const root = document.getElementById('helionShortcutDialog');
    if (!root) return;
    root.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  function downloadWindowsShortcut() {
    const url = URL.createObjectURL(new Blob([windowsShortcut], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Helion.url';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    const status = document.querySelector('#helionShortcutDialog [data-shortcut-status]');
    if (status) status.textContent = 'Atalho baixado. Mova o arquivo Helion.url para a área de trabalho e abra quando precisar.';
  }

  async function install() {
    if (!deferredPrompt || promptBusy) return;
    const event = deferredPrompt;
    deferredPrompt = null;
    promptBusy = true;
    updateDialog();
    const status = document.querySelector('#helionShortcutDialog [data-shortcut-status]');
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (status) status.textContent = choice.outcome === 'accepted'
        ? 'Instalação solicitada. O navegador mostrará o Helion entre os seus aplicativos.'
        : 'Você pode instalar depois ou baixar o atalho para Windows.';
    } catch {
      if (status) status.textContent = 'Use a opção de instalar aplicativo no menu do navegador ou baixe o atalho para Windows.';
    } finally {
      promptBusy = false;
      updateDialog();
    }
  }

  function open() {
    document.getElementById('userMenu')?.classList.remove('show');
    const existing = document.getElementById('helionShortcutDialog');
    if (existing) { existing.querySelector('[data-shortcut-close]').focus(); return; }
    previousFocus = document.activeElement;
    const root = document.createElement('div');
    root.id = 'helionShortcutDialog';
    root.className = 'helion-shortcut-back';
    root.innerHTML = '<section class="helion-shortcut-card" role="dialog" aria-modal="true" aria-labelledby="helionShortcutTitle">'
      + '<header><h3 id="helionShortcutTitle">Instalar Helion</h3><button type="button" class="icon-btn" data-shortcut-close aria-label="Fechar opções de atalho">×</button></header>'
      + '<p>Abra o Helion rapidamente pelo ícone no computador ou celular. O atalho acessa a versão oficial e os mesmos dados.</p>'
      + '<div class="helion-shortcut-actions"><button type="button" class="btn primary" data-shortcut-install hidden>Instalar Helion</button>'
      + '<button type="button" class="btn ghost" data-shortcut-download>Baixar atalho para Windows</button></div>'
      + '<p class="help" data-shortcut-windows-help>Depois de baixar, mova o arquivo <b>Helion.url</b> para a área de trabalho.</p>'
      + '<section data-shortcut-mobile-help hidden><h4>Adicionar à tela inicial do celular</h4>'
      + '<p><b>Android:</b> abra este site no Chrome. No menu ⋮, escolha <b>Instalar e criar atalho → Instalar</b> ou <b>Adicionar à tela inicial</b>.</p>'
      + '<p><b>iPhone:</b> abra no Safari, toque em <b>Compartilhar → Adicionar à Tela de Início</b>. Se aparecer, ative <b>Abrir como App da Web</b> e toque em <b>Adicionar</b>.</p>'
      + '<p class="help">Se o Helion estiver aberto dentro de outro aplicativo, abra o link no Chrome ou Safari para instalar.</p>'
      + '<p><a href="https://support.google.com/chrome/answer/9658361?hl=pt-BR&co=GENIE.Platform%3DAndroid" target="_blank" rel="noopener noreferrer">Ajuda para Android</a> · <a href="https://support.apple.com/pt-br/guide/iphone/iph42ab2f3a7/ios" target="_blank" rel="noopener noreferrer">Ajuda para iPhone</a></p></section>'
      + '<details><summary>Outras formas de adicionar o atalho</summary><p>Chrome e Edge oferecem a opção de instalar o site como aplicativo no menu do navegador.</p>'
      + '<p><a href="https://support.google.com/chrome/answer/9658361?hl=pt-BR" target="_blank" rel="noopener noreferrer">Ajuda do Chrome</a> · '
      + '<a href="https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge" target="_blank" rel="noopener noreferrer">Ajuda do Edge</a></p>'
      + '<p>No iPhone ou iPad, abra no Safari, toque em Compartilhar e em Adicionar à Tela de Início.</p></details>'
      + '<p class="help">A conexão com a internet continua necessária para acessar e salvar os dados do sistema.</p>'
      + '<p data-shortcut-status role="status" aria-live="polite"></p></section>';
    document.body.append(root);
    root.querySelector('[data-shortcut-close]').onclick = close;
    root.querySelector('[data-shortcut-download]').onclick = downloadWindowsShortcut;
    root.querySelector('[data-shortcut-install]').onclick = install;
    root.addEventListener('click', event => { if (event.target === root) close(); });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(root.querySelectorAll('button:not([hidden]):not(:disabled),a[href],summary')).filter(element => element.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    updateDialog();
    root.querySelector('[data-shortcut-close]').focus();
  }

  function ensureMenu() {
    const login = document.querySelector('#loginView .login-card');
    if (login && !document.getElementById('helionInstallLogin')) {
      const entry = document.createElement('button');
      entry.id = 'helionInstallLogin';
      entry.type = 'button';
      entry.className = 'btn ghost';
      entry.textContent = 'Instalar Helion';
      entry.onclick = open;
      login.append(entry);
    }
    const menu = document.getElementById('userMenu');
    if (!menu || document.getElementById('helionShortcutOpen')) return;
    const button = document.createElement('button');
    button.id = 'helionShortcutOpen';
    button.type = 'button';
    button.textContent = 'Instalar / criar atalho';
    button.onclick = open;
    menu.insertBefore(button, menu.querySelector('[data-action="logout"]'));
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    updateDialog();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateDialog();
    const status = document.querySelector('#helionShortcutDialog [data-shortcut-status]');
    if (status) status.textContent = 'Helion instalado. Use o ícone criado pelo navegador para abrir o sistema.';
  });
  // Keep older data-install controls useful without reviving their stale sw.js cache.
  if (typeof installApp === 'function') installApp = open;
  if (typeof initInstall === 'function') initInstall = ensureMenu;
  const style = document.createElement('style');
  style.textContent = '.helion-shortcut-back{position:fixed;inset:0;z-index:9999;background:#062b20a8;display:flex;align-items:center;justify-content:center;padding:20px}.helion-shortcut-card{width:min(520px,100%);max-height:calc(100dvh - 40px);overflow:auto;background:#fff;color:#152c24;border:1px solid #d6e4dd;border-radius:16px;padding:24px;box-shadow:0 18px 70px #001e2040}.helion-shortcut-card header{display:flex;justify-content:space-between;align-items:center;gap:16px}.helion-shortcut-card h3{margin:0}.helion-shortcut-card p{line-height:1.55}.helion-shortcut-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.helion-shortcut-card details{margin:18px 0}.helion-shortcut-card summary{cursor:pointer}.helion-shortcut-card a{color:#006f45;text-decoration:underline}.helion-shortcut-card [data-shortcut-status]:empty{display:none}.helion-shortcut-card [data-shortcut-status]{padding:12px;border-radius:8px;background:#eaf7ee;font-size:13px}.helion-shortcut-card [hidden]{display:none!important}@media print{.helion-shortcut-back{display:none!important}}';
  document.head.append(style);
  style.textContent += '#helionInstallLogin{width:100%;margin-top:12px;min-height:44px;color:#08663d;border-color:#97c6aa;background:#f3fbf5}.project-start-error{color:#a72a25;font-size:13px}.project-start-error:empty{display:none}';
  window.helionShortcut = { open, downloadWindowsShortcut };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureMenu, { once: true });
  else ensureMenu();
})();
