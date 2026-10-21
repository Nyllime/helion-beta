/* Saved product brands and groups. Product text/import fields remain editable. */
(function () {
  'use strict';
  const catalogKinds = {
    brand: { plural: 'Marcas', singular: 'marca', field: 'brand', input: 'mProdBrand', list: 'productBrandChoices' },
    group: { plural: 'Grupos', singular: 'grupo', field: 'group_name', input: 'mProdGroup', list: 'productGroupChoices' }
  };
  let catalogCache = { key: '', rows: [], loaded: false, pending: null, error: '' };

  function catalogContext() {
    return state.profile?.company_id && state.profile?.id ? state.profile.company_id + ':' + state.profile.id : '';
  }
  function catalogCanRead() { return !!catalogContext() && hasFeature('products'); }
  function catalogCanWrite() { return catalogCanRead() && canSeeCosts(); }
  function catalogNameKey(value) { return String(value || '').trim().toLocaleLowerCase('pt-BR'); }
  function catalogEntries(kind) {
    const definition = catalogKinds[kind], entries = new Map();
    if (!definition) return [];
    for (const product of state.products || []) {
      const name = String(product[definition.field] || '').trim();
      if (!name) continue;
      const key = catalogNameKey(name), old = entries.get(key);
      entries.set(key, { name: old?.name || name, saved: old?.saved || false, used: (old?.used || 0) + 1 });
    }
    if (catalogCache.key === catalogContext()) for (const row of catalogCache.rows) {
      if (row.kind !== kind) continue;
      const key = catalogNameKey(row.name), old = entries.get(key);
      entries.set(key, { name: row.name, saved: true, used: old?.used || 0 });
    }
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  function catalogWireProductForm() {
    if (!catalogCanRead()) return;
    for (const [kind, definition] of Object.entries(catalogKinds)) {
      const input = document.getElementById(definition.input);
      if (!input) continue;
      let list = document.getElementById(definition.list);
      if (!list) {
        list = document.createElement('datalist');
        list.id = definition.list;
        input.after(list);
      }
      input.setAttribute('list', definition.list);
      list.innerHTML = catalogEntries(kind).map(entry => '<option value="' + esc(entry.name) + '"></option>').join('');
    }
  }
  function catalogRenderList() {
    const modal = document.getElementById('productCatalogModal');
    if (!modal || modal.dataset.context !== catalogContext()) return;
    const kind = modal.dataset.kind, query = catalogNameKey(document.getElementById('productCatalogSearch')?.value);
    const all = catalogEntries(kind), entries = all.filter(entry => !query || catalogNameKey(entry.name).includes(query));
    document.getElementById('productCatalogCount').textContent = entries.length + ' de ' + all.length + ' ' + catalogKinds[kind].plural.toLocaleLowerCase('pt-BR');
    document.getElementById('productCatalogList').innerHTML = entries.length ? entries.map(entry =>
      '<li><div><b>' + esc(entry.name) + '</b><small>' + (entry.used ? 'Em ' + entry.used + ' produto(s)' : 'Disponível para novos produtos') + '</small></div><span class="status ' + (entry.saved ? 'ok' : '') + '">' + (entry.saved ? 'Cadastrado' : 'Em uso nos produtos') + '</span></li>'
    ).join('') : '<li class="help">' + (query ? 'Nenhum resultado para essa pesquisa.' : 'Nenhum cadastro ainda. Adicione o primeiro acima.') + '</li>';
    document.getElementById('productCatalogLoadStatus').textContent = catalogCache.error ? 'Não foi possível carregar os cadastros salvos. ' + catalogCache.error : catalogCache.pending ? 'Carregando cadastros salvos…' : '';
    document.getElementById('productCatalogRetry').hidden = !catalogCache.error;
  }
  async function catalogLoad(force) {
    if (!catalogCanRead()) return;
    const key = catalogContext(), companyId = state.profile.company_id;
    if (catalogCache.key !== key) catalogCache = { key, rows: [], loaded: false, pending: null, error: '' };
    const cache = catalogCache;
    if (cache.pending) {
      await cache.pending;
      if (force && catalogContext() === key) return catalogLoad(true);
      return;
    }
    if (cache.loaded && !force) return;
    cache.error = '';
    cache.pending = Promise.resolve().then(async () => {
      try {
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const result = await db.from('product_catalog_entries').select('id,company_id,kind,name,created_at').eq('company_id', companyId).order('name').range(offset, offset + 499);
          if (result.error) throw result.error;
          rows.push(...(result.data || []));
          if ((result.data || []).length < 500) break;
        }
        if (catalogContext() === key && catalogCache === cache) { cache.rows = rows; cache.loaded = true; }
      } catch (error) {
        if (catalogContext() === key && catalogCache === cache) cache.error = error.message || 'Tente novamente.';
      } finally {
        cache.pending = null;
        if (catalogContext() === key && catalogCache === cache) { catalogWireProductForm(); catalogRenderList(); }
      }
    });
    catalogRenderList();
    return cache.pending;
  }
  async function catalogSave(event) {
    event.preventDefault();
    const modal = document.getElementById('productCatalogModal'), input = document.getElementById('productCatalogName');
    if (!modal || !input || !catalogCanWrite()) return;
    const name = input.value.trim(), kind = modal.dataset.kind, context = catalogContext();
    const status = document.getElementById('productCatalogSaveStatus'), button = document.getElementById('productCatalogSave');
    if (!name || name.length > 120) { status.textContent = 'Informe um nome de até 120 caracteres.'; input.focus(); return; }
    button.disabled = true; status.textContent = 'Salvando…';
    try {
      const result = await db.from('product_catalog_entries').insert({ company_id: state.profile.company_id, kind, name }).select('id,company_id,kind,name,created_at').single();
      if (result.error) {
        if (result.error.code === '23505') {
          await catalogLoad(true);
          if (modal.isConnected && catalogContext() === context) status.textContent = 'Esse nome já está cadastrado.';
          return;
        }
        throw result.error;
      }
      if (catalogContext() !== context) return;
      await catalogLoad(true);
      // Keep the confirmed row available even if a reload encounters a connection error.
      if (result.data && !catalogCache.rows.some(row => row.id === result.data.id)) catalogCache.rows.push(result.data);
      catalogWireProductForm(); catalogRenderList();
      if (modal.isConnected) { input.value = ''; status.textContent = kind === 'brand' ? 'Marca cadastrada.' : 'Grupo cadastrado.'; input.focus(); }
    } catch (error) {
      if (modal.isConnected && catalogContext() === context) status.textContent = error.message || 'Não foi possível salvar. Tente novamente.';
    } finally { if (button.isConnected) button.disabled = false; }
  }
  function catalogOpen(kind) {
    if (!catalogCanWrite() || !catalogKinds[kind]) return;
    const definition = catalogKinds[kind];
    showModal(modalHead('Cadastrar ' + definition.plural.toLocaleLowerCase('pt-BR'), 'Os nomes ficam salvos para usar nos próximos cadastros de produtos.') +
      '<section id="productCatalogModal" data-kind="' + kind + '" data-context="' + esc(catalogContext()) + '">' +
      '<form id="productCatalogForm" class="product-catalog-form"><label>Nome d' + (kind === 'brand' ? 'a marca' : 'o grupo') + '<input id="productCatalogName" maxlength="120" required autocomplete="off"></label><button id="productCatalogSave" type="submit" class="btn primary">Cadastrar ' + definition.singular + '</button></form>' +
      '<p id="productCatalogSaveStatus" role="status" aria-live="polite"></p><label>Pesquisar ' + definition.plural.toLocaleLowerCase('pt-BR') + '<input id="productCatalogSearch" type="search" placeholder="Digite o nome" autocomplete="off"></label>' +
      '<p class="help" id="productCatalogCount"></p><p class="help" id="productCatalogLoadStatus" role="status"></p><button id="productCatalogRetry" type="button" class="btn ghost" hidden>Tentar carregar novamente</button><ul id="productCatalogList" class="product-catalog-list"></ul></section>');
    document.getElementById('productCatalogForm').onsubmit = catalogSave;
    document.getElementById('productCatalogSearch').oninput = catalogRenderList;
    document.getElementById('productCatalogRetry').onclick = () => catalogLoad(true);
    catalogRenderList(); catalogLoad(true); document.getElementById('productCatalogName').focus();
  }
  function catalogEnsureActions() {
    const head = document.querySelector('#page-products > .page-head');
    if (!head) return;
    let actions = document.getElementById('productCatalogActions');
    if (!actions) {
      actions = document.createElement('div'); actions.id = 'productCatalogActions'; actions.className = 'row product-catalog-actions';
      actions.innerHTML = '<button type="button" class="btn ghost" data-product-catalog="brand">Cadastrar marcas</button><button type="button" class="btn ghost" data-product-catalog="group">Cadastrar grupos</button>';
      (head.querySelector('.row') || head).append(actions);
      actions.onclick = event => { const button = event.target.closest('[data-product-catalog]'); if (button) catalogOpen(button.dataset.productCatalog); };
    }
    actions.hidden = !catalogCanWrite();
  }
  const style = document.createElement('style'); style.textContent = '.product-catalog-actions{flex-wrap:wrap;gap:8px}.product-catalog-form{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}.product-catalog-form label{flex:1 1 220px}.product-catalog-list{padding:0;margin:12px 0 0;list-style:none;max-height:330px;overflow:auto}.product-catalog-list li{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #e1ebe6;overflow-wrap:anywhere}.product-catalog-list small{display:block;margin-top:4px;color:#697f74}.product-catalog-list .status{flex-shrink:0}@media(max-width:560px){.product-catalog-list li{align-items:flex-start;flex-wrap:wrap}.product-catalog-form button{width:100%}}'; document.head.append(style);
  const renderProductsBeforeCatalog = renderProducts;
  renderProducts = function (...args) { const result = renderProductsBeforeCatalog.apply(this, args); catalogEnsureActions(); catalogLoad(false); return result; };
  const openProductBeforeCatalog = openProductModal;
  openProductModal = function (...args) { const result = openProductBeforeCatalog.apply(this, args); catalogWireProductForm(); catalogLoad(false); return result; };
  const navigationBeforeCatalog = refreshNavigation;
  refreshNavigation = function (...args) { const result = navigationBeforeCatalog.apply(this, args); catalogEnsureActions(); return result; };
  catalogEnsureActions();
})();
