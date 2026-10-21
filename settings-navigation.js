/* Settings tabs reuse existing forms, permissions and event handlers. */
(() => {
  'use strict';
  const settingsPage=document.getElementById('page-settings');
  const teamPage=document.getElementById('page-team');
  if(!settingsPage||!teamPage)return;
  const access=hasFeature;
  const viewport=window.matchMedia('(max-width:760px)');
  const phone=()=>typeof mobileMode!=='undefined'?mobileMode.matches:viewport.matches;
  const definitions=[
    ['company','Empresa','settings-company-panel',()=>access('settings')],
    ['team','Equipe','settings-team-panel',()=>access('team')],
    ['roles','Funções','settings-roles-panel',()=>access('team')],
    ['discounts','Descontos e autorizações','discountAdminSettings',()=>access('settings')&&isDiscountManager()],
    ['documents','Documentos','documentLayoutSettings',()=>access('settings')&&cashManager()],
    ['system','Sistema','settings-system-panel',()=>access('settings')||access('team')]
  ];
  let activeTab='company';
  const available=()=>definitions.filter(([, , ,allowed])=>!!state.profile&&allowed());
  const teamTab=key=>key==='team'||key==='roles';
  const findNav=page=>page.querySelector(':scope > .settings-tabs');
  function identifyPanels(){
    const company=document.getElementById('companyName')?.closest('article');
    if(company)company.id='settings-company-panel';
    const system=Array.from(settingsPage.querySelectorAll(':scope > article')).find(card=>!card.id);
    if(system)system.id='settings-system-panel';
    const team=document.getElementById('teamList')?.closest('article');
    const roles=document.getElementById('rolesList')?.closest('article');
    if(team)team.id='settings-team-panel';
    if(roles)roles.id='settings-roles-panel';
    for(const page of [settingsPage,teamPage]){
      const head=page.querySelector(':scope > .page-head');
      if(!head)continue;
      if(page.firstElementChild!==head)page.prepend(head);
      let nav=findNav(page);
      if(!nav){nav=document.createElement('nav');nav.className='settings-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Seções dos ajustes');head.after(nav);}
      else if(head.nextElementSibling!==nav)head.after(nav);
    }
  }
  function drawTabs(){
    identifyPanels();
    const allowed=available();
    if(!allowed.some(([key])=>key===activeTab))activeTab=allowed[0]?.[0]||'company';
    for(const page of [settingsPage,teamPage]){
      const nav=findNav(page);if(!nav)continue;
      const signature=allowed.map(([key])=>key).join(',');
      if(nav.dataset.tabs!==signature){
        nav.dataset.tabs=signature;
        nav.innerHTML=allowed.map(([key,label,panel])=>'<button type="button" role="tab" data-settings-tab="'+key+'" aria-controls="'+panel+'">'+label+'</button>').join('');
        nav.querySelectorAll('[data-settings-tab]').forEach(button=>{
          button.onclick=()=>selectTab(button.dataset.settingsTab);
          button.onkeydown=event=>{
            if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
            event.preventDefault();const buttons=Array.from(nav.querySelectorAll('button'));
            const index=buttons.indexOf(button),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
            const key=buttons[next].dataset.settingsTab;selectTab(key);
            const current=teamTab(key)?teamPage:settingsPage;findNav(current)?.querySelector('[data-settings-tab="'+key+'"]').focus();
          };
        });
      }
      nav.querySelectorAll('button').forEach(button=>{
        const selected=button.dataset.settingsTab===activeTab;
        button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
      });
    }
    for(const [key,,id] of definitions){const panel=document.getElementById(id);if(panel){panel.hidden=key!==activeTab;panel.setAttribute('role','tabpanel');}}
    const teamHeading=teamPage.querySelector('.page-head h2');if(teamHeading)teamHeading.textContent='Ajustes';
    const teamHint=teamPage.querySelector('.page-head p');if(teamHint)teamHint.textContent='Equipe, funções e permissões.';
    const reset=document.getElementById('resetRequestPanel');if(reset)reset.hidden=activeTab!=='team';
    const employeeButton=teamPage.querySelector('[data-new-employee]');if(employeeButton)employeeButton.hidden=activeTab!=='team';
    const roleButton=teamPage.querySelector('[data-new-role]');if(roleButton)roleButton.hidden=activeTab!=='roles';
    // Team stays in its existing route so all feature checks and deep links remain valid.
    const isSettings=state.currentPage==='settings'||state.currentPage==='team';
    document.querySelectorAll('#mainNav [data-page="settings"]').forEach(link=>link.classList.toggle('active',isSettings));
    document.querySelectorAll('#mainNav [data-page="team"]').forEach(link=>link.classList.remove('active'));
  }
  function navigation(){
    const nav=document.getElementById('mainNav');
    if(!nav)return;
    nav.querySelectorAll('[data-page="team"]').forEach(link=>{link.hidden=true;});
    const settings=nav.querySelector('[data-page="settings"]');if(settings)settings.hidden=!(access('settings')||access('team'));
    const cash=nav.querySelector('[data-page="cash"]'),prices=nav.querySelector('[data-page="prices"]');
    if(cash&&prices&&cash.nextElementSibling!==prices)cash.after(prices);
    nav.querySelectorAll('[data-page="field"]').forEach(link=>{link.hidden=!phone()||!access('field');});
    const menu=document.getElementById('mobileMenuGrid');
    menu?.querySelectorAll('[data-go="team"]').forEach(link=>link.remove());
    if(menu&&(access('settings')||access('team'))&&!menu.querySelector('[data-go="settings"]')){const button=document.createElement('button');button.dataset.go='settings';button.textContent='Ajustes';menu.append(button);}
    const mobileCash=menu?.querySelector('[data-go="cash"]'),mobilePrices=menu?.querySelector('[data-go="prices"]');if(mobileCash&&mobilePrices)mobileCash.after(mobilePrices);
    if(!phone())menu?.querySelectorAll('[data-go="field"]').forEach(link=>link.remove());
    const bottom=document.querySelector('.bottom-nav');
    bottom?.querySelectorAll('[data-page="more"]').forEach(link=>link.remove());
    const icons={notes:'<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M8 3v18M3 7h4M3 12h4M3 17h4M11 8h6M11 12h6M11 16h4"/>',credit:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M7 15h4M15 15h2"/>'};
    for(const [key,paths] of Object.entries(icons)){const link=bottom?.querySelector('[data-page="'+key+'"]');if(link)link.innerHTML='<svg class="nav-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg><span>'+(key==='notes'?'Notas':'Crediário')+'</span>';}
    if(bottom)bottom.style.gridTemplateColumns='repeat('+bottom.children.length+',minmax(0,1fr))';
    const quick=document.getElementById('homeQuick');if(quick)quick.hidden=true;
    drawTabs();
  }
  const beforeGo=go;
  function selectTab(key){
    if(!available().some(([id])=>id===key))return;
    activeTab=key;
    beforeGo(teamTab(key)?'team':'settings');
    navigation();
  }
  go=function(page){
    if(page==='field'&&!phone()){toast('Campo está disponível na versão para celular.');return beforeGo('home');}
    if(page==='settings'||page==='team'){
      const allowed=available();
      let key=page==='team'?(activeTab==='roles'?'roles':'team'):activeTab;
      if(!allowed.some(([id])=>id===key))key=allowed[0]?.[0];
      if(key)return selectTab(key);
    }
    const result=beforeGo(page);navigation();return result;
  };
  const beforeRefresh=refreshNavigation;
  refreshNavigation=function(...args){const result=beforeRefresh.apply(this,args);navigation();return result;};
  const beforeMobile=mobileNavigation;
  mobileNavigation=function(...args){const result=beforeMobile.apply(this,args);navigation();return result;};
  const beforeSettings=renderSettings;
  renderSettings=function(...args){const result=beforeSettings.apply(this,args);drawTabs();return result;};
  const beforeTeam=renderTeam;
  renderTeam=function(...args){const result=beforeTeam.apply(this,args);drawTabs();return result;};
  const beforeDiscounts=discountAdminButtons;
  discountAdminButtons=function(...args){const result=beforeDiscounts.apply(this,args);drawTabs();return result;};
  const beforeReset=renderResetRequests;
  renderResetRequests=function(...args){const result=beforeReset.apply(this,args);drawTabs();return result;};
  const beforeHome=renderHome;
  renderHome=function(...args){const result=beforeHome.apply(this,args);const quick=document.getElementById('homeQuick');if(quick)quick.hidden=true;return result;};
  const style=document.createElement('style');style.id='settings-navigation-style';style.textContent=`
    #homeQuick,#mainNav [data-page="team"],.bottom-nav [data-page="more"],#mainNav [hidden]{display:none!important}
    .settings-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px;padding:4px 0;align-items:center}
    .settings-tabs button{padding:10px 15px;min-height:42px;border:1px solid #d8e3ee;border-radius:8px;background:#fff;color:#334960;font-weight:650;cursor:pointer}
    .settings-tabs button.active{background:#00874b;border-color:#00874b;color:white}
    .settings-tabs button:focus-visible{outline:3px solid #91cbb1;outline-offset:2px}
    #page-settings [role="tabpanel"][hidden],#page-team [role="tabpanel"][hidden],#page-team [hidden]{display:none!important}
    #page-team .team-grid{grid-template-columns:minmax(0,1fr)}
    #page-settings>.page-head,#page-team>.page-head{margin-top:0}
    #mainNav [data-page="prices"]{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border:0;border-left:3px solid transparent;border-radius:8px;background:transparent;color:inherit;text-align:left;font-size:14px;font-weight:650;cursor:pointer;box-shadow:none}
    #mainNav [data-page="prices"]:hover{background:#ffffff12}
    #mainNav [data-page="prices"].active{background:#ffffff15;border-left-color:#9bdd2d}
    @media(min-width:761px){#mainNav [data-page="field"]{display:none!important}}
    @media(max-width:760px){.settings-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:10px}.settings-tabs button{white-space:nowrap;flex-shrink:0}}
  `;document.head.append(style);
  viewport.addEventListener('change',navigation);
  navigation();
})();
