'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8').replace(/\binitialize\(\);\s*$/,'');
function context(){const ctx=vm.createContext({console,Date,Number,Blob,URL,URLSearchParams,Array,Map,Set,Intl,location:{search:""},window:{},document:{getElementById(){return {innerHTML:''};},addEventListener(){}},setTimeout,clearTimeout});vm.runInContext(src,ctx);return ctx;}
test('Interface V2 renderiza as telas de administrador e leitor sem erros',()=>{
 const c=context();
 const user={name:'Gestor Teste',email:'gestor@example.com',role:'admin',organization_id:3,organization_name:'Empresa de teste',id:1};
 const document={id:12,title:'Alvará',category:'Alvará',reference:'333',responsible:'Ana',expires_on:'2026-11-30',issue_date:'2026-01-01',lead_days:30,attachment_count:1,notes:''};
 vm.runInContext(`state.user=${JSON.stringify(user)};state.documents=${JSON.stringify([document])};state.team=[{id:1,name:'Gestor Teste',role:'admin',email:'gestor@example.com',active:1}];state.reports={renewals:1,attachments:1};state.notifications={email:'admin@example.com',enabled:true,provider_ready:false,schedule_enabled:false,last:null};`,c);
 for(const view of ['dashboard','documents','alerts','reports','team','audit','notifications','settings']){
  vm.runInContext(`state.view='${view}'`,c);const html=vm.runInContext('renderShell()',c);
  assert.match(html,/DocPrazo/);assert.ok(html.length>700,view);
 }
 vm.runInContext('state.modal={type:"attachments",doc:state.documents[0]}',c);assert.match(vm.runInContext('renderModal()',c),/attachment-form/);
 vm.runInContext('state.modal={type:"team",member:null}',c);assert.match(vm.runInContext('renderModal()',c),/team-form/);
 vm.runInContext('state.user.role="viewer";state.view="documents";state.modal=null',c);
 const viewer=vm.runInContext('renderShell()',c);
 assert.doesNotMatch(viewer,/data-action="delete"/);
 assert.doesNotMatch(viewer,/data-view="team"/);
 assert.match(viewer,/data-action="attachments"/);
});

test('Interface V3: assinatura, painel SaaS e recuperação aparecem sem quebrar navegação',()=>{
 const c=context();
 vm.runInContext(`state.user={id:5,name:'Proprietário',email:'owner@example.com',role:'admin',platform_owner:true,organization_name:'Minha empresa'};state.documents=[];state.billing={enabled:true,status:'trialing',valid_until:'2026-11-16',limits:{documents:50,users:3},checkout_ready:false,price_brl:99,events:[]};state.platform={companies:[{id:1,name:'Mercado Cliente',status:'trialing',plan:'founder',valid_until:'2026-11-16',documents:1,users:1}]}`,c);
 for(const view of ['billing','platform']){
  vm.runInContext(`state.view='${view}'`,c);
  const html=vm.runInContext('renderShell()',c);
  assert.match(html,view==='billing'?/Plano Fundador/:/Mercado Cliente/);
 }
 vm.runInContext('state.modal={type:"platform",org:state.platform.companies[0]}',c);
 assert.match(vm.runInContext('renderModal()',c),/platform-form/);
 vm.runInContext('state.user=null;state.modal=null;state.authMode="forgot";state.publicConfig={signup_enabled:true,recovery_enabled:true}',c);
 assert.match(vm.runInContext('renderAuth()',c),/Recuperar acesso/);
 vm.runInContext('state.authMode="login";state.publicConfig={signup_enabled:false,recovery_enabled:false}',c);
 assert.doesNotMatch(vm.runInContext('renderAuth()',c),/Cadastrar empresa/);
});
