'use strict';

const icons = {
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  docs:'<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/><path d="M8 3v5h5M8 13h6M8 17h4"/><path d="M14 2h7v7h-7z"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  warning:'<path d="m10.3 3.6-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.7-2.4l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  circle:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-6"/>',
  edit:'<path d="M12 20h9M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11Z"/>',
  renew:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A8 8 0 0 1 19 7l1 5M4 12l1 5a8 8 0 0 0 13.5-2"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
  x:'<path d="M5 5l14 14M19 5 5 19"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  users:'<circle cx="9" cy="8" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 11h6m-3-3v6"/>',
  activity:'<path d="M3 12h5l3-8 4 16 3-8h3"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  paperclip:'<path d="m21 11-9.6 9.6a6 6 0 0 1-8.5-8.5l10-10a4 4 0 0 1 5.7 5.7L9 17.5a2 2 0 0 1-2.8-2.8L15 6"/>',
  check:'<path d="m5 12 5 5L20 7"/>'
};
function ico(name,cls='') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(value) {return esc(value);}
function localISO(date = new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function addDays(number) {const d = new Date();d.setDate(d.getDate()+number);return localISO(d);}
function dayCount(iso) {
  const [y,m,d] = String(iso).split('-').map(Number);
  const t = new Date();
  return Math.round((Date.UTC(y,m-1,d)-Date.UTC(t.getFullYear(),t.getMonth(),t.getDate()))/86400000);
}
function dateBR(iso) {if (!iso) return '—'; const [y,m,d] = iso.split('-');return `${d}/${m}/${y}`;}
function status(doc) {
  const days=dayCount(doc.expires_on);
  if (days<0) return {type:'red',label:'Vencido',days,short:`${Math.abs(days)}d em atraso`};
  if (days===0) return {type:'red',label:'Vence hoje',days,short:'Hoje'};
  if (days<=Number(doc.lead_days)) return {type:'orange',label:'A vencer',days,short:`${days}d restantes`};
  return {type:'green',label:'Em dia',days,short:`${days}d restantes`};
}
function chip(doc) {const s=status(doc);return `<span class="chip ${s.type}"><span class="dot"></span>${s.label}</span>`;}
function safeError(message) {toast(message,true);}
let state={user:null,csrf:null,documents:[],team:[],audits:[],reports:null,notifications:null,notificationPreview:null,billing:null,platform:null,publicConfig:{signup_enabled:true,recovery_enabled:false},attachments:[],view:'dashboard',authMode:'login',filters:{query:'',status:'all',category:'all'},modal:null,mobileMenu:false};
let toastTimer;
function toast(message,isError=false){const el=document.getElementById('toast');el.textContent=message;el.className='toast show'+(isError?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='toast',3500);}
async function request(url,options={}) {
  const headers={...(options.body ? {'Content-Type':'application/json'} : {}),...(state.csrf ? {'X-CSRF-Token':state.csrf} : {}),...(options.headers || {})};
  let res;
  try {res=await fetch(url,{...options,headers,credentials:'same-origin'});}catch{throw new Error('Não foi possível conectar ao servidor.');}
  let data;try{data=await res.json();}catch{data={};}
  if(!res.ok){if(res.status===401 && !url.includes('/api/login')){state.user=null;state.csrf=null;render();}throw new Error(data.error||'Ocorreu um erro.');}
  return data;
}
async function initialize(){
  try{state.publicConfig=await request('/api/public-config');}catch{}
  try{const data=await request('/api/me');state.user=data.user;state.csrf=data.csrf;await refreshDocs();try{state.billing=await request('/api/billing');}catch{}}
  catch(e){state.user=null;state.csrf=null;}
  render();
}

async function refreshDocs(){const result=await request('/api/documents');state.documents=result.documents;render();}
function brand(){return `<div class="brand"><div class="brand-mark">${ico('clock')}</div><div><div class="brand-name">DocPrazo</div><div class="brand-line">GESTÃO DE VENCIMENTOS</div></div></div>`;}
function renderAuth(){
 const resetToken=new URLSearchParams(location.search).get('reset');
 const mode=resetToken?'reset':state.authMode,signup=mode==='signup'&&state.publicConfig.signup_enabled;
 const recovery=mode==='forgot',reset=mode==='reset';
 const title=reset?'Criar nova senha':recovery?'Recuperar acesso':signup?'Crie sua empresa':'Bem-vindo de volta';
 const form=reset?`<div class="form-group"><label>Nova senha</label><input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password" /></div><button class="btn primary" id="auth-submit" type="submit">Redefinir senha</button>`:
 recovery?`<div class="form-group"><label>E-mail da conta</label><input name="email" type="email" required maxlength="190" /></div><button class="btn primary" id="auth-submit" type="submit">Enviar instruções</button>`:
 `${signup?`<div class="form-group"><label>Empresa</label><input name="organization_name" required maxlength="120" /></div><div class="form-group"><label>Seu nome</label><input name="name" required maxlength="90" /></div>`:''}<div class="form-group"><label>E-mail</label><input name="email" type="email" required maxlength="190" autocomplete="email" /></div><div class="form-group"><label>Senha</label><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="${signup?'new-password':'current-password'}" /></div>${signup?'<p class="hint">14 dias de teste sem cartão, até 50 documentos e 3 usuários.</p>':''}<button class="btn primary" id="auth-submit" type="submit">${signup?'Criar conta':'Entrar no sistema'}</button>`;
 return `<div class="auth-page"><section class="auth-art"><div class="auth-art-inner">${brand()}<h1>Documentos em dia.<br>Gestão sem surpresas.</h1><p>Organize vencimentos e receba avisos com tranquilidade.</p><div class="auth-feature"><span>${ico('calendar')}</span>Vencimentos organizados</div><div class="auth-feature"><span>${ico('bell')}</span>Alertas automáticos por e-mail (quando ativados)</div><div class="auth-feature"><span>${ico('shield')}</span>Acesso separado por empresa</div></div></section><section class="auth-side"><div class="auth-form"><h2>${title}</h2><p>${reset?'O link funciona uma única vez.':recovery?'Se a conta existir, enviaremos um link.':signup?'Comece a organizar prazos com 14 dias de avaliação.':'Acesse os documentos da sua empresa.'}</p><div id="auth-error"></div><form id="auth-form">${form}</form><div class="auth-toggle">${signup?'Já tem conta? ':recovery||reset?'Lembrou a senha? ':'Ainda não tem conta? '}${state.publicConfig.signup_enabled&&!recovery&&!reset?`<button type="button" data-action="auth-toggle">${signup?'Entrar':'Cadastrar empresa'}</button>`:''}${recovery||reset?'<button type="button" data-action="auth-login">Voltar ao login</button>':''}</div>${!signup&&!recovery&&!reset&&state.publicConfig.recovery_enabled?'<div class="auth-toggle"><button type="button" data-action="auth-forgot">Esqueci minha senha</button></div>':''}<p class="auth-legal">DocPrazo V3.1 · Ambiente de implantação piloto. Antes de liberar ao público, configure privacidade, domínio e pagamentos.</p></div></section></div>`;
}

function navBtn(target,name,label,count=''){return `<button class="nav-link ${state.view===target?'active':''}" data-action="navigate" data-view="${target}">${ico(name)}<span>${label}</span>${count?`<span class="count">${count}</span>`:''}</button>`;}
function canEdit(){return (state.user?.role==='admin'||state.user?.role==='editor')&&(state.billing?.enabled!==false);}
function isAdmin(){return state.user?.role==='admin';}
function getAlerts(){return state.documents.filter(d=>status(d).days<=Number(d.lead_days));}
function renderShell(){
 const alerts=getAlerts().length;const name=state.user.name.split(' ')[0];
 return `<div class="layout"><aside id="sidebar" class="sidebar ${state.mobileMenu?'open':''}">${brand()}<p class="nav-caption">MENU PRINCIPAL</p><nav class="nav-list" aria-label="Menu principal">${navBtn('dashboard','chart','Visão geral')}${navBtn('documents','docs','Documentos')}${navBtn('alerts','bell','Alertas',alerts||'')}${navBtn('reports','activity','Relatórios')}${isAdmin()?navBtn('billing','calendar','Assinatura'):''}${state.user.platform_owner?navBtn('platform','shield','Painel SaaS'):''}${isAdmin()?navBtn('team','users','Equipe')+navBtn('audit','clock','Auditoria')+navBtn('notifications','bell','E-mail de alertas'):''}${navBtn('settings','settings','Configurações')}</nav><div class="sidebar-bottom"><div class="user-mini"><div class="avatar">${esc(name[0]||'U').toUpperCase()}</div><div class="mini-meta"><strong>${esc(state.user.name)}</strong><span>${esc(state.user.email)}</span></div></div><button class="nav-link" data-action="logout">${ico('logout')} Sair do sistema</button></div></aside><main class="main"><div class="topbar"><button class="mobile-menu" data-action="mobile-menu" aria-label="Abrir menu">${ico('menu')}</button><div class="crumb">Área de trabalho&nbsp; / &nbsp;<strong>${{dashboard:'Visão geral',documents:'Documentos',alerts:'Alertas',reports:'Relatórios',billing:'Assinatura',platform:'Painel SaaS',team:'Equipe',audit:'Auditoria',notifications:'E-mail de alertas',settings:'Configurações'}[state.view]}</strong></div><div class="top-actions"><span class="top-company">${esc(state.user.organization_name)}</span><div class="avatar top-avatar">${esc(name[0]||'U').toUpperCase()}</div></div></div><div class="content">${state.billing&&!state.billing.enabled?`<div class="billing-banner">${ico('warning')} Sua assinatura ou avaliação expirou. Os dados permanecem disponíveis para consulta. <button data-action="navigate" data-view="billing">Ver assinatura</button></div>`:state.billing?.status==='trialing'?`<div class="trial-banner">${ico('calendar')} Avaliação até ${dateBR(state.billing.valid_until)} · ${state.billing.limits.documents} documentos e ${state.billing.limits.users} usuários. <button data-action="navigate" data-view="billing">Conhecer assinatura</button></div>`:''}${({dashboard:dashboard,documents:documentsPage,alerts:alertsPage,reports:reportsPage,team:teamPage,audit:auditPage,notifications:notificationsPage,settings:settingsPage,billing:billingPage,platform:platformPage}[state.view]||dashboard)()}<p class="footer-note">DocPrazo · V3.1 · Gestão de vencimentos empresariais</p></div></main></div>${state.modal?renderModal():''}`;
}
function empty(title,subtitle,button){return `<div class="empty">${ico('folder')}<strong>${title}</strong><p>${subtitle}</p>${button?`${canEdit()?`<button class="btn primary" data-action="add">${ico('plus')} Novo documento</button>`:''}`:''}</div>`;}
function summaryCounts(){const docs=state.documents;return {all:docs.length,expired:docs.filter(d=>status(d).days<0).length,due7:docs.filter(d=>{const x=status(d).days;return x>=0&&x<=7;}).length,due30:docs.filter(d=>{const x=status(d).days;return x>=0&&x<=30;}).length};}
function metric(label,value,icon,color,description){return `<div class="metric-card"><div class="metric-top"><span>${label}</span><div class="metric-icon ${color}">${ico(icon)}</div></div><div class="metric-value">${value}</div><div class="metric-bottom">${description}</div></div>`;}
function dashboard(){
 const c=summaryCounts();const sorted=state.documents.slice().sort((a,b)=>a.expires_on.localeCompare(b.expires_on));
 const priority=getAlerts().sort((a,b)=>a.expires_on.localeCompare(b.expires_on)).slice(0,5);
 return `<div class="page-head"><div><h1>Olá, ${esc(state.user.name.split(' ')[0])}! 👋</h1><p>Confira o panorama dos vencimentos da sua empresa.</p></div><div class="page-controls">${canEdit()?`<button class="btn primary" data-action="add">${ico('plus')} Novo documento</button>`:''}</div></div><div class="metric-grid">${metric('Documentos',c.all,'file','blue','Total cadastrado')}${metric('Vencidos',c.expired,'warning','red','Precisam de atenção')}${metric('Próximos 7 dias',c.due7,'clock','orange','Inclui vencimentos hoje')}${metric('Próximos 30 dias',c.due30,'calendar','green','Inclui os próximos 7 dias')}</div><div class="section-grid"><section class="panel"><div class="panel-head"><div><h2>Vencimentos mais próximos</h2><p>Documentos ordenados por validade</p></div><button class="link-btn" data-action="navigate" data-view="documents">Ver todos →</button></div>${sorted.length?`<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Vencimento</th><th>Situação</th></tr></thead><tbody>${sorted.slice(0,6).map(d=>`<tr><td><strong>${esc(d.title)}</strong><span class="sub">${esc(d.category)}</span></td><td>${dateBR(d.expires_on)}</td><td>${chip(d)}</td></tr>`).join('')}</tbody></table></div>`:empty('Nenhum documento cadastrado','Cadastre seu primeiro documento para acompanhar os vencimentos.',true)}</section><section class="panel"><div class="panel-head"><div><h2>Precisa de atenção</h2><p>Alertas configurados por documento</p></div><button class="link-btn" data-action="navigate" data-view="alerts">Ver alertas →</button></div>${priority.length?`<div class="priority-list">${priority.map(d=>`<div class="priority-item"><span class="priority-marker ${status(d).type==='red'?'red':'orange'}">${ico('warning')}</span><div class="ptext"><strong>${esc(d.title)}</strong><small>Validade: ${dateBR(d.expires_on)}</small></div><span class="chip ${status(d).type}">${status(d).short}</span></div>`).join('')}</div>`:`<div class="empty">${ico('circle')}<strong>Tudo sob controle!</strong><p>Não há documentos com alertas ativos.</p></div>`}</section></div><div class="tip">${ico('info')}<div><strong>Como funcionam os avisos?</strong><p>Você define para cada documento se deseja ser avisado 7, 15, 30, 60 ou 90 dias antes do vencimento. Os avisos aparecem no painel. Para receber datas no calendário, exporte o arquivo ICS em Relatórios.</p></div></div>`;
}
function categoryOptions(){return [...new Set(state.documents.map(d=>d.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));}
function filteredDocs(){return state.documents.filter(d=>{
 const f=state.filters,s=status(d);
 const search=`${d.title} ${d.category} ${d.reference} ${d.responsible}`.toLocaleLowerCase('pt-BR');
 if(f.query&&!search.includes(f.query.toLocaleLowerCase('pt-BR')))return false;
 if(f.category!=='all'&&d.category!==f.category)return false;
 if(f.status==='expired'&&s.days>=0)return false;
 if(f.status==='today'&&s.days!==0)return false;
 if(f.status==='warning'&&!(s.days>=0&&s.days<=d.lead_days))return false;
 if(f.status==='good'&&s.type!=='green')return false;
 return true;
 }).sort((a,b)=>a.expires_on.localeCompare(b.expires_on));}
function docRows(docs){return docs.length?`<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Categoria</th><th>Responsável</th><th>Vencimento</th><th>Prazo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${docs.map(d=>{const s=status(d);return `<tr><td><button class="clickable-title" data-action="${canEdit()?'edit':'attachments'}" data-id="${d.id}">${esc(d.title)}</button>${d.reference?`<span class="sub">${esc(d.reference)}</span>`:''}${Number(d.attachment_count)>0?`<span class="file-count">${ico('paperclip')} ${d.attachment_count} anexo(s)</span>`:''}</td><td>${esc(d.category)}</td><td>${esc(d.responsible||'—')}</td><td>${dateBR(d.expires_on)}</td><td>${esc(s.short)}</td><td>${chip(d)}</td><td><div class="row-actions">${canEdit()?`<button class="icon-button" data-action="edit" data-id="${d.id}" title="Editar" aria-label="Editar ${esc(d.title)}">${ico('edit')}</button><button class="icon-button" data-action="renew" data-id="${d.id}" title="Renovar" aria-label="Renovar ${esc(d.title)}">${ico('renew')}</button><button class="icon-button delete" data-action="delete" data-id="${d.id}" title="Excluir" aria-label="Excluir ${esc(d.title)}">${ico('trash')}</button>`:''}<button class="icon-button" data-action="attachments" data-id="${d.id}" title="Anexos" aria-label="Anexos ${esc(d.title)}">${ico('paperclip')}</button></div></td></tr>`;}).join('')}</tbody></table></div>`:empty('Nenhum documento encontrado','Altere os filtros ou cadastre um novo documento.',false);}
function documentsPage(){return `<div class="page-head"><div><h1>Documentos</h1><p>Gerencie os documentos e acompanhe os prazos de validade.</p></div><div class="page-controls"><button class="btn primary" data-action="xlsx-filtered">${ico('download')} Excel filtrados</button><button class="btn" data-action="xlsx-all">${ico('download')} Excel todos</button><button class="btn" data-action="export">CSV filtrados</button><button class="btn" data-action="export-all">CSV todos</button>${canEdit()?`<button class="btn primary" data-action="add">${ico('plus')} Novo documento</button>`:''}</div></div><div class="filters"><div class="search">${ico('search')}<input id="search-docs" class="field-control" placeholder="Buscar documento, responsável ou referência..." value="${attr(state.filters.query)}" aria-label="Pesquisar documentos" /></div><select id="filter-status" class="field-control" aria-label="Filtrar por situação"><option value="all">Todas as situações</option><option value="expired" ${state.filters.status==='expired'?'selected':''}>Vencidos</option><option value="today" ${state.filters.status==='today'?'selected':''}>Vencem hoje</option><option value="warning" ${state.filters.status==='warning'?'selected':''}>A vencer</option><option value="good" ${state.filters.status==='good'?'selected':''}>Em dia</option></select><select id="filter-category" class="field-control" aria-label="Filtrar por categoria"><option value="all">Todas as categorias</option>${categoryOptions().map(c=>`<option value="${attr(c)}" ${state.filters.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><section class="panel"><div class="panel-head"><div><h2>Lista de documentos</h2><p id="filtered-count">${filteredDocs().length} documento(s) encontrado(s)</p></div></div><div id="documents-list">${docRows(filteredDocs())}</div><div class="status-key"><span><span class="dot" class="key-red"></span> Vencidos / hoje</span><span><span class="dot" class="key-orange"></span> Dentro do alerta</span><span><span class="dot" class="key-green"></span> Em dia</span></div></section>`;}
function alertsPage(){const docs=getAlerts().sort((a,b)=>a.expires_on.localeCompare(b.expires_on));return `<div class="page-head"><div><h1>Central de alertas</h1><p>Documentos vencidos ou dentro do prazo de alerta configurado.</p></div><div class="page-controls">${canEdit()?`<button class="btn primary" data-action="add">${ico('plus')} Novo documento</button>`:''}</div></div><div class="alerts-grid">${docs.length?docs.map(d=>`<div class="alert-card"><div class="priority-marker ${status(d).type==='red'?'red':'orange'}">${ico('warning')}</div><div class="ptext"><strong>${esc(d.title)}</strong><p>${esc(d.category)} · Vencimento em ${dateBR(d.expires_on)} · Responsável: ${esc(d.responsible||'Não informado')}</p></div><span class="chip ${status(d).type}">${status(d).short}</span>${canEdit()?`<button class="btn small" data-action="renew" data-id="${d.id}">${ico('renew')} Renovar</button>`:''}</div>`).join(''):empty('Nenhum alerta pendente','Os documentos cadastrados estão fora dos períodos de aviso.',false)}</div>`;}
const categories=['Alvará','Licença','Certificado digital','Contrato','Seguro','Certidão','Documento trabalhista','Outro'];
function input(label,name,opts={}){return `<div class="form-group ${opts.full?'full':''}"><label for="f_${name}">${label}</label>${opts.textarea?`<textarea id="f_${name}" name="${name}" maxlength="${opts.max||1200}" placeholder="${attr(opts.placeholder||'')}">${esc(opts.value||'')}</textarea>`:`<input id="f_${name}" name="${name}" type="${opts.type||'text'}" value="${attr(opts.value||'')}" placeholder="${attr(opts.placeholder||'')}" ${opts.required?'required':''} maxlength="${opts.max||140}" />`}</div>`;}
function renderModal(){
 const m=state.modal;
 if(m.type==='platform'){
  const o=m.org;
  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal narrow"><div class="modal-head"><h2>Gerenciar ${esc(o.name)}</h2><button class="icon-button" data-action="close">${ico('x')}</button></div><form id="platform-form"><div class="modal-body"><div class="form-group"><label>Situação de acesso</label><select name="status"><option value="trialing">Estender avaliação</option><option value="courtesy">Acesso cortesia</option><option value="suspended">Suspender acesso</option></select></div><div class="form-group mt16"><label>Validade do acesso</label><input type="date" name="valid_until" value="${attr(o.valid_until)}" required /></div><p class="hint">Não confirma ou cobra pagamentos. Ações são registradas no histórico comercial.</p><p id="platform-error" class="modal-error"></p></div><div class="modal-actions"><button class="btn" type="button" data-action="close">Cancelar</button><button class="btn primary" type="submit">Salvar acesso</button></div></form></section></div>`;
 }
 if(m.type==='attachments'){
  const d=m.doc;
  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>Anexos do documento</h2><p>${esc(d.title)}</p></div><button class="icon-button" data-action="close">${ico('x')}</button></div><div class="modal-body"><p class="hint">PDF, PNG ou JPG · Até 5 MB por arquivo · Máximo de 10 anexos.</p>${canEdit()?`<form id="attachment-form" class="upload-zone"><input type="file" name="attachment" id="attachment-file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required /><button class="btn primary" type="submit" id="upload-submit">${ico('upload')} Enviar anexo</button></form>`:''}<div id="attachments-list" class="attachments-list">Carregando anexos...</div><p class="modal-error" id="attachment-error"></p></div><div class="modal-actions"><button class="btn" data-action="close">Fechar</button></div></section></div>`;
 }
 if(m.type==='team'){
  const d=m.member||{},edit=!!m.member;
  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal narrow" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>${edit?'Editar membro':'Adicionar colaborador'}</h2><p>Defina o acesso à empresa</p></div><button class="icon-button" data-action="close">${ico('x')}</button></div><form id="team-form"><div class="modal-body">${!edit?`${input('Nome completo *','name',{required:true})}${input('E-mail *','email',{type:'email',required:true})}`:`<p><strong>${esc(d.name)}</strong> · ${esc(d.email)}</p>`}<div class="form-group mt16"><label for="member-role">Perfil de acesso</label><select name="role" id="member-role">${[['admin','Administrador'],['editor','Editor'],['viewer','Leitor']].map(([v,n])=>`<option value="${v}" ${d.role===v?'selected':''}>${n}</option>`).join('')}</select></div><div class="form-group mt16"><label>Senha ${edit?'(somente para redefinir)':'*'}</label><input type="password" name="password" ${edit?'':'required'} minlength="8" maxlength="128" autocomplete="new-password" placeholder="Mínimo de 8 caracteres" /><span class="hint">A senha deverá ser informada diretamente ao colaborador por um canal seguro.</span></div><p class="modal-error" id="team-error"></p></div><div class="modal-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button type="submit" class="btn primary" id="team-submit">Salvar</button></div></form></section></div>`;
 }
 if(m.type==='doc'){
  const d=m.doc||{};const edit=!!m.doc;
  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${edit?'Editar documento':'Novo documento'}</h2><p>${edit?'Atualize as informações do documento.':'Preencha os campos para acompanhar seu vencimento.'}</p></div><button class="icon-button" data-action="close" aria-label="Fechar">${ico('x')}</button></div><form id="document-form"><div class="modal-body"><div class="form-grid">${input('Nome do documento *','title',{required:true,value:d.title,full:true,placeholder:'Ex.: Alvará de funcionamento'})}<div class="form-group"><label for="f_category">Categoria *</label><select name="category" id="f_category" required><option value="">Selecione uma categoria</option>${[...new Set([...categories,...(d.category?[d.category]:[])])].map(c=>`<option ${d.category===c?'selected':''} value="${attr(c)}">${esc(c)}</option>`).join('')}</select></div>${input('Número / referência','reference',{value:d.reference,placeholder:'Ex.: ALV-2026-013',max:90})}${input('Responsável','responsible',{value:d.responsible,placeholder:'Ex.: Administração',max:100})}${input('Data de emissão','issue_date',{type:'date',value:d.issue_date})}${input('Data de vencimento *','expires_on',{type:'date',required:true,value:d.expires_on||addDays(30)})}<div class="form-group"><label for="f_lead_days">Alertar com antecedência</label><select id="f_lead_days" name="lead_days">${[7,15,30,60,90].map(v=>`<option value="${v}" ${Number(d.lead_days||30)===v?'selected':''}>${v} dias antes</option>`).join('')}</select><div class="hint">Aviso exibido dentro do sistema.</div></div>${input('Observações','notes',{full:true,textarea:true,value:d.notes,placeholder:'Informações adicionais...'})}</div>${edit?'<div id="history-section" class="history"><h3>Histórico de renovações</h3><div id="history-content">Carregando...</div></div><button type="button" class="btn" data-action="attachments" data-id="'+d.id+'">Gerenciar anexos</button>':''}<p class="modal-error" id="doc-error" role="alert"></p></div><div class="modal-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button type="submit" class="btn primary" id="doc-submit">${ico('check')} ${edit?'Salvar alterações':'Cadastrar documento'}</button></div></form></section></div>`;
 }
 if(m.type==='renew'){
  const d=m.doc;
  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal narrow" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Renovar documento</h2><p>${esc(d.title)}</p></div><button class="icon-button" data-action="close" aria-label="Fechar">${ico('x')}</button></div><form id="renew-form"><div class="modal-body"><div class="form-group"><label>Validade atual</label><input value="${dateBR(d.expires_on)}" disabled /></div><div class="form-group" class="mt16"><label for="newdate">Nova data de vencimento *</label><input id="newdate" name="expires_on" type="date" min="${addDays(0)}" value="${addDays(365)}" required /></div><div class="form-group mt16"><label for="renew-note">Observação (opcional)</label><textarea id="renew-note" name="note" maxlength="300" placeholder="Ex.: renovação confirmada com o órgão emissor"></textarea></div><div class="form-group mt16"><label for="renew-attachment">Novo comprovante (opcional)</label><input id="renew-attachment" name="renew_attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"/><span class="hint">PDF, PNG ou JPG, até 5 MB. O arquivo antigo continua disponível para consulta. Máximo de 10 anexos por documento.</span></div><p class="modal-error" id="renew-error" role="alert"></p></div><div class="modal-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button type="submit" class="btn primary" id="renew-submit">${ico('renew')} Confirmar renovação</button></div></form></section></div>`;
 }
 return '';
}
function render(){document.getElementById('app').innerHTML=state.user?renderShell():renderAuth();if(state.modal?.type==='doc'&&state.modal.doc)loadHistory(state.modal.doc.id);if(state.modal?.type==='attachments')loadAttachments(state.modal.doc.id);}
async function loadHistory(id){try{const data=await request(`/api/documents/${id}/history`);const container=document.getElementById('history-content');if(!container)return;container.innerHTML=data.renewals.length?data.renewals.map(r=>`<div class="history-entry"><span>${dateBR(r.previous_date)} → <strong>${dateBR(r.new_date)}</strong>${r.note?`<br>${esc(r.note)}`:''}</span><span>${esc(r.created_at.slice(0,10).split('-').reverse().join('/'))}</span></div>`).join(''):'<span class="hint">Nenhuma renovação registrada.</span>';}catch(e){const container=document.getElementById('history-content');if(container)container.textContent='Não foi possível carregar o histórico.';}}
function rerenderDocs(){const container=document.getElementById('documents-list');if(!container)return;const docs=filteredDocs();container.innerHTML=docRows(docs);document.getElementById('filtered-count').textContent=`${docs.length} documento(s) encontrado(s)`;}
function csvExport(all=false){
 const docs=all?state.documents.slice():filteredDocs();if(!docs.length)return toast('Não existem documentos para exportar.',true);
 const headers=['Documento','Categoria','Referência','Responsável','Emissão','Vencimento','Antecedência (dias)','Situação','Observações'];
 const safe=(v)=>{let value=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';};
 const rows=docs.map(d=>[d.title,d.category,d.reference,d.responsible,dateBR(d.issue_date),dateBR(d.expires_on),d.lead_days,status(d).label,d.notes].map(safe).join(';'));
 const blob=new Blob(['\ufeff',headers.map(safe).join(';')+'\r\n',rows.join('\r\n')],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='docprazo-documentos-'+localISO()+'.csv';a.click();URL.revokeObjectURL(url);toast(`${docs.length} documento(s) exportado(s).`);
}
async function excelExport(all=false){
 const docs=all?state.documents:filteredDocs();
 if(!docs.length)return toast('Não existem documentos para exportar com os filtros atuais.',true);
 const url=new URL('/api/exports/documents.xlsx',location.origin);
 url.searchParams.set('scope',all?'all':'filtered');
 if(!all){url.searchParams.set('query',state.filters.query);url.searchParams.set('status',state.filters.status);url.searchParams.set('category',state.filters.category);}
 let response;
 try{response=await fetch(url.pathname+url.search,{credentials:'same-origin'});}
 catch{return toast('Não foi possível conectar para exportar Excel.',true);}
 if(!response.ok){let message='Não foi possível exportar a planilha.';try{message=(await response.json()).error||message;}catch{}return toast(message,true);}
 const file=await response.blob(),link=document.createElement('a'),objectURL=URL.createObjectURL(file);
 link.href=objectURL;link.download=`docprazo-${all?'todos':'filtrados'}-${localISO()}.xlsx`;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),3000);
 toast(`${docs.length} documento(s) exportado(s) em Excel.`);
}
async function handleAction(button){
 const action=button.dataset.action,id=Number(button.dataset.id),doc=state.documents.find(d=>d.id===id);
 if(action==='auth-login'){history.replaceState(null,'',location.pathname);state.authMode='login';render();return;}
 if(action==='auth-forgot'){state.authMode='forgot';render();return;}
 if(action==='billing-checkout'){
  try{const result=await request('/api/billing/checkout',{method:'POST'});if(!/^https:\/\//.test(result.url))throw new Error('Link de pagamento inválido.');location.assign(result.url);}catch(e){toast(e.message,true);}return;
 }
 if(action==='billing-sync'){
  try{await request('/api/billing/sync',{method:'POST'});state.billing=await request('/api/billing');render();toast('Situação da assinatura atualizada.');}catch(e){toast(e.message,true);}return;
 }
 if(action==='platform-edit'){
   if(!state.user.platform_owner)return;const org=state.platform?.companies.find(o=>o.id===id);if(org){state.modal={type:'platform',org};render();}return;
 }
 if(action==='auth-toggle'){state.authMode=state.authMode==='login'?'signup':'login';render();return;}
 if(action==='mobile-menu'){state.mobileMenu=!state.mobileMenu;document.getElementById('sidebar')?.classList.toggle('open',state.mobileMenu);return;}
 if(action==='navigate'){state.view=button.dataset.view;state.mobileMenu=false;state.modal=null;render();try{if(state.view==='team'&&isAdmin()){state.team=(await request('/api/users')).users;render();}if(state.view==='audit'&&isAdmin()){state.audits=(await request('/api/audit')).events;render();}if(state.view==='reports'){state.reports=await request('/api/reports');render();}if(state.view==='notifications'&&isAdmin()){state.notifications=await request('/api/notifications');state.notificationPreview=await request('/api/notifications/preview');render();}if(state.view==='billing'){state.billing=await request('/api/billing');render();}if(state.view==='platform'&&state.user.platform_owner){state.platform=await request('/api/platform/organizations');render();}}catch(e){safeError(e.message);}return;}
 if(action==='add'&&!canEdit())return toast('Sem permissão para cadastrar.',true);
 if(action==='add'){state.modal={type:'doc',doc:null};render();return;}
 if(action==='edit'&&doc&&canEdit()){state.modal={type:'doc',doc};render();return;}
 if(action==='renew'&&doc&&canEdit()){state.modal={type:'renew',doc};render();return;}
 if(action==='close'){state.modal=null;render();return;}
 if(action==='xlsx-filtered'){await excelExport(false);return;}
 if(action==='xlsx-all'){await excelExport(true);return;}
 if(action==='export'){csvExport();return;}
 if(action==='export-all'){csvExport(true);return;}
 if(action==='calendar'){calendarExport();return;}
 if(action==='send-reminders'&&isAdmin()){
  if(!confirm('Enviar o resumo real para os destinatários cadastrados? Será aceito no máximo um resumo por dia.'))return;
  try{const result=await request('/api/notifications/send',{method:'POST'});state.notifications=await request('/api/notifications');state.notificationPreview=await request('/api/notifications/preview');render();toast(`O provedor aceitou ${result.count} vencimento(s) para ${result.recipient}. Confirme a entrega na caixa de entrada.`);}catch(e){toast(e.message,true);}return;
 }
 if(action==='test-reminder'&&isAdmin()){
  if(!confirm('Enviar um e-mail de TESTE? Não consome o resumo diário.'))return;
  try{const result=await request('/api/notifications/test',{method:'POST'});state.notifications=await request('/api/notifications');render();toast(`Teste aceito pelo provedor para ${result.recipient}. Confira a caixa de entrada e spam.`);}catch(e){toast(e.message,true);}return;
 }
 if(action==='refresh-reminder-preview'&&isAdmin()){
  try{state.notificationPreview=await request('/api/notifications/preview');state.notifications=await request('/api/notifications');render();toast('Prévia atualizada.');}catch(e){toast(e.message,true);}return;
 }

 if(action==='attachments'&&doc){state.modal={type:'attachments',doc};render();return;}
 if(action==='attachment-delete'){if(!canEdit())return;if(!confirm('Excluir este anexo permanentemente?'))return;try{await request(`/api/attachments/${id}/delete`,{method:'DELETE'});await loadAttachments(state.modal.doc.id);await refreshDocsPreservingModal();toast('Anexo removido.');}catch(e){safeError(e.message);}return;}
 if(action==='team-add'&&isAdmin()){state.modal={type:'team',member:null};render();return;}
 if(action==='team-edit'&&isAdmin()){const member=state.team.find(u=>u.id===id);if(member&&member.id!==state.user.id){state.modal={type:'team',member};render();}return;}
 if(action==='team-toggle'&&isAdmin()){const member=state.team.find(u=>u.id===id);if(!member||member.id===state.user.id)return;const newActive=member.active?0:1;if(!confirm(`${newActive?'Reativar':'Desativar'} acesso de ${member.name}?`))return;try{await request(`/api/users/${id}`,{method:'PATCH',body:JSON.stringify({role:member.role,active:newActive})});state.team=(await request('/api/users')).users;render();toast('Acesso atualizado.');}catch(e){safeError(e.message);}return;}

 if(action==='delete'&&doc&&canEdit()){if(!window.confirm(`Excluir "${doc.title}"? Esta ação remove também o histórico de renovações e não pode ser desfeita.`))return;try{await request(`/api/documents/${id}`,{method:'DELETE'});await refreshDocs();toast('Documento excluído.');}catch(e){safeError(e.message);}return;}
 if(action==='logout'){try{await request('/api/logout',{method:'POST'});}catch(e){console.warn(e);}state={user:null,csrf:null,documents:[],team:[],audits:[],reports:null,notifications:null,notificationPreview:null,billing:null,platform:null,publicConfig:state.publicConfig,view:'dashboard',authMode:'login',filters:{query:'',status:'all',category:'all'},modal:null,mobileMenu:false};render();return;}
}
async function handleAuth(form){
 const button=document.getElementById('auth-submit'),area=document.getElementById('auth-error');area.innerHTML='';button.disabled=true;
 const data=Object.fromEntries(new FormData(form));const resetToken=new URLSearchParams(location.search).get('reset');
 try{
  if(resetToken){await request('/api/password/reset',{method:'POST',body:JSON.stringify({token:resetToken,password:data.password})});history.replaceState(null,'',location.pathname);state.authMode='login';render();toast('Senha redefinida. Entre com a nova senha.');return;}
  if(state.authMode==='forgot'){const result=await request('/api/password/forgot',{method:'POST',body:JSON.stringify(data)});area.innerHTML=`<p class="hint">${esc(result.message)}</p>`;button.disabled=false;return;}
  await request(state.authMode==='signup'?'/api/signup':'/api/login',{method:'POST',body:JSON.stringify(data)});
  const me=await request('/api/me');state.user=me.user;state.csrf=me.csrf;state.view='dashboard';await refreshDocs();state.billing=await request('/api/billing');render();toast(state.authMode==='signup'?'Empresa cadastrada. Bem-vindo!':'Login realizado.');
 }catch(e){area.innerHTML=`<div class="auth-err">${esc(e.message)}</div>`;button.disabled=false;}
}

async function handleDocSave(form){
 const btn=document.getElementById('doc-submit'),errBox=document.getElementById('doc-error');btn.disabled=true;errBox.textContent='';
 const data=Object.fromEntries(new FormData(form));data.lead_days=Number(data.lead_days);data.issue_date=data.issue_date||null;
 const editDoc=state.modal?.doc;
 try{await request(editDoc?`/api/documents/${editDoc.id}`:'/api/documents',{method:editDoc?'PATCH':'POST',body:JSON.stringify(data)});state.modal=null;await refreshDocs();toast(editDoc?'Documento atualizado!':'Documento cadastrado!');}
 catch(e){errBox.textContent=e.message;btn.disabled=false;}
}
async function handleRenew(form){
 const btn=document.getElementById('renew-submit'),errBox=document.getElementById('renew-error');btn.disabled=true;errBox.textContent='';
 const doc=state.modal?.doc;const data=Object.fromEntries(new FormData(form));
 try{
  const file=form.elements.renew_attachment.files[0];
  const body={expires_on:data.expires_on,note:data.note||''};
  if(file&&file.size){
   if(file.size>5*1024*1024)throw new Error('O comprovante deve ter no máximo 5 MB.');
   if(!/\.(pdf|png|jpe?g)$/i.test(file.name))throw new Error('Envie um comprovante PDF, PNG ou JPG.');
   const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Não foi possível ler o comprovante.'));reader.readAsDataURL(file);});
   body.attachment={name:file.name,content:encoded};
  }
  await request(`/api/documents/${doc.id}/renew`,{method:'POST',body:JSON.stringify(body)});
  state.modal=null;await refreshDocs();toast(body.attachment?'Renovação e novo comprovante registrados!':'Renovação registrada no histórico!');
 }
 catch(e){errBox.textContent=e.message;btn.disabled=false;}
}
// Novos módulos da V2: anexos, equipe, auditoria, relatórios e configurações.
function titleBar(title,desc,actions=''){return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div><div class="page-controls">${actions}</div></div>`;}
function billingPage(){
 const b=state.billing;
 if(!b)return titleBar('Assinatura','Carregando informações...');
 const labels={trialing:'Período de avaliação',active:'Assinatura autorizada',courtesy:'Acesso cortesia',past_due:'Pagamento pendente',canceled:'Cancelada',suspended:'Suspensa'};
 const events=(b.events||[]).map(e=>`<tr><td>${esc(e.created_at)}</td><td>${esc(e.event)}</td><td>${esc(e.detail)}</td></tr>`).join('');
 return titleBar('Assinatura','Gerencie o acesso à plataforma e acompanhe os limites.')+`<div class="settings-grid"><section class="panel settings-panel"><h2>${esc(labels[b.status]||b.status)}</h2><p>Validade do acesso: <strong>${dateBR(b.valid_until)}</strong></p><p>Documentos: <strong>${state.documents.length} / ${b.limits.documents}</strong></p><p>Usuários ativos permitidos: <strong>${b.limits.users}</strong></p><p>Quando expirar, você poderá consultar e exportar seus documentos.</p></section><section class="panel settings-panel"><h2>Plano Fundador · R$ ${b.price_brl}/mês</h2><p>Até ${b.status==='trialing'?'100':'100'} documentos e 5 usuários no plano pago. Alertas por e-mail, anexos, relatórios e auditoria.</p><p>${b.checkout_ready?'Checkout via Mercado Pago habilitado.':'Checkout indisponível: falta configurar o Mercado Pago no servidor.'}</p>${isAdmin()?`<button class="btn primary" data-action="billing-checkout" ${!b.checkout_ready?'disabled':''}>${ico('arrow')} Contratar assinatura</button> <button class="btn" data-action="billing-sync" ${!b.provider?'disabled':''}>Verificar situação</button>`:'<p>Somente um administrador pode contratar o plano.</p>'}<p class="hint">A confirmação do provedor pode demorar. O retorno da página de pagamento não libera acesso automaticamente.</p></section></div><section class="panel" style="margin-top:18px"><div class="panel-head"><h2>Histórico da assinatura</h2></div><div class="table-wrap"><table><thead><tr><th>Data UTC</th><th>Evento</th><th>Detalhes</th></tr></thead><tbody>${events||'<tr><td colspan="3">Sem eventos</td></tr>'}</tbody></table></div></section>`;
}
function platformPage(){
 if(!state.user?.platform_owner)return titleBar('Acesso restrito','Somente o proprietário da plataforma pode consultar esta área.');
 const rows=state.platform?.companies||[];
 return titleBar('Painel SaaS','Gestão de empresas, acesso piloto e assinaturas. Não exibe conteúdo de documentos.')+`<div class="metric-grid">${metric('Empresas',rows.length,'users','blue','Cadastradas')}${metric('Avaliação',rows.filter(x=>x.status==='trialing').length,'clock','orange','Em teste')}${metric('Ativas',rows.filter(x=>x.status==='active'||x.status==='courtesy').length,'circle','green','Assinatura ou cortesia')}${metric('Suspensas',rows.filter(x=>x.status==='suspended').length,'warning','red','Acesso bloqueado')}</div><section class="panel report-panel"><div class="panel-head"><div><h2>Empresas cadastradas</h2><p>Ative cortesias ou estenda o período de teste sem declarar pagamentos recebidos.</p></div></div><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Plano / situação</th><th>Validade</th><th>Docs</th><th>Usuários</th><th>Ação</th></tr></thead><tbody>${rows.map(o=>`<tr><td>${esc(o.name)}</td><td>${esc(o.plan)} · ${esc(o.status)}</td><td>${dateBR(o.valid_until)}</td><td>${o.documents}</td><td>${o.users}</td><td><button class="btn small" data-action="platform-edit" data-id="${o.id}">Gerenciar</button></td></tr>`).join('')||'<tr><td colspan="6">Nenhuma empresa encontrada</td></tr>'}</tbody></table></div></section>`;
}
function reportsPage(){
 const cats=[...new Set(state.documents.map(d=>d.category))].sort();const total=state.documents.length;
 const rows=cats.map(cat=>{const n=state.documents.filter(d=>d.category===cat).length;return `<div class="bar-row"><span>${esc(cat)}</span><progress class="bar-meter" max="${total||1}" value="${n}">${n}</progress><strong>${n}</strong></div>`;}).join('');
 const c=summaryCounts();const renews=state.reports?.renewals??'—',files=state.reports?.attachments??'—';
 return titleBar('Relatórios','Resumo dos documentos e das renovações.',`<button class="btn primary" data-action="xlsx-all">${ico('download')} Excel completo</button><button class="btn" data-action="export-all">CSV completo</button><button class="btn" data-action="calendar">${ico('calendar')} Calendário .ICS</button>`)+`<div class="metric-grid">${metric('Documentos',c.all,'docs','blue','Na empresa')}${metric('Vencidos',c.expired,'warning','red','Em atraso')}${metric('Renovações',renews,'renew','green','Registradas')}${metric('Anexos',files,'paperclip','orange','Arquivos armazenados')}</div><section class="panel report-panel"><div class="panel-head"><div><h2>Documentos por categoria</h2><p>Distribuição atual</p></div></div><div class="bar-list">${rows||'<p class="hint">Cadastre documentos para ver os indicadores.</p>'}</div></section><div class="tip">${ico('info')}<div><strong>Exportação de calendário</strong><p>O arquivo ICS pode ser importado no Google Agenda, Outlook ou outro calendário compatível. Os prazos não serão sincronizados automaticamente após a importação.</p></div></div>`;
}
function teamPage(){if(!isAdmin())return titleBar('Acesso restrito','Somente administradores podem gerenciar a equipe.');
 const roles={admin:'Administrador',editor:'Editor',viewer:'Leitor'};
 return titleBar('Equipe','Defina quem administra, edita ou apenas visualiza.',`<button class="btn primary" data-action="team-add">${ico('plus')} Novo usuário</button>`)+`<section class="panel"><div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Acesso</th><th>Ações</th></tr></thead><tbody>${state.team.map(u=>`<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.email)}</td><td>${roles[u.role]||esc(u.role)}</td><td><span class="chip ${u.active?'green':'red'}">${u.active?'Ativo':'Desativado'}</span></td><td><div class="row-actions">${u.id===state.user.id?'Sua conta':`<button class="btn small" data-action="team-edit" data-id="${u.id}">Editar</button><button class="btn small" data-action="team-toggle" data-id="${u.id}">${u.active?'Desativar':'Reativar'}</button>`}</div></td></tr>`).join('')}</tbody></table></div></section><div class="tip">${ico('shield')}<div><strong>Perfis</strong><p>Administrador: controla equipe, configurações e auditoria. Editor: cadastra, renova e altera documentos e anexos. Leitor: apenas consulta e exporta dados.</p></div></div>`;
}
function formatAuditDate(utc){
 const value=new Date(String(utc).replace(' ','T')+'Z');
 if(Number.isNaN(value.getTime()))return esc(utc);
 return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(value);
}
function auditPage(){if(!isAdmin())return titleBar('Acesso restrito','Somente administradores podem consultar a auditoria.');
 const labels={'document.created':'Documento cadastrado','document.updated':'Documento alterado','document.deleted':'Documento excluído','document.renewed':'Documento renovado','attachment.added':'Anexo enviado','attachment.deleted':'Anexo excluído','user.created':'Usuário cadastrado','user.updated':'Usuário atualizado','user.deactivated':'Usuário desativado','organization.updated':'Empresa alterada','password.changed':'Senha alterada'};
 return titleBar('Auditoria','Últimos 500 eventos da empresa.')+`<section class="panel"><div class="table-wrap"><table><thead><tr><th>Data e hora (UTC−3)</th><th>Responsável</th><th>Ação</th><th>Registro</th><th>Detalhes</th></tr></thead><tbody>${state.audits.map(a=>`<tr><td>${formatAuditDate(a.created_at)}</td><td>${esc(a.actor_name)}</td><td><strong>${labels[a.event]||esc(a.event)}</strong></td><td>${esc(a.subject)}</td><td>${esc(a.detail)}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum evento registrado.</td></tr>'}</tbody></table></div></section>`;
}
function notificationsPage(){if(!isAdmin())return titleBar('Acesso restrito','Somente administradores podem configurar alertas.');
 const n=state.notifications,pr=state.notificationPreview;
 const history=n?.history||[];
 return titleBar('Alertas por e-mail','Seus destinatários recebem avisos automáticos, separados por empresa.')+`<div class="settings-grid"><section class="panel settings-panel"><h2>Destinatários da empresa</h2><p>Cadastre até 5 e-mails corporativos, separados por vírgula. Os anexos nunca são enviados.</p><form id="notifications-form"><div class="form-group"><label>E-mails destinatários</label><input type="text" name="email" value="${attr(n?.email||'')}" maxlength="500" placeholder="responsavel@empresa.com.br, gerente@empresa.com.br" /></div><label class="check-line"><input type="checkbox" name="enabled" ${n?.enabled?'checked':''}/> Ativar avisos diários</label><button type="submit" class="btn primary">Salvar preferências</button></form></section>
 <section class="panel settings-panel"><h2>Status da integração</h2><p><strong>Provedor de e-mail:</strong> ${n?.provider_ready?'<span style="color:#15803d">Chave e remetente informados (ainda requer teste real)</span>':'<span style="color:#b45309">Aguardando chave e remetente</span>'}</p><p><strong>Rotina diária:</strong> ${n?.schedule_enabled?'Ativada, após o horário definido (João Pessoa)':'Desativada no servidor'}</p><p><strong>Avisos da empresa:</strong> ${n?.enabled?'Habilitados':'Desabilitados'}</p><p><strong>Último resumo:</strong> ${n?.last?`${dateBR(n.last.sent_date)} · ${n.last.document_count} documento(s) · ${esc(n.last.recipient)}`:'Nenhum resumo enviado'}</p><div class="page-controls" style="display:flex;flex-wrap:wrap;gap:9px"><button class="btn" data-action="test-reminder" ${!n?.provider_ready?'disabled':''}>${ico('bell')} Enviar e-mail de teste</button><button class="btn primary" data-action="send-reminders" ${(!n?.enabled||!n?.provider_ready||!pr?.count)?'disabled':''}>Enviar resumo de hoje</button></div><p class="hint">O teste não consome o envio diário. A confirmação significa aceite do provedor, não entrega garantida.</p></section></div>
 <section class="panel" style="margin-top:20px;padding:22px"><div class="panel-head"><div><h2>Prévia dos alertas</h2><p>Documentos que entrariam no próximo resumo da sua empresa</p></div><button class="btn small" data-action="refresh-reminder-preview">Atualizar prévia</button></div><div class="metric-grid" style="margin:14px 0">${metric('Total em alerta',pr?.count??'—','bell','blue','Inclui vencidos e próximos')}${metric('Vencidos',pr?.expired??'—','warning','red','Antes de hoje')}${metric('Vencem hoje',pr?.today??'—','clock','orange','Prazo hoje')}${metric('A vencer',pr?.upcoming??'—','calendar','green','Dentro da antecedência')}</div>${pr?.documents?.length?`<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Vencimento</th><th>Situação</th></tr></thead><tbody>${pr.documents.slice(0,15).map(d=>`<tr><td>${esc(d.title)}</td><td>${dateBR(d.expires_on)}</td><td>${d.days_left<0?'Vencido há '+Math.abs(d.days_left)+' dia(s)':d.days_left===0?'Vence hoje':'Em '+d.days_left+' dia(s)'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Não existem documentos em alerta no momento.</p>'}</section>
 <section class="panel" style="margin-top:20px;padding:22px"><div class="panel-head"><div><h2>Histórico de tentativas</h2><p>Registros do provedor, restritos à sua empresa</p></div></div>${history.length?`<div class="table-wrap"><table><thead><tr><th>Data/hora</th><th>Tipo</th><th>Resultado</th><th>Destinatários</th></tr></thead><tbody>${history.map(h=>`<tr><td>${new Date(h.created_at.replace(' ','T')+'Z').toLocaleString('pt-BR',{timeZone:'America/Fortaleza'})}</td><td>${h.kind==='test'?'Teste':'Resumo diário'}</td><td>${h.status==='accepted'?'Aceito pelo provedor':'Falha: '+esc(h.detail)}</td><td>${esc(h.recipient)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Nenhum envio ou tentativa registrado.</p>'}</section>
 <div class="tip">${ico('info')}<div><strong>Como ativar no servidor</strong><p>Configure RESEND_API_KEY, REMINDER_FROM_EMAIL e REMINDERS_SCHEDULE_ENABLED=1 em um arquivo .env privado ou nas variáveis da hospedagem. Primeiro use o botão de teste. Para envio a empresas clientes, o domínio remetente precisa estar verificado no Resend.</p></div></div>`;
}
async function handleNotificationsSave(form){const btn=form.querySelector('button');btn.disabled=true;try{const data=Object.fromEntries(new FormData(form));state.notifications=await request('/api/notifications',{method:'PATCH',body:JSON.stringify({email:data.email||'',enabled:Boolean(data.enabled)})});state.notifications=await request('/api/notifications');render();toast('Preferências de alerta salvas.');}catch(e){btn.disabled=false;toast(e.message,true);}}
function settingsPage(){return titleBar('Configurações','Gerencie os dados de sua conta e da empresa.')+`<div class="settings-grid">${isAdmin()?`<section class="panel settings-panel"><h2>Dados da empresa</h2><p>Identificação exibida em todo o sistema.</p><form id="org-form"><div class="form-group"><label>Nome da empresa</label><input name="name" required maxlength="120" value="${attr(state.user.organization_name)}" /></div><button class="btn primary" type="submit">Salvar empresa</button></form></section>`:''}<section class="panel settings-panel"><h2>Minha senha</h2><p>Altere sua senha de acesso com segurança.</p><form id="password-form"><div class="form-group"><label>Senha atual</label><input name="current_password" type="password" required autocomplete="current-password" /></div><div class="form-group"><label>Nova senha (mínimo 8 caracteres)</label><input name="new_password" type="password" required minlength="8" autocomplete="new-password" /></div><button class="btn primary" type="submit">Alterar senha</button></form></section><section class="panel settings-panel"><h2>Meu perfil</h2><p><strong>${esc(state.user.name)}</strong></p><p>${esc(state.user.email)}</p><p>Perfil: ${esc(({admin:'Administrador',editor:'Editor',viewer:'Leitor'})[state.user.role]||state.user.role)}</p></section></div>`;}
function calendarExport(){
 if(!state.documents.length)return toast('Cadastre documentos antes de exportar.',true);
 const safe=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,' ').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const events=state.documents.map(d=>{const dt=d.expires_on.replace(/-/g,'');return ['BEGIN:VEVENT',`UID:docprazo-${state.user.organization_id}-${d.id}@docprazo.local`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${dt}`,`SUMMARY:${safe('Vencimento: '+d.title)}`,`DESCRIPTION:${safe(d.category+' - '+(d.responsible||''))}`,'END:VEVENT'].join('\r\n');});
 const blob=new Blob(['BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//DocPrazo//Documentos//PT-BR\r\n'+events.join('\r\n')+'\r\nEND:VCALENDAR'],{type:'text/calendar;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='docprazo-vencimentos.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Calendário exportado.');
}
async function loadAttachments(docId){
 try {const result=await request(`/api/documents/${docId}/attachments`);state.attachments=result.attachments;const el=document.getElementById('attachments-list');if(!el)return;el.innerHTML=result.attachments.length?result.attachments.map(f=>`<div class="attach-item"><span>${ico('paperclip')} <strong>${esc(f.original_name)}</strong><small> ${(f.size/1024).toFixed(0)} KB · ${f.renewal_valid_until?'Comprovante da renovação até '+dateBR(f.renewal_valid_until):'Anexo anterior ou avulso'}</small></span><div class="row-actions"><a class="btn small" href="/api/attachments/${f.id}/download">Baixar</a>${canEdit()?`<button class="btn small" data-action="attachment-delete" data-id="${f.id}">Excluir</button>`:''}</div></div>`).join(''):'<div class="empty">Nenhum anexo armazenado.</div>';}catch(e){const el=document.getElementById('attachments-list');if(el)el.textContent=e.message;}
}
async function refreshDocsPreservingModal(){const result=await request('/api/documents');state.documents=result.documents;}
async function handleAttachmentUpload(form){
 const btn=document.getElementById('upload-submit'),errBox=document.getElementById('attachment-error'),file=form.elements.attachment.files[0];if(!file)return;
 if(file.size>5*1024*1024){errBox.textContent='O arquivo não pode ultrapassar 5 MB.';return;}
 btn.disabled=true;errBox.textContent='';
 try{const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});
 await request(`/api/documents/${state.modal.doc.id}/attachments`,{method:'POST',body:JSON.stringify({name:file.name,content:encoded})});await loadAttachments(state.modal.doc.id);await refreshDocsPreservingModal();form.reset();toast('Anexo enviado com sucesso.');}
 catch(e){errBox.textContent=e.message;}finally{btn.disabled=false;}
}
async function handleTeamSave(form){const err=document.getElementById('team-error'),btn=document.getElementById('team-submit');btn.disabled=true;err.textContent='';const member=state.modal.member;const data=Object.fromEntries(new FormData(form));if(member&&!data.password)delete data.password;try{await request(member?`/api/users/${member.id}`:'/api/users',{method:member?'PATCH':'POST',body:JSON.stringify(data)});state.team=(await request('/api/users')).users;state.modal=null;render();toast('Equipe atualizada.');}catch(e){err.textContent=e.message;btn.disabled=false;}}
async function handleOrgSave(form){const btn=form.querySelector('button');btn.disabled=true;try{const data=await request('/api/organization',{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(form)))});state.user.organization_name=data.name;render();toast('Empresa atualizada.');}catch(e){btn.disabled=false;toast(e.message,true);}}
async function handlePasswordChange(form){const btn=form.querySelector('button');btn.disabled=true;try{await request('/api/me/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();toast('Senha alterada. Outras sessões foram encerradas.');}catch(e){toast(e.message,true);}finally{btn.disabled=false;}}
async function handlePlatformSave(form){
 const id=state.modal.org.id,errEl=document.getElementById('platform-error'),body=Object.fromEntries(new FormData(form));
 try{await request(`/api/platform/organizations/${id}`,{method:'PATCH',body:JSON.stringify(body)});state.platform=await request('/api/platform/organizations');state.modal=null;render();toast('Acesso da empresa atualizado.');}catch(e){errEl.textContent=e.message;}
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button){event.preventDefault();handleAction(button).catch(e=>safeError(e.message));return;}if(event.target.id==='modal-backdrop'){state.modal=null;render();}});
document.addEventListener('submit',event=>{if(!['platform-form','auth-form','document-form','renew-form','attachment-form','team-form','org-form','password-form','notifications-form'].includes(event.target.id))return;event.preventDefault();if(event.target.id==='platform-form')handlePlatformSave(event.target);else if(event.target.id==='auth-form')handleAuth(event.target);else if(event.target.id==='document-form')handleDocSave(event.target);else if(event.target.id==='renew-form')handleRenew(event.target);else if(event.target.id==='attachment-form')handleAttachmentUpload(event.target);else if(event.target.id==='team-form')handleTeamSave(event.target);else if(event.target.id==='org-form')handleOrgSave(event.target);else if(event.target.id==='password-form')handlePasswordChange(event.target);else if(event.target.id==='notifications-form')handleNotificationsSave(event.target);});
document.addEventListener('input',event=>{if(event.target.id==='search-docs'){state.filters.query=event.target.value;rerenderDocs();}});
document.addEventListener('change',event=>{if(event.target.id==='filter-status'){state.filters.status=event.target.value;rerenderDocs();}if(event.target.id==='filter-category'){state.filters.category=event.target.value;rerenderDocs();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.modal){state.modal=null;render();}});
initialize();
