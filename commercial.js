'use strict';
// Camada comercial piloto do DocPrazo: assinatura, limites e conciliação.
// Nenhum webhook altera acesso antes da validação de assinatura E consulta autenticada ao MP.
const crypto=require('node:crypto');
const PRICE=99;
const FOUNDING_LIMITS={documents:100,users:5};
const TRIAL_LIMITS={documents:50,users:3};
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function isoPlus(days){let d=new Date(`${today()}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T00:00:00Z'));}
function setup(db){
 db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
 organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 plan TEXT NOT NULL DEFAULT 'founder',status TEXT NOT NULL DEFAULT 'trialing',
 valid_until TEXT NOT NULL,mp_subscription_id TEXT UNIQUE,payer_email TEXT,source TEXT NOT NULL DEFAULT 'trial',
 updated_at TEXT NOT NULL DEFAULT (datetime('now')));
 CREATE TABLE IF NOT EXISTS password_resets (
 token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS subscription_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER NOT NULL REFERENCES organizations(id),
 event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT(datetime('now')));
 CREATE INDEX IF NOT EXISTS idx_subscription_events ON subscription_events(organization_id,id DESC);`);
 const cols=db.prepare('PRAGMA table_info(users)').all().map(x=>x.name);
 if(!cols.includes('platform_owner'))db.exec('ALTER TABLE users ADD COLUMN platform_owner INTEGER NOT NULL DEFAULT 0');
 const subCols=db.prepare('PRAGMA table_info(subscriptions)').all().map(x=>x.name);
 if(!subCols.includes('payer_email'))db.exec('ALTER TABLE subscriptions ADD COLUMN payer_email TEXT');
 const old=db.prepare('SELECT id FROM organizations WHERE id NOT IN (SELECT organization_id FROM subscriptions)').all();
 // Empresa já existente recebe 30 dias para migração e adaptação.
 const stmt=db.prepare("INSERT OR IGNORE INTO subscriptions(organization_id,valid_until,source) VALUES (?,?,'legacy-trial')");
 for(const o of old)stmt.run(o.id,isoPlus(30));
}
function createCommercial({db,json,err,bodyJSON,text,validPassword,passwordHash,audit,mailAvailable}) {
 setup(db);
 const rate=new Map();
 const subByOrg=db.prepare('SELECT * FROM subscriptions WHERE organization_id=?');
 const saveEvent=db.prepare('INSERT INTO subscription_events(organization_id,event,detail) VALUES (?,?,?)');
 const isOwner=user=>Boolean(user && db.prepare('SELECT platform_owner FROM users WHERE id=?').get(user.id)?.platform_owner);
 function summary(orgId){
   const sub=subByOrg.get(orgId);
   if(!sub)return {status:'unavailable',enabled:false,plan:'founder',price_brl:PRICE,valid_until:null,limits:TRIAL_LIMITS};
   const enabled=['trialing','active','courtesy'].includes(sub.status)&&sub.valid_until>=today();
   const limits=sub.status==='trialing'?TRIAL_LIMITS:FOUNDING_LIMITS;
   return {status:sub.status,enabled,plan:sub.plan,price_brl:PRICE,valid_until:sub.valid_until,source:sub.source,limits,checkout_ready:Boolean(process.env.MP_ACCESS_TOKEN&&process.env.APP_PUBLIC_URL),provider:sub.mp_subscription_id?'mercadopago':null};
 }
 function limited(orgId,resource){
   const sub=summary(orgId);
   if(!sub.enabled)return {ok:false,message:'Seu período de teste ou assinatura expirou. Consulte a aba Assinatura para continuar.'};
   const max=sub.limits[resource];
   const count=resource==='documents'?db.prepare('SELECT COUNT(*) n FROM documents WHERE organization_id=?').get(orgId).n:db.prepare('SELECT COUNT(*) n FROM users WHERE organization_id=? AND active=1').get(orgId).n;
   return count>=max?{ok:false,message:`Limite de ${max} ${resource==='documents'?'documentos':'usuários'} atingido no plano atual.`}:{ok:true};
 }
 function ensure(orgId){const sub=summary(orgId);return sub.enabled?null:'Assinatura ou período de teste encerrado. Os documentos continuam disponíveis para consulta e exportação.';}
 function allow(req){const ip=req.socket.remoteAddress||'unknown',now=Date.now();const v=rate.get(ip)||{until:now+900000,count:0};if(v.until<now){v.until=now+900000;v.count=0;}v.count++;rate.set(ip,v);return v.count<=5;}
 function secureCompare(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
 async function sendEmail(to,subject,html){
   if(!mailAvailable())throw new Error('Serviço de e-mail ainda não configurado.');
   const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.RESEND_API_KEY}`},body:JSON.stringify({from:process.env.REMINDER_FROM_EMAIL,to:[to],subject,html})});
   if(!r.ok)throw new Error('O serviço de e-mail recusou a solicitação.');
 }
 function validWebhook(req,id){
   const secret=process.env.MP_WEBHOOK_SECRET;
   if(!secret||!id)return false;
   const sig=String(req.headers['x-signature']||'');
   const parts=Object.fromEntries(sig.split(',').map(x=>x.trim().split('=')));
   if(!/^\d+$/.test(parts.ts||'')||!/^[a-f0-9]{64}$/i.test(parts.v1||''))return false;
   const n=Number(parts.ts);const timestamp=n>1e12?n:n*1000;
   if(Math.abs(Date.now()-timestamp)>10*60*1000)return false;
   const requestId=String(req.headers['x-request-id']||'');
   const manifest=`id:${String(id).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
   const computed=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
   return secureCompare(computed,parts.v1);
 }
 async function mpSubscription(id){
   if(!process.env.MP_ACCESS_TOKEN)throw new Error('Mercado Pago não configurado.');
   const r=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${process.env.MP_ACCESS_TOKEN}`}});
   if(!r.ok)throw new Error('Não foi possível validar a assinatura no Mercado Pago.');
   return r.json();
 }
 function applyMp(provider,expectedId){
   const row=db.prepare('SELECT * FROM subscriptions WHERE mp_subscription_id=?').get(expectedId);
   if(!row||String(provider.id)!==String(expectedId)||provider.external_reference!==`docprazo-org-${row.organization_id}`)return false;
   if(!row.payer_email||row.payer_email.toLowerCase()!==String(provider.payer_email||'').toLowerCase())return false;
   const rec=provider.auto_recurring||{};
   if(rec.currency_id!=='BRL'||Number(rec.transaction_amount)!==PRICE||Number(rec.frequency)!==1||rec.frequency_type!=='months')return false;
   const allowed=['authorized','paused','cancelled','pending'];if(!allowed.includes(provider.status))return false;
   // A condição 'authorized' indica assinatura autorizada pelo provedor,
   // não prova a liquidação de todas as parcelas futuras.
   let status=provider.status==='authorized'?'active':provider.status==='paused'?'past_due':provider.status==='cancelled'?'canceled':row.status;
   let valid=row.valid_until;
   if(status==='active')valid=isoPlus(35); // período de rechecagem, sem renovação local automática.
   if(status==='canceled'||status==='past_due')valid=today();
   db.prepare("UPDATE subscriptions SET status=?,valid_until=?,source='mercadopago',updated_at=datetime('now') WHERE organization_id=?").run(status,valid,row.organization_id);
   saveEvent.run(row.organization_id,'mercadopago.synced',`${provider.status} · ${expectedId.slice(0,18)}`);
   return true;
 }
 async function publicRoute(req,res,pathname){
   if(pathname==='/api/public-config'&&req.method==='GET')return json(res,200,{signup_enabled:process.env.NODE_ENV!=='production'||process.env.ALLOW_PUBLIC_SIGNUP==='1',recovery_enabled:Boolean(mailAvailable()&&process.env.APP_PUBLIC_URL),environment:process.env.NODE_ENV==='production'?'production':'development'});
   if(pathname==='/api/password/forgot'&&req.method==='POST'){
     if(!allow(req))return err(res,429,'Muitas solicitações. Tente novamente mais tarde.');
     const data=await bodyJSON(req),email=text(data.email,190).toLowerCase();
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err(res,400,'Informe um e-mail válido.');
     const user=db.prepare('SELECT id,email FROM users WHERE email=? AND active=1').get(email);
     if(user&&mailAvailable()&&process.env.APP_PUBLIC_URL){
       const token=crypto.randomBytes(32).toString('base64url'),hash=crypto.createHash('sha256').update(token).digest('hex');
       db.prepare('DELETE FROM password_resets WHERE user_id=?').run(user.id);
       db.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES (?,?,?)').run(hash,user.id,Date.now()+30*60*1000);
       const url=`${process.env.APP_PUBLIC_URL.replace(/\/$/,'')}/?reset=${encodeURIComponent(token)}`;
       try{await sendEmail(email,'DocPrazo — redefinição de senha',`<p>Foi solicitada a troca de senha do DocPrazo.</p><p><a href="${url}">Redefinir senha</a> (válido por 30 minutos).</p><p>Se você não solicitou, ignore esta mensagem.</p>`);}catch(e){console.warn('[DocPrazo recuperação]',e.message);}
     }
     return json(res,200,{message:'Se a conta existir e o e-mail estiver configurado, você receberá instruções.'});
   }
   if(pathname==='/api/password/reset'&&req.method==='POST'){
     if(!allow(req))return err(res,429,'Muitas solicitações. Tente novamente mais tarde.');
     const body=await bodyJSON(req),token=text(body.token,100);
     if(!validPassword(body.password)||token.length<20)return err(res,400,'Token ou senha inválidos.');
     const hash=crypto.createHash('sha256').update(token).digest('hex');
     const row=db.prepare('SELECT * FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>?').get(hash,Date.now());
     if(!row)return err(res,400,'Link inválido ou expirado.');
     db.exec('BEGIN IMMEDIATE');
     try{
       db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash(body.password),row.user_id);
       db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
       db.prepare('UPDATE password_resets SET used=1 WHERE token_hash=?').run(hash);
       db.exec('COMMIT');
     }catch(e){db.exec('ROLLBACK');throw e;}
     return json(res,200,{success:true});
   }
   if(pathname==='/api/webhooks/mercadopago'&&req.method==='POST'){
     const qs=new URL(req.url,'http://localhost').searchParams;
     const id=qs.get('data.id');
     if(!id||!/^\d{5,80}$|^[a-zA-Z0-9-]{10,100}$/.test(id))return err(res,400,'Identificador inválido.');
     if(!validWebhook(req,id))return err(res,401,'Assinatura de webhook inválida.');
     const data=await bodyJSON(req);
     if(!['subscription_preapproval','preapproval'].includes(data.type||data.topic))return json(res,200,{ignored:true});
     if(data.data&&String(data.data.id)!==id)return err(res,400,'Identificador inconsistente.');
     const remote=await mpSubscription(id);
     if(!applyMp(remote,id))return json(res,200,{ignored:true});
     return json(res,200,{received:true});
   }
   return null;
 }
 async function userRoute(req,res,pathname,user){
   if(pathname==='/api/billing'&&req.method==='GET'){
     const data=summary(user.organization_id),events=db.prepare('SELECT event,detail,created_at FROM subscription_events WHERE organization_id=? ORDER BY id DESC LIMIT 20').all(user.organization_id);
     return json(res,200,{...data,events});
   }
   if(pathname==='/api/billing/checkout'&&req.method==='POST'){
     if(user.role!=='admin')return err(res,403,'Somente o administrador pode contratar a assinatura.');
     if(!process.env.MP_ACCESS_TOKEN||!process.env.APP_PUBLIC_URL)return err(res,503,'Checkout ainda não habilitado. Configure Mercado Pago e o domínio.');
     const existing=subByOrg.get(user.organization_id);
     if(existing?.mp_subscription_id)return err(res,409,'Já existe uma assinatura iniciada. Utilize Verificar situação ou entre em contato com o suporte para evitar cobranças duplicadas.');
     const payload={reason:'DocPrazo — Plano Fundador',external_reference:`docprazo-org-${user.organization_id}`,payer_email:user.email,auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:PRICE,currency_id:'BRL'},back_url:process.env.APP_PUBLIC_URL.replace(/\/$/,'')+'/?checkout=retorno',status:'pending'};
     const response=await fetch('https://api.mercadopago.com/preapproval',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${process.env.MP_ACCESS_TOKEN}`,'Content-Type':'application/json','X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(payload)});
     const out=await response.json().catch(()=>({}));
     if(!response.ok||!out.id||!/^https:\/\//.test(String(out.init_point||'')))return err(res,502,'O provedor não conseguiu gerar a assinatura. Tente novamente.');
     const checkoutUrl=new URL(out.init_point);
     if(!/(^|\.)mercadopago\.com(\.br|\.ar|\.mx|\.co)?$/.test(checkoutUrl.hostname)&&!checkoutUrl.hostname.endsWith('.mercadopago.com.br'))return err(res,502,'URL de pagamento não reconhecida.');
     db.prepare("UPDATE subscriptions SET mp_subscription_id=?,payer_email=?,updated_at=datetime('now') WHERE organization_id=?").run(String(out.id),user.email,user.organization_id);
     saveEvent.run(user.organization_id,'checkout.created',String(out.id).slice(0,32));
     audit(user,'billing.checkout','Assinatura','Checkout iniciado no Mercado Pago');
     return json(res,200,{url:out.init_point});
   }
   if(pathname==='/api/billing/sync'&&req.method==='POST'){
     if(user.role!=='admin')return err(res,403,'Somente administradores.');
     const row=subByOrg.get(user.organization_id);
     if(!row.mp_subscription_id)return err(res,400,'Nenhuma assinatura do Mercado Pago vinculada.');
     if(!process.env.MP_ACCESS_TOKEN)return err(res,503,'Mercado Pago não configurado.');
     const remote=await mpSubscription(row.mp_subscription_id);
     if(!applyMp(remote,row.mp_subscription_id))return err(res,409,'A assinatura não confere com os dados da empresa.');
     return json(res,200,summary(user.organization_id));
   }
   if(pathname==='/api/platform/organizations'&&req.method==='GET'){
     if(!isOwner(user))return err(res,403,'Acesso exclusivo da administração da plataforma.');
     const rows=db.prepare(`SELECT o.id,o.name,o.created_at,s.plan,s.status,s.source,s.valid_until,
      (SELECT COUNT(*) FROM documents d WHERE d.organization_id=o.id) AS documents,
      (SELECT COUNT(*) FROM users u WHERE u.organization_id=o.id AND u.active=1) AS users
      FROM organizations o LEFT JOIN subscriptions s ON s.organization_id=o.id ORDER BY o.id DESC LIMIT 500`).all();
     return json(res,200,{companies:rows});
   }
   const ownerMatch=pathname.match(/^\/api\/platform\/organizations\/(\d+)$/);
   if(ownerMatch&&req.method==='PATCH'){
     if(!isOwner(user))return err(res,403,'Acesso exclusivo da administração da plataforma.');
     const id=Number(ownerMatch[1]);if(!subByOrg.get(id))return err(res,404,'Empresa não encontrada.');
     const body=await bodyJSON(req),st=body.status,valid=text(body.valid_until,10);
     const oldSub=subByOrg.get(id);if(oldSub.mp_subscription_id)return err(res,409,'Há uma assinatura vinculada ao Mercado Pago. Não altere manualmente sem cancelar e conciliar primeiro no provedor.');
     if(!['trialing','courtesy','suspended'].includes(st)||!validDate(valid))return err(res,400,'Situação ou validade inválidas.');
     if(st!=='suspended'&&(valid<today()||valid>isoPlus(366)))return err(res,400,'Validade fora do intervalo permitido.');
     db.prepare("UPDATE subscriptions SET status=?,valid_until=?,source='manual',mp_subscription_id=NULL,payer_email=NULL,updated_at=datetime('now') WHERE organization_id=?").run(st,valid,id);
     saveEvent.run(id,'owner.updated',`${st} até ${valid} (admin plataforma)`);
     return json(res,200,{success:true});
   }
   return null;
 }
 return {summary,limited,ensure,publicRoute,userRoute,isOwner};
}
module.exports={createCommercial,today,isoPlus};
