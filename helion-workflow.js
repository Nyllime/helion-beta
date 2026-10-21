/* Workflows arranged as separate steps, following the Helion screen references. */
(() => {
  const openDocumentBase = workspacePreviousOpen;
  const operationActionBase = operationAction;
  let budgetContext = null;

  const todayPlusDays = days => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  function budgetStart(context = {}) {
    const record = context.record || (context.id ? state.budgets.find(row => row.id === context.id) : null) || {};
    const clientId = context.client_id ?? record.client_id ?? '';
    const sellerId = context.seller_id ?? record.seller_id ?? state.profile.id;
    const valid = context.valid_until ?? record.valid_until ?? todayPlusDays(7);
    const discount = context.discount ?? record.commercial_percent ?? record.commercial_discount ?? 0;
    const notes = context.notes ?? record.notes ?? '';
    budgetContext = { ...context, client_id: clientId, seller_id: sellerId, valid_until: valid, discount, notes };

    showModal(
      modalHead(context.id ? 'Dados do orçamento' : 'Novo orçamento', 'Informe o responsável e a validade. O cliente é opcional; os materiais entram na próxima etapa.') +
      '<div class="budget-stepper" aria-label="Etapas do orçamento"><span class="current">1&nbsp; Dados</span><span>2&nbsp; Materiais</span><span>3&nbsp; Revisão</span></div>' +
      '<section class="budget-step-card"><h3>Identificação</h3><div class="form-grid">' +
      '<label>Cliente (opcional)<select id="budgetStartClient">' + clientOptions() + '</select></label>' +
      '<label>Responsável<select id="budgetStartSeller">' + employeeOptions('budgets', sellerId) + '</select></label>' +
      '<label>Validade da proposta<input id="budgetStartValid" type="date"></label>' +
      '</div><p class="help">O cliente é opcional. Registre responsável e validade; o orçamento não movimenta o estoque.</p></section>' +
      '<div class="actions"><button id="budgetStartContinue" class="btn primary">Continuar para materiais →</button></div>'
    );
    $('#budgetStartClient').value = clientId;
    $('#budgetStartSeller').value = sellerId;
    $('#budgetStartValid').value = valid;
    $('#budgetStartContinue').onclick = () => {
      const client = $('#budgetStartClient').value;
      const seller = $('#budgetStartSeller').value;
      const validUntil = $('#budgetStartValid').value;
      if (!seller || !validUntil) {
        toast('Informe o responsável e a validade. O cliente é opcional.');
        return;
      }
      budgetContext = { ...budgetContext, client_id: client, seller_id: seller, valid_until: validUntil };
      openBudgetMaterials(budgetContext, context.items ? { items: context.items } : {});
    };
  }

  function budgetStepHeader(active, context) {
    const client = clientName(context.client_id) || 'Sem cliente';
    const seller = employeeName(context.seller_id) || 'Responsável';
    const step = '<div class="budget-stepper" aria-label="Etapas do orçamento"><span class="' + (active === 1 ? 'current' : 'done') + '">1&nbsp; Dados</span><span class="' + (active === 2 ? 'current' : active === 3 ? 'done' : '') + '">2&nbsp; Materiais</span><span class="' + (active === 3 ? 'current' : '') + '">3&nbsp; Revisão</span></div>';
    const header = '<div class="budget-identity"><div><small>Cliente</small><b>' + esc(client) + '</b></div><div><small>Responsável</small><b>' + esc(seller) + '</b></div><div><small>Validade</small><b>' + fmtDate(context.valid_until) + '</b></div><button id="budgetEditIdentity" class="btn ghost" type="button">✎ Editar dados</button></div>';
    return step + header;
  }

  function collectBudgetDraft() {
    return {
      client_id: $('#docClient') ? ($('#docClient').value || '') : (budgetContext.client_id || ''),
      seller_id: $('#docSeller')?.value || budgetContext.seller_id,
      valid_until: $('#docValid')?.value || budgetContext.valid_until,
      discount: Number($('#docDiscount')?.value ?? budgetContext.discount ?? 0),
      notes: $('#docNotes')?.value ?? budgetContext.notes ?? '',
      items: typeof docGetRows === 'function' ? docGetRows() : budgetContext.items || []
    };
  }

  function openBudgetMaterials(context, draft = {}) {
    budgetContext = { ...context, ...draft, items: draft.items ?? context.items };
    openDocumentBase('budget', context.id || null, !!context.copy, context.sourceBudget || null);
    const modal = $('#docClient')?.closest('.modal');
    if (!modal) return;

    $('#docClient').value = context.client_id || '';
    $('#docSeller').value = context.seller_id || state.profile.id;
    $('#docValid').value = context.valid_until || todayPlusDays(7);
    $('#docDiscount').value = Number(draft.discount ?? context.discount ?? 0);
    $('#docNotes').value = draft.notes ?? context.notes ?? '';
    if (draft.items) docReplaceRows(draft.items.length?draft.items:[{}]);
    else docWire();

    const form = modal.querySelector('.form-grid');
    if (form) form.hidden = true;
    const summary = modal.querySelector('.doc-summary');
    if (summary) summary.hidden = true;
    const title = modal.querySelector('.modal-head h3');
    if (title) title.textContent = context.id ? 'Editar orçamento • Materiais' : 'Novo orçamento • Materiais';
    modal.querySelector('.modal-head')?.insertAdjacentHTML('afterend', budgetStepHeader(2, budgetContext));
    $('#budgetEditIdentity').onclick = () => budgetStart({ ...budgetContext, ...collectBudgetDraft() });

    const actions = modal.querySelector('.actions');
    if (actions) actions.innerHTML = '<button id="budgetBackIdentity" class="btn ghost">← Voltar aos dados</button><button id="budgetReviewButton" class="btn primary">Continuar para revisão →</button>';
    $('#budgetBackIdentity').onclick = () => budgetStart({ ...budgetContext, ...collectBudgetDraft() });
    $('#budgetReviewButton').onclick = () => budgetReview({ ...budgetContext, ...collectBudgetDraft() });
  }

  function budgetReview(context) {
    budgetContext = { ...context };
    openDocumentBase('budget', context.id || null, !!context.copy, context.sourceBudget || null);
    const modal = $('#docClient')?.closest('.modal');
    if (!modal) return;
    $('#docClient').value = context.client_id || '';
    $('#docSeller').value = context.seller_id || state.profile.id;
    $('#docValid').value = context.valid_until || todayPlusDays(7);
    $('#docDiscount').value = Number(context.discount || 0);
    $('#docNotes').value = context.notes || '';
    if (context.items?.length) docReplaceRows(context.items);

    const form = modal.querySelector('.form-grid');
    const lines = $('#docLines');
    const materialActions = modal.querySelector('.doc-actions');
    const oldSummary = modal.querySelector('.doc-summary');
    if (form) form.hidden = true;
    if (lines) lines.hidden = true;
    modal.querySelectorAll('.doc-actions').forEach(actions => { actions.hidden = true; });
    if (oldSummary) oldSummary.remove();
    const title = modal.querySelector('.modal-head h3');
    if (title) title.textContent = 'Revisar orçamento';
    modal.querySelector('.modal-head')?.insertAdjacentHTML('afterend', budgetStepHeader(3, context));

    const tableRows = (context.items || []).map((item, index) => {
      const product = state.products.find(row => row.id === item.product_id);
      const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0) - Number(item.discount || 0);
      return '<tr><td>' + (index + 1) + '</td><td>' + esc(product?.code || '') + '</td><td>' + esc(product?.name || item.description || 'Produto') + '</td><td>' + Number(item.quantity || 0) + ' ' + esc(item.unit || product?.unit || '') + '</td><td>' + money(item.unit_price) + '</td><td>' + money(item.discount) + '</td><td>' + money(lineTotal) + '</td></tr>';
    }).join('');
    const review = document.createElement('section');
    review.className = 'budget-review';
    review.innerHTML = '<div class="budget-review-head"><div><h3>Confira os materiais e valores</h3><p>Revise a proposta antes de salvar.</p></div><button id="budgetBackMaterials" class="btn ghost">Editar materiais</button></div>' +
      '<div class="table-wrap keep-table"><table><thead><tr><th>Item</th><th>Código</th><th>Produto</th><th>Quantidade</th><th>Preço unit.</th><th>Desconto</th><th>Total</th></tr></thead><tbody>' + (tableRows || '<tr><td colspan="7">Nenhum material incluído.</td></tr>') + '</tbody></table></div>' +
      '<div class="budget-review-controls"><div id="budgetDiscountMount"></div><div id="budgetNotesMount"></div></div>' +
      '<div class="doc-summary budget-review-total"><div>Subtotal <b id="docSubtotal"></b></div><div>Desconto geral <b id="budgetReviewDiscount"></b></div><div>Total negociado <b id="docTotal"></b></div></div>' +
      '<p class="help">O orçamento é uma proposta comercial. O estoque só muda quando a venda/saída correspondente for registrada.</p>';
    const actions = modal.querySelector('.actions');
    if (actions) actions.replaceWith(review);
    else modal.append(review);

    const discountLabel = $('#docDiscount')?.closest('label');
    const notesLabel = $('#docNotes')?.closest('label');
    if (discountLabel) $('#budgetDiscountMount').append(discountLabel);
    if (notesLabel) $('#budgetNotesMount').append(notesLabel);
    $('#budgetReviewDiscount').textContent = money(Number($('#docDiscount').value || 0));
    $('#docSubtotal').textContent = money((context.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0));
    $('#docTotal').textContent = money(Math.max(0, Number(docCalc())));
    $('#docDiscount').oninput = () => {
      $('#budgetReviewDiscount').textContent = money(Number($('#docDiscount').value || 0));
      docCalc();
    };
    $('#budgetEditIdentity').onclick = () => budgetStart({ ...context, ...collectBudgetDraft() });
    $('#budgetBackMaterials').onclick = () => openBudgetMaterials(context, collectBudgetDraft());
    review.insertAdjacentHTML('afterend', '<div class="actions"><button id="budgetReviewBack" class="btn ghost">← Voltar aos materiais</button><button id="budgetSaveFinal" class="btn primary">Salvar orçamento</button></div>');
    $('#budgetReviewBack').onclick = () => openBudgetMaterials(context, { items: context.items, discount: Number($('#docDiscount').value || 0), notes: $('#docNotes').value });
    $('#budgetSaveFinal').onclick = saveDocument;
  }

  openDocument = function (kind, id = null, copy = false, sourceBudget = null) {
    if (kind !== 'budget') return openProjectWorkspace(kind, id, copy, sourceBudget);
    const record = state.budgets.find(row => row.id === id) || {};
    if(record.workspace?.version===1)return openProjectWorkspace('budget',id,copy,sourceBudget);
    const source = sourceBudget ? state.budgets.find(row => row.id === sourceBudget) : null;
    const items = source ? docRowsFor('budget', source.id) : id ? docRowsFor('budget', id) : [];
    return budgetStart({
      id: copy ? null : id,
      copy,
      sourceBudget,
      record,
      client_id: record.client_id || source?.client_id || '',
      seller_id: record.seller_id || source?.seller_id || state.profile.id,
      valid_until: record.valid_until || source?.valid_until || todayPlusDays(7),
      discount: record.commercial_percent ?? record.commercial_discount ?? source?.commercial_percent ?? 0,
      notes: record.notes || source?.notes || '',
      items
    });
  };
  openBudgetModal = () => openDocument('budget');

  operationAction = function (op, id) {
    if (op === 'budget_edit' || op === 'budget_copy') return openDocument('budget', id, op === 'budget_copy');
    return operationActionBase(op, id);
  };

  // Restore the dedicated irrigation-project flow: identify the project first,
  // then open its saved header and separate material/model/cost sections.
  openProjectModal = () => openProjectWorkspace('project');

  const styles = document.createElement('style');
  styles.textContent = '.budget-stepper{display:flex;gap:8px;flex-wrap:wrap;padding:12px 0}.budget-stepper span{padding:8px 12px;border-radius:999px;background:#f0f3f1;color:#718078;font-size:12px;font-weight:750}.budget-stepper span.current{background:#e0f4e8;color:#087747}.budget-stepper span.done{background:#eff5e6;color:#587b32}.budget-step-card,.budget-review{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:8px 0 14px}.budget-step-card h3,.budget-review h3{margin:0 0 12px;color:var(--green)}.budget-identity{display:grid;grid-template-columns:1.3fr 1fr .8fr auto;gap:12px;align-items:center;background:#f3f8f4;border:1px solid #dce9df;border-radius:12px;padding:12px;margin:0 0 14px}.budget-identity small,.budget-identity b{display:block}.budget-identity small{font-size:11px;color:var(--muted);margin-bottom:4px}.budget-identity b{font-size:13px}.budget-review-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.budget-review-head p{margin:0 0 12px;color:var(--muted);font-size:12px}.budget-review table{min-width:720px}.budget-review-controls{display:grid;grid-template-columns:minmax(180px,.6fr) minmax(280px,1.4fr);gap:12px;margin-top:14px}.budget-review-total{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap}.budget-review-total>div{display:grid;gap:6px}.budget-review-total>div:last-child{color:var(--green);font-size:17px}@media(max-width:760px){.budget-identity{grid-template-columns:1fr 1fr}.budget-identity button{grid-column:1/-1}.budget-review-controls{grid-template-columns:1fr}.budget-review-head{align-items:flex-start;flex-direction:column}}';
  document.head.append(styles);
})();
