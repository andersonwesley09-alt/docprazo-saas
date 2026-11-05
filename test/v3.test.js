'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'docprazo-v3-'));
process.env.DATA_DIR=dir;
process.env.MP_ACCESS_TOKEN='TOKEN_TESTE_FICTICIO';
process.env.MP_WEBHOOK_SECRET='segredo-para-testes-ficticio';
process.env.APP_PUBLIC_URL='https://docprazo.example.com';
const {server,db}=require('../server');
let root;const originalFetch=global.fetch;
const id='1234567890123456';
let mpStatus='pending';
function fakeRemote(){return {id,external_reference:'docprazo-org-1',payer_email:'ana@example.com',status:mpStatus,auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:99,currency_id:'BRL'}};}
global.fetch=async function(u,opts={}){
 const url=String(u);
 if(url==='https://api.mercadopago.com/preapproval')return new Response(JSON.stringify({id,init_point:'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id='+id}),{status:201,headers:{'Content-Type':'application/json'}});
 if(url===`https://api.mercadopago.com/preapproval/${id}`)return new Response(JSON.stringify(fakeRemote()),{status:200,headers:{'Content-Type':'application/json'}});
 return originalFetch(u,opts);
};
async function req(url,{method='GET',cookie,csrf,body,headers={},raw=false}={}){
 const result=await fetch(root+url,{method,headers:{...(cookie?{cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 return {status:result.status,data:raw?Buffer.from(await result.arrayBuffer()):await result.json(),cookie:result.headers.get('set-cookie')?.split(';')[0]};
}
test('V3 comercial: períodos, quotas, dono, checkout, webhook HMAC, expiração e isolamento',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root='http://127.0.0.1:'+server.address().port;
 try{
  const a=await req('/api/signup',{method:'POST',body:{name:'Ana',email:'ana@example.com',organization_name:'Mercado A',password:'SenhaSuper123'}});
  const b=await req('/api/signup',{method:'POST',body:{name:'Bia',email:'bia@example.com',organization_name:'Mercado B',password:'SenhaSuper123'}});
  assert.equal(a.status,201);assert.equal(b.status,201);
  const me=(await req('/api/me',{cookie:a.cookie})).data;
  assert.equal((await req('/api/platform/organizations',{cookie:a.cookie})).status,403);
  const initial=(await req('/api/billing',{cookie:a.cookie})).data;
  assert.equal(initial.status,'trialing');assert.equal(initial.enabled,true);assert.equal(initial.limits.documents,50);
  const doc={title:'Licença',category:'Licença',expires_on:'2027-12-10',lead_days:30};
  assert.equal((await req('/api/documents',{method:'POST',cookie:a.cookie,csrf:me.csrf,body:doc})).status,201);
  assert.equal((await req('/api/documents',{cookie:b.cookie})).data.documents.length,0);
  // Dono é promovido via comando local, não por dados enviados ao cadastro.
  db.prepare('UPDATE users SET platform_owner=1 WHERE email=?').run('ana@example.com');
  const owner=await req('/api/platform/organizations',{cookie:a.cookie});assert.equal(owner.status,200);
  assert.equal(owner.data.companies.length,2);
  assert.ok(!JSON.stringify(owner.data).includes('Licença'));
  assert.equal((await req('/api/platform/organizations',{cookie:b.cookie})).status,403);
  assert.equal((await req('/api/platform/organizations/2',{cookie:a.cookie,csrf:me.csrf,method:'PATCH',body:{status:'courtesy',valid_until:'2027-03-01'}})).status,200);
  db.prepare('UPDATE subscriptions SET valid_until=? WHERE organization_id=1').run('2020-01-01');
  const expired=(await req('/api/billing',{cookie:a.cookie})).data;assert.equal(expired.enabled,false);
  assert.equal((await req('/api/documents',{cookie:a.cookie})).data.documents.length,1);
  assert.equal((await req('/api/documents',{method:'POST',cookie:a.cookie,csrf:me.csrf,body:doc})).status,402);
  assert.equal((await req('/api/me/password',{method:'POST',cookie:a.cookie,csrf:me.csrf,body:{current_password:'SenhaSuper123',new_password:'NovaSenha123'}})).status,200);
  assert.equal((await req('/api/platform/organizations/1',{cookie:a.cookie,csrf:me.csrf,method:'PATCH',body:{status:'trialing',valid_until:'2027-01-01'}})).status,200);
  // Checkout usa servidor, não retorna pagamento confirmado.
  const checkout=await req('/api/billing/checkout',{method:'POST',cookie:a.cookie,csrf:me.csrf});assert.equal(checkout.status,200,JSON.stringify(checkout.data));
  assert.match(checkout.data.url,/mercadopago/);
  assert.equal((await req('/api/billing/checkout',{method:'POST',cookie:a.cookie,csrf:me.csrf})).status,409);
  assert.equal((await req('/api/platform/organizations/1',{cookie:a.cookie,csrf:me.csrf,method:'PATCH',body:{status:'courtesy',valid_until:'2027-03-01'}})).status,409);
  assert.notEqual((await req('/api/billing',{cookie:a.cookie})).data.status,'active');
  const ts=String(Math.floor(Date.now()/1000)),requestId='id-req-teste',manifest=`id:${id};request-id:${requestId};ts:${ts};`;
  const sig=crypto.createHmac('sha256',process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');
  const webhookUrl=`/api/webhooks/mercadopago?data.id=${id}`;
  assert.equal((await req(webhookUrl,{method:'POST',body:{type:'subscription_preapproval',data:{id}}})).status,401);
  // Webhook genuíno, mas assinatura pendente, NÃO ativa a empresa.
  const headers={'x-request-id':requestId,'x-signature':`ts=${ts},v1=${sig}`};
  assert.equal((await req(webhookUrl,{method:'POST',headers,body:{type:'subscription_preapproval',data:{id}}})).status,200);
  assert.notEqual((await req('/api/billing',{cookie:a.cookie})).data.status,'active');
  mpStatus='authorized';
  assert.equal((await req(webhookUrl,{method:'POST',headers,body:{type:'subscription_preapproval',data:{id}}})).status,200);
  assert.equal((await req('/api/billing',{cookie:a.cookie})).data.status,'active');
  assert.equal((await req('/api/documents',{method:'POST',cookie:a.cookie,csrf:me.csrf,body:doc})).status,201);
  // Webhook não autoriza outra empresa por referência incorreta.
  assert.equal((await req('/api/billing',{cookie:b.cookie})).data.status,'courtesy');
  assert.equal((await req('/api/password/forgot',{method:'POST',body:{email:'naoexiste@exemplo.com'}})).status,200);
 }finally{await new Promise(r=>server.close(r));db.close();global.fetch=originalFetch;fs.rmSync(dir,{recursive:true,force:true});}
});
