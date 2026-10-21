/* Unit prices are display-only; changing a sale price requires the item's pencil. */
(() => {
  'use strict';
  const pencil='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5L9 20l-6 1 1-6L16 3Z"/><path d="m13 6 5 5"/></svg>';
  function lockPriceDisplays(){
    const price=document.getElementById('posEntryPrice');
    if(price&&price.tagName!=='OUTPUT'){
      const output=document.createElement('output');output.id='posEntryPrice';output.value=price.value||money(0);output.setAttribute('aria-label','Preço unitário do cadastro');price.replaceWith(output);
    }
    const total=document.getElementById('posEntryTotal');if(total)total.contentEditable='false';
    document.querySelectorAll('#posCartLines [data-pos-field="unit_price"]').forEach(input=>{
      const index=Number(input.dataset.posIndex),item=posCart[index];if(!item)return;
      const output=document.createElement('output');output.dataset.posPriceIndex=String(index);output.textContent=money(item.unit_price);output.setAttribute('aria-label','Preço unitário do item '+(index+1));input.replaceWith(output);
    });
    document.querySelectorAll('#posCartLines tr.pos-cart-line').forEach((row,index)=>{
      if(row.querySelector('[data-pos-edit-price]'))return;
      const button=document.createElement('button');button.type='button';button.className='btn ghost pos-price-pencil';button.dataset.posEditPrice=String(index);button.setAttribute('aria-label','Editar preço do item '+(index+1));button.title='Editar preço do item '+(index+1);button.innerHTML=pencil;button.onclick=()=>editPrice(index);row.cells[0]?.append(button);
    });
  }
  function editPrice(index){
    const item=posCart[index];if(!item)return;
    const product=state.products.find(p=>p.id===item.product_id);
    showModal(modalHead('Editar preço do item '+(index+1),product?.name||'Produto da venda')+
      '<p>Preço atual: <b>'+money(item.unit_price)+'</b></p><label>Novo preço unitário (R$)<input id="posPriceEditValue" type="number" min="0" step="0.01" value="'+Number(item.unit_price)+'" inputmode="decimal" required></label>'+
      '<p class="help">A alteração vale para este item da venda. O preço cadastrado do produto permanece igual.</p><p id="posPriceEditStatus" role="status" aria-live="polite"></p><div class="actions"><button type="button" class="btn ghost" data-close-modal>Cancelar</button><button type="button" class="btn primary" id="posPriceEditSave">Salvar preço</button></div>');
    const input=document.getElementById('posPriceEditValue');
    document.getElementById('posPriceEditSave').onclick=()=>{
      const value=input.value.trim(),price=Number(value),status=document.getElementById('posPriceEditStatus');
      if(!value||!Number.isFinite(price)||price<0){status.textContent='Informe um preço válido, maior ou igual a zero.';input.focus();return;}
      if(posCart[index]!==item){status.textContent='A lista de itens mudou. Feche esta janela e abra o lápis do item novamente.';return;}
      const rounded=Math.round(price*100)/100;
      if(!Number.isFinite(rounded)||!Number.isFinite(rounded*Number(item.quantity))){status.textContent='Informe um preço válido para a quantidade deste item.';input.focus();return;}
      if(Number(item.discount||0)>rounded*Number(item.quantity)){status.textContent='O novo preço deixa o desconto maior que o total do item. Ajuste o desconto antes de alterar o preço.';input.focus();return;}
      item.unit_price=rounded;closeModal();renderPOSCart();toast('Preço do item atualizado.');
    };
    input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();document.getElementById('posPriceEditSave').click();}if(event.key==='Escape'){event.preventDefault();closeModal();}};
    input.focus();input.select();
  }
  const cartBeforePriceEdit=renderPOSCart;
  renderPOSCart=function(...args){const result=cartBeforePriceEdit.apply(this,args);lockPriceDisplays();return result;};
  const posBeforePriceEdit=renderPOS;
  renderPOS=function(...args){const result=posBeforePriceEdit.apply(this,args);lockPriceDisplays();return result;};
  const style=document.createElement('style');style.textContent='#posEntryPrice{display:block;background:#f7f9fd;border:1px solid var(--line);border-radius:6px;padding:11px 12px;min-height:42px;color:var(--text);font-weight:650}#posCartLines [data-pos-price-index]{display:block;min-width:105px;padding:9px;color:var(--text);font-weight:650}#posCartLines td:first-child{white-space:nowrap}.pos-price-pencil{display:inline-flex;align-items:center;justify-content:center;width:30px;min-height:30px;padding:5px!important;margin-left:6px;vertical-align:middle}.pos-price-pencil:focus-visible{outline:2px solid #00874b;outline-offset:2px}#posPriceEditStatus{color:#a72a25;font-size:13px}';document.head.append(style);
  lockPriceDisplays();
})();
