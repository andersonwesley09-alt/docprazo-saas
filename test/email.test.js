'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {recipients,buildMessage}=require('../reminder-service');

test('Destinatários: deduplicação, limites e HTML seguro',()=>{
 assert.deepEqual(recipients('Ana@Example.com; ana@example.com, gestor@example.com'),['ana@example.com','gestor@example.com']);
 assert.throws(()=>recipients('email-invalido'));
 assert.throws(()=>recipients('a@b.com,b@b.com,c@b.com,d@b.com,e@b.com,f@b.com'));
 const msg=buildMessage('Mercado <Teste>',[{title:'<script>teste</script>',category:'Alvará',expires_on:'2026-10-01',days_left:-1}], '2026-11-02', 'https://docprazo.example.com');
 assert.ok(!msg.html.includes('<script>'));
 assert.match(msg.html,/&lt;script&gt;/);
 assert.match(msg.html,/Mercado &lt;Teste&gt;/);
});

test('Alertas da V3.1: prévia, teste independente, resumo diário, logs e isolamento',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'docprazo-v31-'));
 const originalFetch=global.fetch;
 process.env.DATA_DIR=dir;
 process.env.RESEND_API_KEY='re_test_fake';
 process.env.REMINDER_FROM_EMAIL='DocPrazo <avisos@exemplo.com>';
 process.env.REMINDERS_SCHEDULE_ENABLED='1';
 process.env.APP_PUBLIC_URL='https://docprazo.example.com';
 const {server,db}=require('../server');
 let base, messages=[],failNext=false;
 global.fetch=async (url,opts={})=>{
   if(String(url)==='https://api.resend.com/emails'){
     const body=JSON.parse(opts.body);
     messages.push({body,headers:opts.headers});
     if(failNext){failNext=false;return new Response(JSON.stringify({message:'erro intencional'}),{status:403,headers:{'Content-Type':'application/json'}});}
     return new Response(JSON.stringify({id:'em_mock_'+messages.length}),{status:200,headers:{'Content-Type':'application/json'}});
   }
   return originalFetch(url,opts);
 };
 async function api(url,{method='GET',cookie,csrf,body}={}){
   const r=await fetch(base+url,{method,headers:{...(cookie?{cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 }
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 try{
   const a=await api('/api/signup',{method:'POST',body:{name:'Administradora',email:'admina@example.com',organization_name:'Empresa A',password:'SenhaSegura123'}});
   const b=await api('/api/signup',{method:'POST',body:{name:'Administrador B',email:'adminb@example.com',organization_name:'Empresa B',password:'SenhaSegura123'}});
   assert.equal(a.status,201);assert.equal(b.status,201);
   const csA=(await api('/api/me',{cookie:a.cookie})).data.csrf;
   const csB=(await api('/api/me',{cookie:b.cookie})).data.csrf;
   const doc={title:'Alvará com alerta',category:'Alvará',expires_on:'2020-01-01',lead_days:30};
   assert.equal((await api('/api/documents',{cookie:a.cookie,csrf:csA,method:'POST',body:doc})).status,201);
   assert.equal((await api('/api/documents',{cookie:b.cookie,csrf:csB,method:'POST',body:{...doc,title:'Documento privado Empresa B'}})).status,201);
   assert.equal((await api('/api/notifications/preview',{cookie:b.cookie})).data.count,1);
   const preview=(await api('/api/notifications/preview',{cookie:a.cookie}));
   assert.equal(preview.status,200);assert.equal(preview.data.count,1);
   assert.ok(!JSON.stringify(preview.data).includes('Documento privado Empresa B'));
   const bad=await api('/api/notifications',{method:'PATCH',cookie:a.cookie,csrf:csA,body:{email:'email-ruim',enabled:true}});
   assert.equal(bad.status,400);
   const prefs=await api('/api/notifications',{method:'PATCH',cookie:a.cookie,csrf:csA,body:{email:'alertasa@example.com; gestor@example.com',enabled:true}});
   assert.equal(prefs.status,200);
   let status=await api('/api/notifications',{cookie:a.cookie});
   assert.equal(status.data.provider_ready,true);assert.equal(status.data.schedule_enabled,true);
   const testSend=await api('/api/notifications/test',{method:'POST',cookie:a.cookie,csrf:csA});
   assert.equal(testSend.status,200,JSON.stringify(testSend.data));
   assert.equal(testSend.data.accepted,true);
   assert.equal(messages[0].body.to.length,2);
   assert.equal(messages[0].body.subject,'DocPrazo | Teste de envio de e-mail');
   assert.equal((await api('/api/notifications/test',{method:'POST',cookie:a.cookie,csrf:csA})).status,429);
   assert.equal((await api('/api/notifications',{cookie:b.cookie})).data.history.length,0);
   const send=await api('/api/notifications/send',{method:'POST',cookie:a.cookie,csrf:csA});
   assert.equal(send.status,200,JSON.stringify(send.data));
   assert.equal(send.data.count,1);assert.equal(messages[1].body.to.length,2);
   assert.equal((await api('/api/notifications/send',{method:'POST',cookie:a.cookie,csrf:csA})).status,409);
   assert.equal(messages.length,2);
   assert.equal((await api('/api/notifications',{cookie:a.cookie})).data.history.length,2);
   const bPrefs=await api('/api/notifications',{method:'PATCH',cookie:b.cookie,csrf:csB,body:{email:'alertasb@example.com',enabled:true}});
   assert.equal(bPrefs.status,200);
   failNext=true;
   const badProvider=await api('/api/notifications/send',{method:'POST',cookie:b.cookie,csrf:csB});
   assert.equal(badProvider.status,400);
   assert.match(badProvider.data.error,/Remetente ou destinatário/);
   assert.equal((await api('/api/notifications',{cookie:b.cookie})).data.history[0].status,'failed');
   assert.equal((await api('/api/notifications/send',{method:'POST',cookie:b.cookie,csrf:csB})).status,200);
   assert.equal((await api('/api/notifications',{cookie:b.cookie})).data.history[0].status,'accepted');
   const user=await api('/api/users',{method:'POST',cookie:a.cookie,csrf:csA,body:{name:'Consulta',email:'leitor@example.com',role:'viewer',password:'SenhaSegura123'}});
   assert.equal(user.status,201);
   const viewer=await api('/api/login',{method:'POST',body:{email:'leitor@example.com',password:'SenhaSegura123'}});
   const vCs=(await api('/api/me',{cookie:viewer.cookie})).data.csrf;
   assert.equal((await api('/api/notifications/preview',{cookie:viewer.cookie})).status,403);
   assert.equal((await api('/api/notifications/test',{method:'POST',cookie:viewer.cookie,csrf:vCs})).status,403);
 }finally{
   await new Promise(r=>server.close(r));db.close();global.fetch=originalFetch;
   fs.rmSync(dir,{recursive:true,force:true});
 }
});
