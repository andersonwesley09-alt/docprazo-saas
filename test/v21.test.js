'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const base=fs.mkdtempSync(path.join(os.tmpdir(),'docprazo-v21-'));
process.env.DATA_DIR=base;
const {server,db}=require('../server');
let root;
async function req(uri,{method='GET',cookie,csrf,body,download=false}={}){
 const res=await fetch(root+uri,{method,headers:{...(cookie?{cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,data:download?Buffer.from(await res.arrayBuffer()):await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
function unpack(buf){const out={};let p=0;while(p<buf.length&&buf.readUInt32LE(p)===0x04034b50){const method=buf.readUInt16LE(p+8),size=buf.readUInt32LE(p+18),nameLen=buf.readUInt16LE(p+26),extraLen=buf.readUInt16LE(p+28),name=buf.subarray(p+30,p+30+nameLen).toString(),start=p+30+nameLen+extraLen;out[name]=(method===8?zlib.inflateRawSync(buf.subarray(start,start+size)):buf.subarray(start,start+size)).toString();p=start+size;}return out;}
const document=(title,expires_on)=>({title,category:'Alvará',reference:'TESTE-001',responsible:'Administrativo',issue_date:'2026-01-01',expires_on,lead_days:30,notes:'Observação fictícia'});
test('V2.1: Excel completo/filtrado, isolamento e renovação com PDF atômica',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));root='http://127.0.0.1:'+server.address().port;
 try{
  const a=await req('/api/signup',{method:'POST',body:{name:'Ana',organization_name:'Mercado Teste',email:'a21@example.com',password:'Senha123456'}});
  const b=await req('/api/signup',{method:'POST',body:{name:'Bruno',organization_name:'Empresa B',email:'b21@example.com',password:'Senha123456'}});
  assert.equal(a.status,201);assert.equal(b.status,201);
  const ma=(await req('/api/me',{cookie:a.cookie})).data,mb=(await req('/api/me',{cookie:b.cookie})).data;
  assert.equal((await req('/api/exports/documents.xlsx',{download:true})).status,401);
  const v=await req('/api/documents',{method:'POST',cookie:a.cookie,csrf:ma.csrf,body:document('Alvará vencido','2026-01-02')});assert.equal(v.status,201);
  const formula=await req('/api/documents',{method:'POST',cookie:a.cookie,csrf:ma.csrf,body:{...document('=HYPERLINK("https://teste")','2028-01-01'),category:'Seguro'}});assert.equal(formula.status,201);
  assert.equal((await req('/api/documents',{method:'POST',cookie:b.cookie,csrf:mb.csrf,body:document('SEGREDO B','2027-07-01')})).status,201);
  const all=await req('/api/exports/documents.xlsx?scope=all',{cookie:a.cookie,download:true});assert.equal(all.status,200);assert.equal(all.data.subarray(0,2).toString(),'PK');
  const files=unpack(all.data);assert.ok(files['xl/workbook.xml']);assert.ok(files['xl/styles.xml'].includes('dd/mm/yyyy'));
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('Alvará vencido'));
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('=HYPERLINK('));
  assert.ok(!files['xl/worksheets/sheet1.xml'].includes('SEGREDO B'));
  assert.equal((files['xl/worksheets/sheet1.xml'].match(/<row r="1[01]"/g)||[]).length,2);
  assert.match(files['xl/worksheets/sheet1.xml'],/autoFilter ref="A9:L11"/);
  const filtered=await req('/api/exports/documents.xlsx?scope=filtered&status=expired',{cookie:a.cookie,download:true});assert.equal(filtered.status,200);
  const filteredXml=unpack(filtered.data)['xl/worksheets/sheet1.xml'];assert.ok(filteredXml.includes('Alvará vencido'));assert.ok(!filteredXml.includes('HYPERLINK'));
  const filteredSearch=await req('/api/exports/documents.xlsx?scope=filtered&query=HYPERLINK&category=Seguro',{cookie:a.cookie,download:true});assert.equal(filteredSearch.status,200);
  assert.ok(unpack(filteredSearch.data)['xl/worksheets/sheet1.xml'].includes('HYPERLINK'));
  assert.equal((await req('/api/exports/documents.xlsx?scope=filtered&query=inexistente',{cookie:a.cookie})).status,400);
  const pdf=Buffer.from('%PDF-1.4\n%arquivo ficticio\n');
  const before=(await req(`/api/documents/${v.data.document.id}`,{cookie:a.cookie})).data.document.expires_on;
  const bad=await req(`/api/documents/${v.data.document.id}/renew`,{method:'POST',cookie:a.cookie,csrf:ma.csrf,body:{expires_on:'2028-10-20',note:'Renovação',attachment:{name:'falso.pdf',content:Buffer.from('nao eh pdf').toString('base64')}}});
  assert.equal(bad.status,400);
  assert.equal((await req(`/api/documents/${v.data.document.id}`,{cookie:a.cookie})).data.document.expires_on,before);
  const renewed=await req(`/api/documents/${v.data.document.id}/renew`,{method:'POST',cookie:a.cookie,csrf:ma.csrf,body:{expires_on:'2028-10-20',note:'Comprovante registrado',attachment:{name:'comprovante-2028.pdf',content:pdf.toString('base64')}}});
  assert.equal(renewed.status,200,JSON.stringify(renewed.data));
  assert.equal(renewed.data.document.expires_on,'2028-10-20');
  const attachments=(await req(`/api/documents/${v.data.document.id}/attachments`,{cookie:a.cookie})).data.attachments;
  assert.equal(attachments.length,1);assert.equal(attachments[0].renewal_valid_until,'2028-10-20');
  assert.equal((await req(`/api/attachments/${attachments[0].id}/download`,{cookie:a.cookie,download:true})).data.equals(pdf),true);
  assert.equal((await req(`/api/attachments/${attachments[0].id}/download`,{cookie:b.cookie})).status,404);
  assert.equal((await req('/api/exports/documents.xlsx?scope=all',{cookie:b.cookie,download:true})).status,200);
  assert.ok(!unpack((await req('/api/exports/documents.xlsx?scope=all',{cookie:b.cookie,download:true})).data)['xl/worksheets/sheet1.xml'].includes('Alvará vencido'));
 }finally{await new Promise(r=>server.close(r));db.close();fs.rmSync(base,{recursive:true,force:true});}
});
