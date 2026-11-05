'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docprazo-test-'));
process.env.DATA_DIR = tmp;
const {server, db} = require('../server');
let root;
let close;
async function call(url,{method='GET',cookie='',csrf='',body}={}) {
 const r=await fetch(root+url,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};
}
function doc(title='Alvará'){return {title,category:'Alvará',reference:'123',responsible:'Admin',issue_date:'2026-01-01',expires_on:'2027-10-20',lead_days:30,notes:'Teste'};}
test('Fluxo completo, isolamento e proteção contra acesso indevido',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root=`http://127.0.0.1:${server.address().port}`;
 try {
  const a=await call('/api/signup',{method:'POST',body:{name:'Ana',organization_name:'Empresa A',email:'ana@example.com',password:'Senha123!'}});
  assert.equal(a.status,201);
  const b=await call('/api/signup',{method:'POST',body:{name:'Bruno',organization_name:'Empresa B',email:'bruno@example.com',password:'Senha123!'}});
  assert.equal(b.status,201);
  assert.ok(a.cookie.includes('docprazo_session'));
  const ma=await call('/api/me',{cookie:a.cookie});assert.equal(ma.status,200);
  const mb=await call('/api/me',{cookie:b.cookie});assert.equal(mb.status,200);
  assert.notEqual(ma.data.user.organization_id,mb.data.user.organization_id);
  const item=await call('/api/documents',{method:'POST',cookie:a.cookie,csrf:ma.data.csrf,body:doc()});
  assert.equal(item.status,201);const id=item.data.document.id;
  assert.equal((await call('/api/documents',{cookie:a.cookie})).data.documents.length,1);
  assert.equal((await call('/api/documents',{cookie:b.cookie})).data.documents.length,0);
  assert.equal((await call(`/api/documents/${id}`,{method:'DELETE',cookie:b.cookie,csrf:mb.data.csrf})).status,404);
  assert.equal((await call(`/api/documents/${id}`,{method:'PATCH',cookie:b.cookie,csrf:mb.data.csrf,body:doc('Ataque')})).status,404);
  assert.equal((await call(`/api/documents/${id}/renew`,{method:'POST',cookie:b.cookie,csrf:mb.data.csrf,body:{expires_on:'2028-10-20'}})).status,404);
  assert.equal((await call(`/api/documents/${id}/history`,{cookie:b.cookie})).status,404);
  assert.equal((await call(`/api/documents/${id}`,{method:'DELETE',cookie:a.cookie})).status,403);
  assert.equal((await call('/api/documents',{method:'POST',cookie:a.cookie,csrf:ma.data.csrf,body:{...doc(),expires_on:'2027-02-30'}})).status,400);
  const renewed=await call(`/api/documents/${id}/renew`,{method:'POST',cookie:a.cookie,csrf:ma.data.csrf,body:{expires_on:'2028-10-20',note:'Renovado'}});
  assert.equal(renewed.status,200);
  assert.equal(renewed.data.document.expires_on,'2028-10-20');
  const history=await call(`/api/documents/${id}/history`,{cookie:a.cookie});
  assert.equal(history.data.renewals.length,1);
  const edit=await call(`/api/documents/${id}`,{method:'PATCH',cookie:a.cookie,csrf:ma.data.csrf,body:doc('Alvará novo')});
  assert.equal(edit.status,200);
  assert.equal(edit.data.document.title,'Alvará novo');
  assert.equal((await call(`/api/documents/${id}`,{method:'DELETE',cookie:a.cookie,csrf:ma.data.csrf})).status,200);
  assert.equal((await call('/api/documents',{cookie:a.cookie})).data.documents.length,0);
  const logout=await call('/api/logout',{method:'POST',cookie:a.cookie,csrf:ma.data.csrf});assert.equal(logout.status,200);
  assert.equal((await call('/api/me',{cookie:a.cookie})).status,401);
  const login=await call('/api/login',{method:'POST',body:{email:'ana@example.com',password:'Senha123!'}});
  assert.equal(login.status,200);
  assert.equal((await call('/api/me',{cookie:login.cookie})).status,200);
 } finally {
  await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(tmp,{recursive:true,force:true});
 }
});
