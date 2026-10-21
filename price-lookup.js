/* Read-only catalog lookup. Photos and image embeddings stay in this browser. */
(() => {
  'use strict';
  let job = 0, mode = 'text', limit = 20, photoURL = '', photoMatches = [];
  let modelPromise, cacheOwner = '';
  const vectors = new Map();
  const page = document.createElement('section');
  page.id = 'page-prices';
  page.className = 'page';
  page.innerHTML = `
    <div class="page-head"><div><h2>Consultar preços</h2><p>Pesquise pelo nome, código ou uma foto do produto.</p></div></div>
    <article class="panel price-search-panel">
      <label>Nome ou código do produto<input id="priceQuery" type="search" autocomplete="off" placeholder="Comece a digitar para pesquisar..."></label>
      <div class="price-photo-actions">
        <button class="btn primary" type="button" id="priceCamera">Tirar foto</button>
        <button class="btn ghost" type="button" id="priceGallery">Escolher foto</button>
      </div>
      <input id="priceCameraFile" type="file" accept="image/*" capture="environment" hidden>
      <input id="priceGalleryFile" type="file" accept="image/*" hidden>
      <div class="price-photo-preview" id="pricePhotoPreview" hidden>
        <img id="pricePhoto" alt="Foto usada na pesquisa">
        <div><p>Compare a embalagem, a medida e a marca antes de escolher.</p><button class="btn ghost" type="button" id="priceClearPhoto">Remover foto</button></div>
      </div>
      <p class="help">Fotografe um produto de cada vez, de frente e com boa luz. A busca mostra produtos parecidos com as fotos cadastradas. Na primeira busca, será necessário baixar o recurso de imagens; mantenha esta tela aberta.</p>
      <p class="price-status" id="priceStatus" role="status" aria-live="polite"></p>
      <button class="btn ghost" type="button" id="priceCancel" hidden>Cancelar pesquisa por foto</button>
    </article>
    <div id="priceResults" class="price-results"></div>
    <button id="priceMore" class="btn ghost price-more" type="button" hidden>Mostrar mais produtos</button>`;
  $('#page-home').parentElement.append(page);
  const nav = document.createElement('button');
  nav.dataset.page = nav.dataset.feature = 'prices';
  nav.innerHTML = '<span>' + uiIcon('products') + '</span><span class="nav-label">Consultar preços</span>';
  $('#mainNav').append(nav);
  mobilePages.push(['prices', 'Consultar preços']);

  const priorFeature = hasFeature;
  hasFeature = function (feature) {
    if (feature === 'prices') return !!state.profile && ['products', 'sales', 'field'].some(f => priorFeature(f));
    return priorFeature(feature);
  };
  const priorNavigation = mobileNavigation;
  mobileNavigation = function () {
    priorNavigation();
    // Keep the main mobile actions legible; lookup is in the menu and home shortcut.
    $('.bottom-nav [data-page="prices"]')?.remove();
    const bottom = $('.bottom-nav');
    bottom.style.gridTemplateColumns = 'repeat(' + bottom.children.length + ',1fr)';
  };
  const priorGo = go;
  go = function (target) {
    if (target !== 'prices') cancelPhoto();
    const result = priorGo(target);
    if (state.currentPage === 'prices' && hasFeature('prices')) render();
    return result;
  };
  const priorRenderHome = renderHome;
  renderHome = function () {
    priorRenderHome();
    let shortcut = $('#priceHomeShortcut');
    if (!shortcut) {
      shortcut = document.createElement('article');
      shortcut.id = 'priceHomeShortcut';
      shortcut.className = 'panel price-home-shortcut';
      shortcut.innerHTML = '<div><b>Consultar preços</b><p>Nome, código ou foto do produto.</p></div><button type="button" class="btn primary" data-go="prices">Consultar</button>';
      const previous = $('#mobileHomeSales') || $('#page-home .page-head');
      previous.after(shortcut);
    }
    shortcut.hidden = !hasFeature('prices');
  };
  const priorLoadAll = loadAll;
  loadAll = async function () {
    await priorLoadAll();
    if (state.currentPage === 'prices') { cancelPhoto(); render(); }
  };
  const priorLogout = logout;
  logout = async function () {
    resetPhoto(); vectors.clear(); cacheOwner = '';
    $('#priceQuery').value = ''; $('#priceResults').replaceChildren();
    return priorLogout();
  };

  const normalize = value => String(value ?? '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const catalog = () => hasFeature('prices') ? state.products.filter(p => p.active !== false) : [];
  const price = p => p.sale_price !== null && p.sale_price !== '' && Number.isFinite(Number(p.sale_price))
    ? money(p.sale_price) : 'Preço não informado';
  const owner = () => (state.profile?.company_id || '') + ':' + (state.profile?.id || '');
  function status(message) { $('#priceStatus').textContent = message; }
  function cancelPhoto() {
    const running = !$('#priceCancel').hidden;
    job++; $('#priceCancel').hidden = true;
    if (running) status('Pesquisa por foto interrompida. Escolha a foto novamente para pesquisar.');
  }
  function resetPhoto() {
    cancelPhoto(); mode = 'text'; photoMatches = [];
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = ''; $('#pricePhoto').removeAttribute('src'); $('#pricePhotoPreview').hidden = true;
  }
  function showProducts(products) {
    const root = $('#priceResults'); root.replaceChildren();
    products.forEach(p => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'price-result';
      const src = safeImage(p.image_url);
      button.innerHTML = (src ? '<img loading="lazy" alt="" src="' + esc(src) + '">' : '<span class="price-result-placeholder" aria-hidden="true">▦</span>') +
        '<span class="price-result-copy"><small>Código ' + esc(p.code || '—') + '</small><b>' + esc(p.name) + '</b><small>' + esc([p.brand, p.unit || 'UN'].filter(Boolean).join(' • ')) + '</small><strong>' + esc(price(p)) + '</strong></span>';
      button.onclick = () => detail(p.id);
      root.append(button);
    });
  }
  function render() {
    if (!hasFeature('prices')) { $('#priceResults').replaceChildren(); status('Seu perfil não tem acesso à consulta de preços.'); return; }
    if (mode === 'photo') {
      const ids = new Set(photoMatches);
      const current = new Map(catalog().filter(p => ids.has(p.id)).map(p => [p.id, p]));
      showProducts(photoMatches.map(id => current.get(id)).filter(Boolean));
      $('#priceMore').hidden = true; return;
    }
    const term = normalize($('#priceQuery').value.trim());
    if (!term) { showProducts([]); $('#priceMore').hidden = true; status('Digite o nome ou código, ou escolha uma foto para consultar.'); return; }
    const terms = term.split(/\s+/);
    const matches = catalog().filter(p => terms.every(t => normalize([p.name, p.code].join(' ')).includes(t)));
    matches.sort((a, b) => Number(normalize(b.code) === term) - Number(normalize(a.code) === term) || String(a.name).localeCompare(String(b.name), 'pt-BR'));
    showProducts(matches.slice(0, limit));
    $('#priceMore').hidden = matches.length <= limit;
    status(matches.length ? matches.length + ' produto(s) encontrado(s). Toque para conferir o preço.' : 'Nenhum produto encontrado. Confira o nome ou código.');
  }
  function detail(id) {
    const p = catalog().find(p => p.id === id); if (!p) { render(); return; }
    const src = safeImage(p.image_url);
    showModal(modalHead(p.name, 'Confira o código, a medida e a embalagem.') +
      (src ? '<img class="price-detail-image" src="' + esc(src) + '" alt="Foto do produto cadastrado">' : '') +
      '<div class="price-detail-value">' + esc(price(p)) + '</div><dl class="price-detail-meta">' +
      [['Código', p.code || '—'], ['Unidade', p.unit || 'UN'], ['Marca', p.brand || '—'], ['Descrição', p.description || '—']].map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('') +
      '</dl><p class="help">Preço de venda do cadastro carregado no sistema.</p><div class="actions"><button type="button" class="btn primary" data-close-modal>Voltar à consulta</button></div>');
  }
  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => { script.remove(); reject(Error('O recurso de fotos demorou para carregar. Verifique a conexão e tente novamente.')); }, 45000);
      script.src = src; script.crossOrigin = 'anonymous';
      script.onload = () => { clearTimeout(timer); ready() ? resolve() : reject(Error('Não foi possível iniciar a busca por foto.')); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(Error('Não foi possível baixar o recurso de fotos. Verifique a conexão ou pesquise pelo nome/código.')); };
      document.head.append(script);
    });
  }
  async function model() {
    if (!modelPromise) modelPromise = (async () => {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js', () => !!window.tf);
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js', () => !!window.mobilenet);
      await tf.ready();
      // Official GraphModel used by TensorFlow.js' MobileNet converter demo.
      // A direct URL avoids the TF Hub / Kaggle redirect chain.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      try {
        const source = tf.io.browserHTTPRequest('https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/model.json', { requestInit: { signal: controller.signal } });
        return await mobilenet.load({ version: 2, alpha: 1, modelUrl: source, inputRange: [-1, 1] });
      } catch {
        throw Error('Não foi possível baixar o modelo de imagens. Verifique a conexão e tente novamente, ou pesquise pelo nome/código.');
      } finally { clearTimeout(timer); }
    })().catch(error => { modelPromise = undefined; throw error; });
    return modelPromise;
  }
  function image(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => { img.src = ''; reject(Error('Não foi possível carregar uma das imagens.')); }, 12000);
      if (/^https:/i.test(source)) img.crossOrigin = 'anonymous';
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(Error('Imagem inválida ou indisponível.')); };
      img.src = source;
    });
  }
  async function embedding(network, img) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 224;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 224, 224);
    const scale = Math.min(224 / img.naturalWidth, 224 / img.naturalHeight);
    const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
    ctx.drawImage(img, (224 - width) / 2, (224 - height) / 2, width, height);
    const tensor = network.infer(canvas, true);
    try {
      const data = Float32Array.from(await tensor.data());
      const norm = Math.hypot(...data);
      if (!norm || !Number.isFinite(norm)) throw Error('Não foi possível comparar esta imagem.');
      return data.map(n => n / norm);
    } finally { tensor.dispose(); }
  }
  function selectPhotoMatches(scored) {
    // A ranked list alone always has a first item, even for unrelated photos.
    // These conservative gates are retrieval limits, not calibrated confidence.
    const ranked = scored.filter(item => Number.isFinite(item.score) && item.score >= 0 && item.score <= 1.00001)
      .sort((a, b) => b.score - a.score);
    const best = ranked[0]?.score;
    if (best === undefined || best < 0.80) return [];
    // If the stored photo is effectively identical, don't pad its result with
    // weaker pictures. Otherwise only keep a small cluster near the best match.
    const minimum = best >= 0.985 ? Math.max(0.985, best - 0.015) : Math.max(0.80, best - 0.06);
    return ranked.filter(item => item.score >= minimum).slice(0, 4).map(item => item.id);
  }
  async function searchPhoto(file) {
    if (!file) return;
    resetPhoto(); $('#priceQuery').value = ''; limit = 20;
    const token = job, context = owner();
    const valid = () => token === job && owner() === context && hasFeature('prices') && state.currentPage === 'prices';
    if (!hasFeature('prices')) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      render(); status('Escolha uma foto JPG, PNG ou WebP de até 15 MB.'); return;
    }
    const products = catalog().filter(p => safeImage(p.image_url));
    if (!products.length) { render(); status('Ainda não há produtos com foto cadastrada. Pesquise pelo nome ou código.'); return; }
    mode = 'photo'; showProducts([]); $('#priceMore').hidden = true;
    photoURL = URL.createObjectURL(file); $('#pricePhoto').src = photoURL; $('#pricePhotoPreview').hidden = false;
    $('#priceCancel').hidden = false;
    status('Preparando a busca por foto. A primeira vez pode demorar um pouco...');
    try {
      const queryImage = await image(photoURL);
      if (!valid()) return;
      const network = await model();
      if (!valid()) return;
      const query = await embedding(network, queryImage);
      if (!valid()) return;
      if (cacheOwner !== context) { vectors.clear(); cacheOwner = context; }
      const scored = []; let failed = 0;
      for (let index = 0; index < products.length; index++) {
        if (!valid()) return;
        const p = products[index], url = safeImage(p.image_url);
        status('Comparando fotos: ' + (index + 1) + ' de ' + products.length + '. Você pode cancelar a qualquer momento.');
        try {
          let cached = vectors.get(p.id);
          if (!cached || cached.url !== url) {
            const vector = await embedding(network, await image(url));
            if (!valid()) return;
            cached = { url, vector }; vectors.set(p.id, cached);
            if (vectors.size > 500) vectors.delete(vectors.keys().next().value);
          }
          const score = query.reduce((sum, value, i) => sum + value * cached.vector[i], 0);
          scored.push({ id: p.id, score });
        } catch { failed++; }
        await tf.nextFrame();
      }
      if (!valid()) return;
      photoMatches = selectPhotoMatches(scored);
      render();
      const unavailable = failed ? ' ' + failed + ' foto(s) do cadastro não puderam ser comparadas.' : '';
      status(photoMatches.length
        ? photoMatches.length + ' produto(s) com foto semelhante. Confira o código, a medida e a embalagem antes de escolher.' + unavailable
        : scored.length
          ? 'Nenhum produto com semelhança suficiente foi encontrado. Fotografe mais de perto, com o produto inteiro e fundo simples, ou pesquise pelo nome/código.' + unavailable
          : 'Não foi possível comparar as fotos cadastradas. Pesquise pelo nome/código ou tente outra foto.');
    } catch (error) {
      if (valid()) status(error.message || 'Não foi possível pesquisar esta foto. Tente novamente ou use o nome/código.');
    } finally { if (token === job) $('#priceCancel').hidden = true; }
  }
  $('#priceQuery').oninput = () => { resetPhoto(); limit = 20; render(); };
  $('#priceMore').onclick = () => { limit += 20; render(); };
  $('#priceCamera').onclick = () => $('#priceCameraFile').click();
  $('#priceGallery').onclick = () => $('#priceGalleryFile').click();
  ['priceCameraFile', 'priceGalleryFile'].forEach(id => {
    $('#' + id).onchange = event => { const file = event.target.files[0]; event.target.value = ''; searchPhoto(file); };
  });
  $('#priceClearPhoto').onclick = () => { resetPhoto(); render(); };
  $('#priceCancel').onclick = () => { resetPhoto(); render(); status('Pesquisa por foto cancelada. Você pode buscar pelo nome ou código.'); };
  render();
  if (state.profile) { refreshNavigation(); renderHome(); }
})();

