'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {makeXlsx,daysUntil,situation}=require('./xlsx-export');
const {createCommercial}=require('./commercial');
const {createReminderService,recipients,localDate}=require('./reminder-service');
// Carrega .env local sem sobrescrever variáveis já fornecidas pela hospedagem.
const envFile=path.join(__dirname,'.env');
if(fs.existsSync(envFile))process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT || 3005);
if(process.env.NODE_ENV==='production'){
  const origin=process.env.APP_PUBLIC_URL||'';
  if(!/^https:\/\/[^/]+$/.test(origin))throw new Error('Em produção, configure APP_PUBLIC_URL com um domínio HTTPS válido, sem barra final.');
  if(!process.env.DATA_DIR)throw new Error('Em produção, DATA_DIR deve apontar para volume persistente com backup externo.');
}
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'docprazo.sqlite');
const SESSION_DAYS = 7;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, {recursive:true});
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT '',
  issue_date TEXT,
  expires_on TEXT NOT NULL,
  lead_days INTEGER NOT NULL DEFAULT 30,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_org_expiry ON documents(organization_id, expires_on);
CREATE TABLE IF NOT EXISTS renewals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  previous_date TEXT NOT NULL,
  new_date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Migrações compatíveis com a base V1: não apagam registros existentes.
const columns = db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
if (!columns.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
}
if (!columns.includes('active')) {
  db.exec("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
}
const orgColumns=db.prepare('PRAGMA table_info(organizations)').all().map(c=>c.name);
if(!orgColumns.includes('notification_email')) db.exec("ALTER TABLE organizations ADD COLUMN notification_email TEXT NOT NULL DEFAULT ''");
if(!orgColumns.includes('notify_enabled')) db.exec("ALTER TABLE organizations ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 0");
db.exec(`
CREATE TABLE IF NOT EXISTS attachments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 original_name TEXT NOT NULL,
 stored_name TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL,
 size INTEGER NOT NULL,
 uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attach_org_document ON attachments(organization_id, document_id);
CREATE TABLE IF NOT EXISTS reminder_sends (
 organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 sent_date TEXT NOT NULL,
 recipient TEXT NOT NULL,
 document_count INTEGER NOT NULL,
 provider_id TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(organization_id,sent_date)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 actor_name TEXT NOT NULL,
 event TEXT NOT NULL,
 subject TEXT NOT NULL DEFAULT '',
 detail TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(organization_id,id DESC);
`);
// O novo vínculo é opcional para preservar os anexos já cadastrados na V2.
const attachColumns=db.prepare('PRAGMA table_info(attachments)').all().map(c=>c.name);
if(!attachColumns.includes('renewal_id'))db.exec('ALTER TABLE attachments ADD COLUMN renewal_id INTEGER REFERENCES renewals(id)');
const auditInsert=db.prepare('INSERT INTO audit_log (organization_id,user_id,actor_name,event,subject,detail) VALUES (?,?,?,?,?,?)');
function audit(user,event,subject='',detail='') {
 auditInsert.run(user.organization_id,user.id,user.name,event,text(subject,180),text(detail,450));
}
function canEdit(user) {return user.role==='admin'||user.role==='editor';}
function requireRole(res,user,role='editor') {
 if (role==='admin' && user.role!=='admin') {err(res,403,'Somente administradores podem realizar essa ação.');return false;}
 if (role==='editor'&&!canEdit(user)) {err(res,403,'Seu perfil possui acesso apenas para consulta.');return false;}
 return true;
}
function safeUser(u) {return {id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,created_at:u.created_at};}
function validPassword(p) {return typeof p==='string'&&p.length>=8&&p.length<=128;}
function validRole(r) {return ['admin','editor','viewer'].includes(r);}
function validateFileName(name) {return text(name,160).replace(/[\\/\x00-\x1f]/g,'_')||'documento';}
function validateUpload(data) {
 if(!data||typeof data!=='object'||typeof data.content!=='string') throw new Error('Envie um arquivo válido.');
 const name=validateFileName(data.name);
 if(!/\.(pdf|png|jpe?g)$/i.test(name)) throw new Error('Apenas PDF, PNG ou JPG são aceitos.');
 if(data.content.length>7_000_000||!/^([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.content)) throw new Error('Arquivo inválido ou maior que 5 MB.');
 const bytes=Buffer.from(data.content,'base64');
 if(!bytes.length||bytes.length>5*1024*1024) throw new Error('Arquivo inválido ou maior que 5 MB.');
 const isPDF=bytes.subarray(0,5).toString('ascii')==='%PDF-';
 const isPNG=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const isJPEG=bytes.subarray(0,3).equals(Buffer.from([255,216,255]));
 const ext=name.split('.').pop().toLowerCase();
 if (!((ext==='pdf'&&isPDF)||(ext==='png'&&isPNG)||(['jpg','jpeg'].includes(ext)&&isJPEG))) throw new Error('O conteúdo não corresponde ao formato PDF, PNG ou JPG.');
 const mime=isPDF?'application/pdf':isPNG?'image/png':'image/jpeg';
 return {name,bytes,mime};
}
const documentsByOrg = db.prepare('SELECT documents.*, (SELECT COUNT(*) FROM attachments a WHERE a.document_id=documents.id AND a.organization_id=documents.organization_id) AS attachment_count FROM documents WHERE organization_id=? ORDER BY expires_on ASC, id DESC');
const documentByOrg = db.prepare('SELECT documents.*, (SELECT COUNT(*) FROM attachments a WHERE a.document_id=documents.id AND a.organization_id=documents.organization_id) AS attachment_count FROM documents WHERE id=? AND organization_id=?');
const insertDocument = db.prepare('INSERT INTO documents (organization_id,title,category,reference,responsible,issue_date,expires_on,lead_days,notes) VALUES (?,?,?,?,?,?,?,?,?)');
const updateDocument = db.prepare("UPDATE documents SET title=?,category=?,reference=?,responsible=?,issue_date=?,expires_on=?,lead_days=?,notes=?,updated_at=datetime('now') WHERE id=? AND organization_id=?");
const reminderService=createReminderService({db,documentsByOrg,getSubscriptionAccess:orgId=>commercial.ensure(orgId)});
function mailAvailable(){return reminderService.configured();}
const commercial=createCommercial({db,json,err,bodyJSON,text,validPassword,passwordHash,audit,mailAvailable});
const sessionsCleanup = db.prepare('DELETE FROM sessions WHERE expires_at < ?');
const accessAttempts = new Map();
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}
function err(res, status, message) { return json(res, status, { error: message }); }
function text(value, max = 120) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function dateValid(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y,m,d] = date.split('-').map(Number);
  if (y < 1900 || y > 2200) return false;
  const parsed = new Date(Date.UTC(y, m-1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m-1 && parsed.getUTCDate() === d;
}
function validateDocument(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dados do documento inválidos.');
  const doc = {
    title: text(data.title, 140), category: text(data.category, 70),
    reference: text(data.reference, 90), responsible: text(data.responsible, 100),
    issue_date: data.issue_date ? data.issue_date : null,
    expires_on: data.expires_on, lead_days: Number(data.lead_days), notes: text(data.notes, 1200)
  };
  if (!doc.title) throw new Error('Informe o nome do documento.');
  if (!doc.category) throw new Error('Informe a categoria.');
  if (!dateValid(doc.expires_on)) throw new Error('Informe uma data de vencimento válida.');
  if (doc.issue_date && !dateValid(doc.issue_date)) throw new Error('Data de emissão inválida.');
  if (![7, 15, 30, 60, 90].includes(doc.lead_days)) throw new Error('Prazo de alerta inválido.');
  return doc;
}
function passwordHash(password) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
}
function passwordVerify(password, hash) {
  if (!hash || !hash.includes(':')) return false;
  const [salt, key] = hash.split(':');
  const given = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64);
  return key.length === 128 && crypto.timingSafeEqual(given, Buffer.from(key, 'hex'));
}
function cookies(req) {
  const values = {};
  for (const entry of String(req.headers.cookie || '').split(';')) {
    const ix = entry.indexOf('=');
    if (ix !== -1) values[entry.slice(0, ix).trim()] = entry.slice(ix+1).trim();
  }
  return values;
}
function newSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const expires = Date.now() + SESSION_DAYS*86400000;
  db.prepare('INSERT INTO sessions (token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)')
    .run(crypto.createHash('sha256').update(token).digest('hex'), userId, csrf, expires);
  const secure = process.env.NODE_ENV==='production'||process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `docprazo_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}
function clearSession(res) {
  const secure = process.env.NODE_ENV==='production'||process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `docprazo_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}
function currentUser(req) {
  const token = cookies(req).docprazo_session;
  if (!token || token.length > 100) return null;
  return db.prepare(`SELECT users.id, users.name, users.email, users.role, users.organization_id, organizations.name AS organization_name,
                      sessions.csrf_token, sessions.token_hash
                     FROM sessions JOIN users ON users.id=sessions.user_id
                     JOIN organizations ON organizations.id=users.organization_id
                     WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.active=1`)
    .get(crypto.createHash('sha256').update(token).digest('hex'), Date.now());
}
async function bodyJSON(req,limit=65536) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('Envie os dados em JSON.');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) throw new Error('Dados muito grandes.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('JSON inválido.'); }
}
function authRateLimit(req, res) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = accessAttempts.get(ip);
  if (!current || now-current.start>15*60000) { accessAttempts.set(ip, {start:now,count:1}); return true; }
  current.count++;
  if (current.count > 20) { err(res, 429, 'Muitas tentativas. Tente novamente em 15 minutos.'); return false; }
  return true;
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return String(req.headers['sec-fetch-site'] || '') !== 'cross-site';
  try { return new URL(origin).host === req.headers.host; }
  catch { return false; }
}
function rowId(part) { return /^\d+$/.test(part || '') && Number(part)>0 ? Number(part) : null; }
function stripSecret(user) { return {id:user.id, name:user.name, email:user.email, organization_id:user.organization_id, organization_name:user.organization_name,role:user.role}; }

async function api(req, res, pathname) {
  // Webhooks autenticados por HMAC não usam CSRF de navegador.
  if(pathname==='/api/webhooks/mercadopago')return await commercial.publicRoute(req,res,pathname);
  if (!sameOrigin(req) && !['GET','HEAD'].includes(req.method)) return err(res, 403, 'Origem não permitida.');
  if (['/api/public-config','/api/password/forgot','/api/password/reset'].includes(pathname))return await commercial.publicRoute(req,res,pathname);
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { status:'ok' });
  if (req.method === 'POST' && (pathname === '/api/signup' || pathname === '/api/login')) {
    if (!authRateLimit(req,res)) return;
    const data = await bodyJSON(req);
    const email = text(data.email, 190).toLowerCase();
    const password = data.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 400, 'Informe um e-mail válido.');
    if (!validPassword(password)) return err(res, 400, 'A senha precisa ter entre 8 e 128 caracteres.');
    if (pathname === '/api/signup') {
      if(process.env.NODE_ENV==='production'&&process.env.ALLOW_PUBLIC_SIGNUP!=='1')return err(res,403,'Cadastros temporariamente fechados. Entre em contato com o suporte.');
      const name = text(data.name, 90);
      const orgName = text(data.organization_name, 120);
      if (!name || !orgName) return err(res, 400, 'Preencha seu nome e o nome da empresa.');
      if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return err(res, 409, 'Já existe um usuário com esse e-mail.');
      let userId;
      try {
        db.exec('BEGIN IMMEDIATE');
        const org = db.prepare('INSERT INTO organizations (name) VALUES (?)').run(orgName);
        const user = db.prepare('INSERT INTO users (organization_id,name,email,password_hash) VALUES (?,?,?,?)').run(org.lastInsertRowid, name, email, passwordHash(password));
        userId = Number(user.lastInsertRowid);
        db.prepare("INSERT INTO subscriptions(organization_id,valid_until,source) VALUES (?,?,'signup-trial')").run(Number(org.lastInsertRowid),require('./commercial').isoPlus(14));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        if (String(e).includes('UNIQUE')) return err(res, 409, 'Esse e-mail já está cadastrado.');
        throw e;
      }
      newSession(res, userId);
      return json(res, 201, { user: {id:userId,name,email,organization_name:orgName} });
    }
    const row = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);
    if (!row || !passwordVerify(password,row.password_hash)) return err(res,401,'E-mail ou senha incorretos.');
    newSession(res,row.id);
    return json(res,200,{user:{id:row.id,name:row.name,email,organization_id:row.organization_id}});
  }
  const user = currentUser(req);
  if (!user) return err(res,401,'Sua sessão expirou. Entre novamente.');
  if (req.method !== 'GET' && req.headers['x-csrf-token'] !== user.csrf_token) return err(res,403,'Sessão inválida. Atualize a página.');
  if (req.method === 'GET' && pathname === '/api/me') return json(res,200,{user:{...stripSecret(user),platform_owner:commercial.isOwner(user)},csrf:user.csrf_token});
  if (req.method === 'POST' && pathname === '/api/logout') {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(user.token_hash);
    clearSession(res);
    return json(res,200,{success:true});
  }
  if(pathname.startsWith('/api/billing')||pathname.startsWith('/api/platform/'))return await commercial.userRoute(req,res,pathname,user);
  // Assinatura expirada: consulta e exportação continuam, alterações são suspensas.
  // Alteração de senha e encerramento de sessão não dependem de assinatura.
  if(!['GET','HEAD'].includes(req.method)&&pathname!=='/api/me/password'){
    const blocked=commercial.ensure(user.organization_id);
    if(blocked)return err(res,402,blocked);
  }
  // Gestão de empresa, credenciais e equipe.
  if(pathname==='/api/notifications'&&req.method==='GET'){
    if(!requireRole(res,user,'admin')) return;
    const org=db.prepare('SELECT notification_email,notify_enabled FROM organizations WHERE id=?').get(user.organization_id);
    const last=db.prepare('SELECT sent_date,recipient,document_count,provider_id FROM reminder_sends WHERE organization_id=? ORDER BY sent_date DESC LIMIT 1').get(user.organization_id)||null;
    return json(res,200,{email:org.notification_email,enabled:Boolean(org.notify_enabled),provider_ready:reminderService.configured(),schedule_enabled:reminderService.scheduled(),last,history:reminderService.recent(user.organization_id)});
  }
  if(pathname==='/api/notifications/preview'&&req.method==='GET'){
    if(!requireRole(res,user,'admin'))return;
    const docs=reminderService.preview(user.organization_id);
    return json(res,200,{count:docs.length,expired:docs.filter(d=>d.days_left<0).length,today:docs.filter(d=>d.days_left===0).length,upcoming:docs.filter(d=>d.days_left>0).length,documents:docs.slice(0,150).map(d=>({id:d.id,title:d.title,expires_on:d.expires_on,days_left:d.days_left}))});
  }
  if(pathname==='/api/notifications'&&req.method==='PATCH'){
    if(!requireRole(res,user,'admin')) return;
    const data=await bodyJSON(req),enabled=data.enabled===true;
    let to;
    try{to=recipients(data.email);}catch(e){return err(res,400,e.message);}
    if(enabled&&!to.length)return err(res,400,'Informe pelo menos um e-mail para ativar os alertas.');
    db.prepare('UPDATE organizations SET notification_email=?,notify_enabled=? WHERE id=?').run(to.join(', '),Number(enabled),user.organization_id);
    audit(user,'notifications.updated','Alertas por e-mail',enabled?'Ativado':'Desativado');
    return json(res,200,{success:true});
  }
  if(pathname==='/api/notifications/test'&&req.method==='POST'){
    if(!requireRole(res,user,'admin'))return;
    try{
      const result=await reminderService.sendTest(user.organization_id,user.email);
      audit(user,'notifications.test','Teste de e-mail',`Aceito pelo provedor: ${result.recipient}`);
      return json(res,200,result);
    }catch(e){return err(res,/andamento|Aguarde um minuto/.test(e.message)?429:400,e.message);}
  }
  if(pathname==='/api/notifications/send'&&req.method==='POST'){
    if(!requireRole(res,user,'admin'))return;
    try{
      const result=await reminderService.sendDaily(user.organization_id);
      audit(user,'notifications.sent','Resumo de alertas',`${result.count} documento(s) aceito(s) pelo provedor`);
      return json(res,200,result);
    }catch(e){return err(res,/já enviado|andamento/.test(e.message)?409:400,e.message);}
  }
  if (pathname === '/api/me/password' && req.method === 'POST') {
    const body=await bodyJSON(req);
    if(!validPassword(body.new_password)) return err(res,400,'A nova senha precisa ter de 8 a 128 caracteres.');
    const old=db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
    if(!validPassword(body.current_password)||!passwordVerify(body.current_password,old.password_hash)) return err(res,403,'Senha atual incorreta.');
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash(body.new_password),user.id);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(user.id,user.token_hash);
    audit(user,'password.changed','Conta','Senha alterada pelo usuário');
    return json(res,200,{success:true});
  }
  if (pathname === '/api/organization' && req.method === 'PATCH') {
    if(!requireRole(res,user,'admin')) return;
    const body=await bodyJSON(req);const name=text(body.name,120);
    if(!name) return err(res,400,'Informe o nome da empresa.');
    db.prepare('UPDATE organizations SET name=? WHERE id=?').run(name,user.organization_id);
    audit(user,'organization.updated',name);
    return json(res,200,{name});
  }
  if (pathname === '/api/users' && req.method === 'GET') {
    if(!requireRole(res,user,'admin')) return;
    return json(res,200,{users:db.prepare('SELECT id,name,email,role,active,created_at FROM users WHERE organization_id=? ORDER BY id').all(user.organization_id)});
  }
  if (pathname === '/api/users' && req.method === 'POST') {
    if(!requireRole(res,user,'admin')) return;
    const body=await bodyJSON(req);
    const name=text(body.name,90),email=text(body.email,190).toLowerCase(),role=body.role,password=body.password;
    if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!validRole(role)||!validPassword(password))
      return err(res,400,'Informe nome, e-mail válido, perfil e senha de 8 a 128 caracteres.');
    const allowance=commercial.limited(user.organization_id,'users');if(!allowance.ok)return err(res,402,allowance.message);
    try {
      const result=db.prepare('INSERT INTO users (organization_id,name,email,password_hash,role) VALUES (?,?,?,?,?)').run(user.organization_id,name,email,passwordHash(password),role);
      audit(user,'user.created',name,`Perfil: ${role}`);
      return json(res,201,{user:safeUser(db.prepare('SELECT * FROM users WHERE id=?').get(Number(result.lastInsertRowid)))});
    } catch(e) {if(String(e).includes('UNIQUE')) return err(res,409,'Este e-mail já está cadastrado.');throw e;}
  }
  const userMatch=pathname.match(/^\/api\/users\/(\d+)$/);
  if(userMatch&&['PATCH','DELETE'].includes(req.method)) {
    if(!requireRole(res,user,'admin')) return;
    const target=db.prepare('SELECT * FROM users WHERE id=? AND organization_id=?').get(Number(userMatch[1]),user.organization_id);
    if(!target) return err(res,404,'Usuário não encontrado.');
    if(target.id===user.id) return err(res,400,'Não é permitido alterar seu próprio perfil por esta tela.');
    if(req.method==='DELETE') {
      if(target.role==='admin'&&db.prepare("SELECT COUNT(*) AS n FROM users WHERE organization_id=? AND role='admin'").get(user.organization_id).n<=1) return err(res,400,'É necessário manter um administrador.');
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
      db.prepare('UPDATE users SET active=0 WHERE id=? AND organization_id=?').run(target.id,user.organization_id);
      audit(user,'user.deactivated',target.name);
      return json(res,200,{success:true});
    }
    const body=await bodyJSON(req);
    if(!validRole(body.role)) return err(res,400,'Perfil inválido.');
    if (body.active!==undefined && ![0,1,true,false].includes(body.active)) return err(res,400,'Estado inválido.');
    if(body.password!==undefined&&!validPassword(body.password)) return err(res,400,'A senha deve ter entre 8 e 128 caracteres.');
    if(target.role==='admin'&&body.role!=='admin'&&db.prepare("SELECT COUNT(*) AS n FROM users WHERE organization_id=? AND role='admin'").get(user.organization_id).n<=1) return err(res,400,'É necessário manter um administrador.');
    if(body.active===true||body.active===1){if(!target.active){const allowance=commercial.limited(user.organization_id,'users');if(!allowance.ok)return err(res,402,allowance.message);}}
    db.prepare('UPDATE users SET role=?,active=?,password_hash=COALESCE(?,password_hash) WHERE id=? AND organization_id=?')
      .run(body.role,body.active===undefined?target.active:Number(body.active),body.password!==undefined?passwordHash(body.password):null,target.id,user.organization_id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
    audit(user,'user.updated',target.name,`Perfil: ${body.role}${body.password?' / senha redefinida':''}`);
    return json(res,200,{success:true});
  }
  if(pathname==='/api/audit'&&req.method==='GET') {
    if(!requireRole(res,user,'admin')) return;
    const rows=db.prepare('SELECT id,actor_name,event,subject,detail,created_at FROM audit_log WHERE organization_id=? ORDER BY id DESC LIMIT 500').all(user.organization_id);
    return json(res,200,{events:rows});
  }
  if(pathname==='/api/exports/documents.xlsx'&&req.method==='GET') {
    const params=new URL(req.url,'http://localhost').searchParams;
    const scope=params.get('scope')==='filtered'?'filtered':'all';
    const search=text(params.get('query')||'',200).toLocaleLowerCase('pt-BR');
    const category=text(params.get('category')||'',100);
    const state=text(params.get('status')||'',20);
    const today=localDate().day;
    const all=documentsByOrg.all(user.organization_id);
    const docs=(scope==='all'?all:all.filter(d=>{
      const searchText=`${d.title} ${d.category} ${d.reference} ${d.responsible}`.toLocaleLowerCase('pt-BR');
      if(search&&!searchText.includes(search))return false;
      if(category&&category!=='all'&&category!==d.category)return false;
      const n=daysUntil(d.expires_on,today),sit=situation(d,today);
      if(state==='expired'&&n>=0)return false;
      if(state==='today'&&n!==0)return false;
      if(state==='warning'&&!(n>=0&&n<=Number(d.lead_days)))return false;
      if(state==='good'&&sit!=='Em dia')return false;
      return true;
    })).sort((a,b)=>a.expires_on.localeCompare(b.expires_on));
    if(!docs.length)return err(res,400,'Não existem documentos para exportar com os filtros selecionados.');
    if(docs.length>20000)return err(res,400,'Limite de 20.000 documentos por exportação. Aplique filtros.');
    const org=db.prepare('SELECT name FROM organizations WHERE id=?').get(user.organization_id);
    const buffer=makeXlsx(docs,{company:org.name,today,scope:scope==='all'?'Todos os documentos':'Somente documentos filtrados'});
    const filename=`docprazo-${scope==='all'?'todos':'filtrados'}-${today}.xlsx`;
    res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':buffer.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    return res.end(buffer);
  }
  if(pathname==='/api/reports'&&req.method==='GET') {
    const docs=documentsByOrg.all(user.organization_id);
    const categories={};for(const doc of docs){categories[doc.category]=(categories[doc.category]||0)+1;}
    const today=localDate().day;
    const expired=docs.filter(d=>d.expires_on<today).length;
    return json(res,200,{total:docs.length,expired,categories,renewals:db.prepare('SELECT COUNT(*) AS n FROM renewals WHERE organization_id=?').get(user.organization_id).n,attachments:db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE organization_id=?').get(user.organization_id).n});
  }
  if (pathname === '/api/documents' && req.method === 'GET') return json(res,200,{documents:documentsByOrg.all(user.organization_id)});
  if (pathname === '/api/documents' && req.method === 'POST') {
    if(!requireRole(res,user)) return;
    const allowance=commercial.limited(user.organization_id,'documents');if(!allowance.ok)return err(res,402,allowance.message);
    const doc = validateDocument(await bodyJSON(req));
    const result = insertDocument.run(user.organization_id,doc.title,doc.category,doc.reference,doc.responsible,doc.issue_date,doc.expires_on,doc.lead_days,doc.notes);
    audit(user,'document.created',doc.title,doc.expires_on);
    return json(res,201,{document:documentByOrg.get(Number(result.lastInsertRowid), user.organization_id)});
  }
  const attachmentList=pathname.match(/^\/api\/documents\/(\d+)\/attachments$/);
  if(attachmentList) {
    const docId=rowId(attachmentList[1]);const doc=docId&&documentByOrg.get(docId,user.organization_id);
    if(!doc) return err(res,404,'Documento não encontrado.');
    if(req.method==='GET') return json(res,200,{attachments:db.prepare('SELECT a.id,a.original_name,a.mime,a.size,a.created_at,r.new_date AS renewal_valid_until FROM attachments a LEFT JOIN renewals r ON a.renewal_id=r.id AND r.organization_id=a.organization_id WHERE a.document_id=? AND a.organization_id=? ORDER BY a.id DESC').all(docId,user.organization_id)});
    if(req.method==='POST') {
      if(!requireRole(res,user)) return;
      const number=db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE document_id=? AND organization_id=?').get(docId,user.organization_id).n;
      if(number>=10) return err(res,400,'Limite de 10 anexos por documento.');
      const uploaded=validateUpload(await bodyJSON(req,7_400_000));
      const stored=crypto.randomUUID();const filePath=path.join(UPLOAD_DIR,stored);
      fs.writeFileSync(filePath,uploaded.bytes,{flag:'wx',mode:0o600});
      try {
        const result=db.prepare('INSERT INTO attachments (organization_id,document_id,original_name,stored_name,mime,size,uploaded_by) VALUES (?,?,?,?,?,?,?)').run(user.organization_id,docId,uploaded.name,stored,uploaded.mime,uploaded.bytes.length,user.id);
        audit(user,'attachment.added',doc.title,uploaded.name);
        return json(res,201,{id:Number(result.lastInsertRowid)});
      } catch(e) {fs.unlinkSync(filePath);throw e;}
    }
  }
  const attachMatch=pathname.match(/^\/api\/attachments\/(\d+)\/(download|delete)$/);
  if(attachMatch) {
    const f=db.prepare('SELECT attachments.*,documents.title AS document_title FROM attachments JOIN documents ON documents.id=attachments.document_id AND documents.organization_id=attachments.organization_id WHERE attachments.id=? AND attachments.organization_id=?').get(Number(attachMatch[1]),user.organization_id);
    if(!f) return err(res,404,'Anexo não encontrado.');
    if(attachMatch[2]==='download'&&req.method==='GET') {
      const filepath=path.join(UPLOAD_DIR,f.stored_name);
      if(!fs.existsSync(filepath)) return err(res,404,'Arquivo não encontrado no armazenamento.');
      res.writeHead(200,{'Content-Type':f.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.original_name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Length':f.size});
      return fs.createReadStream(filepath).pipe(res);
    }
    if(attachMatch[2]==='delete'&&req.method==='DELETE') {
      if(!requireRole(res,user)) return;
      db.prepare('DELETE FROM attachments WHERE id=? AND organization_id=?').run(f.id,user.organization_id);
      try{fs.unlinkSync(path.join(UPLOAD_DIR,f.stored_name));}catch(e){if(e.code!=='ENOENT')console.error(e);}
      audit(user,'attachment.deleted',f.document_title,f.original_name);
      return json(res,200,{success:true});
    }
  }
  const match = pathname.match(/^\/api\/documents\/(\d+)(?:\/(renew|history))?$/);
  if (match) {
    const id = rowId(match[1]);
    const doc = id && documentByOrg.get(id,user.organization_id);
    if (!doc) return err(res,404,'Documento não encontrado.');
    const action = match[2];
    // Anexos são servidos pela API após verificar sessão e pertencimento à empresa.
    if (!action && req.method === 'GET') return json(res,200,{document:doc});

    if (req.method === 'GET' && action === 'history') {
      return json(res,200,{renewals:db.prepare(`SELECT previous_date,new_date,note,created_at FROM renewals
                                WHERE document_id=? AND organization_id=? ORDER BY id DESC`).all(id,user.organization_id)});
    }
    if (req.method === 'POST' && action === 'renew') {
      if(!requireRole(res,user)) return;
      const data = await bodyJSON(req,7_400_000);
      const nextDate = data.expires_on;
      if (!dateValid(nextDate) || nextDate <= doc.expires_on) return err(res,400,'A nova validade deve ser posterior à atual.');
      const note = text(data.note,300);
      const uploaded=data.attachment?validateUpload(data.attachment):null;
      if(uploaded){
        const count=db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE document_id=? AND organization_id=?').get(id,user.organization_id).n;
        if(count>=10)return err(res,400,'Limite de 10 anexos: exclua um arquivo antes de anexar o novo comprovante.');
      }
      const stored=uploaded?crypto.randomUUID():null;
      const filePath=uploaded?path.join(UPLOAD_DIR,stored):null;
      // Validação do comprovante antes de alterar a validade, preservando consistência.
      if(uploaded)fs.writeFileSync(filePath,uploaded.bytes,{flag:'wx',mode:0o600});
      db.exec('BEGIN IMMEDIATE');
      try {
        const renewal=db.prepare('INSERT INTO renewals (document_id,organization_id,previous_date,new_date,note,updated_by) VALUES (?,?,?,?,?,?)')
          .run(id,user.organization_id,doc.expires_on,nextDate,note,user.id);
        db.prepare("UPDATE documents SET expires_on=?,updated_at=datetime('now') WHERE id=? AND organization_id=?")
          .run(nextDate,id,user.organization_id);
        if(uploaded){
          db.prepare('INSERT INTO attachments (organization_id,document_id,original_name,stored_name,mime,size,uploaded_by,renewal_id) VALUES (?,?,?,?,?,?,?,?)')
            .run(user.organization_id,id,uploaded.name,stored,uploaded.mime,uploaded.bytes.length,user.id,Number(renewal.lastInsertRowid));
          audit(user,'attachment.added',doc.title,`Renovação ${nextDate}: ${uploaded.name}`);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        if(filePath)try{fs.unlinkSync(filePath);}catch{}
        throw e;
      }
      audit(user,'document.renewed',doc.title,`${doc.expires_on} → ${nextDate}${uploaded?' (com comprovante)':''}`);
      return json(res,200,{document:documentByOrg.get(id,user.organization_id)});
    }
    if (!action && req.method === 'PATCH') {
      if(!requireRole(res,user)) return;
      const data = validateDocument(await bodyJSON(req));
      updateDocument.run(data.title,data.category,data.reference,data.responsible,data.issue_date,data.expires_on,data.lead_days,data.notes,id,user.organization_id);
      audit(user,'document.updated',data.title,`Validade: ${data.expires_on}`);
      return json(res,200,{document:documentByOrg.get(id,user.organization_id)});
    }
    if (!action && req.method === 'DELETE') {
      if(!requireRole(res,user)) return;
      const priorFiles=db.prepare('SELECT stored_name FROM attachments WHERE document_id=? AND organization_id=?').all(id,user.organization_id);
      db.prepare('DELETE FROM documents WHERE id=? AND organization_id=?').run(id,user.organization_id);
      for(const f of priorFiles){try{fs.unlinkSync(path.join(UPLOAD_DIR,f.stored_name));}catch(e){if(e.code!=='ENOENT')console.error(e);}}
      audit(user,'document.deleted',doc.title);
      return json(res,200,{success:true});
    }
  }
  return err(res,404,'Rota não encontrada.');
}

const server = http.createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) return await api(req,res,pathname);
    if (req.method !== 'GET') return err(res,405,'Método não permitido.');
    if (!STATIC.has(pathname)) return err(res,404,'Página não encontrada.');
    const [filename, contentType] = STATIC.get(pathname);
    const file = fs.readFileSync(path.join(__dirname,'public',filename));
    res.writeHead(200,{'Content-Type': contentType, 'Cache-Control':'no-store','Content-Length':file.length});
    return res.end(file);
  } catch (e) {
    if (e && /Dados|data|JSON|Prazo|documento|categoria|Informe|alerta|grandes|Arquivo|arquivo|Apenas|Limite|validade|conteúdo|formato|período de teste|assinatura/.test(e.message)) return err(res,400,e.message);
    console.error('[DocPrazo]',e);
    if (!res.headersSent) return err(res,500,'Erro interno do servidor.');
    res.end();
  }
});

if (require.main === module) {
  sessionsCleanup.run(Date.now());
  server.listen(PORT,()=> console.log(`DocPrazo disponível em http://localhost:${PORT}`));
  if(process.env.REMINDERS_SCHEDULE_ENABLED==='1'){
    const tick=setInterval(()=>reminderService.scheduledRun().catch(e=>console.error('[DocPrazo avisos]',e)),5*60*1000);
    tick.unref();reminderService.scheduledRun().catch(e=>console.error('[DocPrazo avisos]',e));
  }
}
module.exports = {server,db};
