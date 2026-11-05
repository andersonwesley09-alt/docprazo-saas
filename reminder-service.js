'use strict';

// Envio transacional multiempresa. A confirmação da API indica apenas aceite
// pelo provedor: não garante entrega ao destinatário.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const TIMEZONE = 'America/Fortaleza';

function recipients(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.length > 500) throw new Error('Informe no máximo 500 caracteres de destinatários.');
  const items = [...new Set(raw.split(/[,;\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean))];
  if (!items.length || items.length > 5 || items.some(e => !EMAIL_RE.test(e) || e.length > 190)) {
    throw new Error('Informe de 1 a 5 e-mails válidos, separados por vírgula.');
  }
  return items;
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[x]));
}
function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',hourCycle:'h23'
  }).formatToParts(now);
  const part = k => parts.find(p => p.type === k).value;
  return {day:`${part('year')}-${part('month')}-${part('day')}`,hour:Number(part('hour'))};
}
function daysLeft(iso, day) {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
}
function brDate(iso) { return String(iso).split('-').reverse().join('/'); }
function buildMessage(orgName, docs, day, baseUrl) {
  const expired=docs.filter(d=>d.days_left<0).length;
  const today=docs.filter(d=>d.days_left===0).length;
  const upcoming=docs.filter(d=>d.days_left>0).length;
  const rows=docs.slice(0,120).map(d=>{
    const badge=d.days_left<0?`Vencido há ${Math.abs(d.days_left)} dia(s)`:d.days_left===0?'Vence hoje':`Em ${d.days_left} dia(s)`;
    return `<tr><td style="padding:12px;border-bottom:1px solid #e2e8f0"><strong>${escapeHtml(d.title)}</strong><div style="color:#64748b;font-size:12px">${escapeHtml(d.category)}</div></td><td style="padding:12px;border-bottom:1px solid #e2e8f0;white-space:nowrap">${escapeHtml(brDate(d.expires_on))}</td><td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(badge)}</td></tr>`;
  }).join('');
  const link = /^https:\/\/[^\s]+$/i.test(baseUrl || '') ? `<p><a href="${escapeHtml(baseUrl)}" style="display:inline-block;background:#234b91;color:white;padding:11px 17px;text-decoration:none;border-radius:6px">Acessar DocPrazo</a></p>` : '';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;background:#f3f6fb;padding:24px;color:#16243b"><div style="max-width:680px;margin:auto;background:#fff;border-radius:12px;padding:28px"><div style="font-weight:800;color:#214b90;font-size:22px">DocPrazo</div><h1 style="font-size:21px">Aviso de vencimento de documentos</h1><p>Empresa: <strong>${escapeHtml(orgName)}</strong></p><p>Resumo de ${escapeHtml(brDate(day))}: <strong>${expired}</strong> vencido(s), <strong>${today}</strong> vencendo hoje e <strong>${upcoming}</strong> próximo(s) do prazo.</p><table style="border-collapse:collapse;width:100%;font-size:14px"><thead style="background:#eaf0fa;text-align:left"><tr><th style="padding:12px">Documento</th><th style="padding:12px">Vencimento</th><th style="padding:12px">Situação</th></tr></thead><tbody>${rows}</tbody></table>${docs.length>120?`<p>Foram listados 120 dos ${docs.length} documentos em alerta. Consulte todos no sistema.</p>`:''}${link}<p style="font-size:12px;color:#64748b">Mensagem automática. Não contém os anexos dos documentos. Para desativar, solicite ao administrador da sua empresa que altere as preferências de alerta no DocPrazo.</p></div></body></html>`;
  const text = `DocPrazo — ${orgName}\nResumo de ${brDate(day)}: ${expired} vencidos, ${today} vencendo hoje, ${upcoming} próximos.\n\n`+docs.slice(0,120).map(d=>`${d.title} | ${brDate(d.expires_on)} | ${d.days_left < 0 ? 'Vencido' : 'Restam '+d.days_left+' dia(s)'}`).join('\n')+(docs.length>120?`\n... e outros ${docs.length-120} documentos.`:'')+'\n\nAcesse o DocPrazo para acompanhar e renovar.\n';
  return {html,text,expired,today,upcoming};
}
function createReminderService({db,documentsByOrg,getSubscriptionAccess,fetcher= (...args)=>global.fetch(...args)}) {
  db.exec(`CREATE TABLE IF NOT EXISTS reminder_delivery_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('test','daily')),
    status TEXT NOT NULL CHECK(status IN ('accepted','failed')),
    recipient TEXT NOT NULL,
    document_count INTEGER NOT NULL DEFAULT 0,
    provider_id TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_reminder_log_org ON reminder_delivery_log(organization_id,id DESC);`);
  const inProgress = new Set();
  const getOrg = db.prepare('SELECT * FROM organizations WHERE id=?');
  const getDaily = db.prepare('SELECT 1 FROM reminder_sends WHERE organization_id=? AND sent_date=?');
  const recordDaily = db.prepare('INSERT INTO reminder_sends (organization_id,sent_date,recipient,document_count,provider_id) VALUES (?,?,?,?,?)');
  const writeLog = db.prepare('INSERT INTO reminder_delivery_log (organization_id,kind,status,recipient,document_count,provider_id,detail) VALUES (?,?,?,?,?,?,?)');
  const getLogs = db.prepare('SELECT kind,status,recipient,document_count,provider_id,detail,created_at FROM reminder_delivery_log WHERE organization_id=? ORDER BY id DESC LIMIT 12');
  const lastTest = db.prepare("SELECT created_at FROM reminder_delivery_log WHERE organization_id=? AND kind='test' AND status='accepted' ORDER BY id DESC LIMIT 1");
  const lastDailyFailed = db.prepare("SELECT created_at FROM reminder_delivery_log WHERE organization_id=? AND kind='daily' AND status='failed' ORDER BY id DESC LIMIT 1");
  function configured(){return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL);}
  function scheduled(){return process.env.REMINDERS_SCHEDULE_ENABLED === '1';}
  function preview(orgId, day=localDate().day) {
    const docs=documentsByOrg.all(orgId).map(d=>({...d,days_left:daysLeft(d.expires_on,day)})).filter(d=>d.days_left<=d.lead_days);
    return docs.sort((a,b)=>a.expires_on.localeCompare(b.expires_on));
  }
  async function providerSend({to,subject,html,text,idempotencyKey}) {
    if(!configured()) throw new Error('Servidor sem credenciais Resend ou remetente configurado.');
    let response;
    try {
      response=await fetcher('https://api.resend.com/emails',{
        method:'POST',signal:AbortSignal.timeout(15000),
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Idempotency-Key':idempotencyKey},
        body:JSON.stringify({from:process.env.REMINDER_FROM_EMAIL,to,subject,html,text})
      });
    } catch(e) {throw new Error('Falha de conexão com o serviço de e-mail. Tente novamente.');}
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.id) {
      const hint = response.status===403 ? 'Remetente ou destinatário não autorizado. Verifique o domínio no Resend.' : response.status===401 ? 'Chave Resend não autorizada.' : response.status===429 ? 'Limite de envio atingido no Resend.' : `Provedor não aceitou a mensagem (HTTP ${response.status}).`;
      throw new Error(hint);
    }
    return String(result.id);
  }
  function log(orgId, kind, status, to, count, providerId='',detail='') {
    writeLog.run(orgId,kind,status,to.join(', '),count,providerId,detail.slice(0,220));
  }
  async function sendDaily(orgId) {
    if(!configured()) throw new Error('Envio não configurado no servidor.');
    const org=getOrg.get(orgId);
    if(!org || !org.notify_enabled) throw new Error('Ative as notificações da empresa.');
    const to=recipients(org.notification_email);
    if(!to.length) throw new Error('Cadastre pelo menos um destinatário.');
    const day=localDate().day, key=`daily:${orgId}:${day}`;
    if(inProgress.has(key)) throw new Error('Envio já está em andamento.');
    if(getDaily.get(orgId,day)) throw new Error('Resumo de alertas já enviado hoje.');
    if(getSubscriptionAccess && getSubscriptionAccess(orgId)) throw new Error('Assinatura sem acesso ativo para receber avisos.');
    const docs=preview(orgId,day);
    if(!docs.length) throw new Error('Não existem documentos em alerta para enviar.');
    inProgress.add(key);
    try {
      const msg=buildMessage(org.name,docs,day,process.env.APP_PUBLIC_URL);
      const providerId=await providerSend({to,subject:`DocPrazo | ${docs.length} documento(s) exigem atenção`,...msg,idempotencyKey:`docprazo-daily-${orgId}-${day}`});
      recordDaily.run(orgId,day,to.join(', '),docs.length,providerId);
      log(orgId,'daily','accepted',to,docs.length,providerId);
      return {accepted:true,count:docs.length,recipient:to.join(', '),day,provider_id:providerId};
    } catch(e) {
      log(orgId,'daily','failed',to,docs.length,'',e.message);
      throw e;
    } finally {inProgress.delete(key);}
  }
  async function sendTest(orgId, adminEmail) {
    if(!configured()) throw new Error('Envio não configurado no servidor.');
    const org=getOrg.get(orgId);
    if(!org) throw new Error('Empresa não encontrada.');
    const to=recipients(org.notification_email);
    const destination=to.length?to:[adminEmail];
    if(!destination.length||!EMAIL_RE.test(destination[0]))throw new Error('Configure um destinatário válido para testar.');
    const key=`test:${orgId}`;
    if(inProgress.has(key))throw new Error('Teste já em andamento.');
    const last=lastTest.get(orgId);
    if(last && (Date.now()-Date.parse(last.created_at.replace(' ','T')+'Z'))<60000)throw new Error('Aguarde um minuto antes de repetir o teste.');
    inProgress.add(key);
    try {
      const body=`<div style="font-family:Arial,sans-serif"><h2 style="color:#234b91">DocPrazo — teste de e-mail</h2><p>Este é um teste de configuração da empresa <strong>${escapeHtml(org.name)}</strong>.</p><p>Se esta mensagem chegou, o provedor aceitou o envio e o endereço recebeu o teste.</p><p>Os alertas diários são configurados separadamente no painel.</p></div>`;
      const providerId=await providerSend({to:destination,subject:'DocPrazo | Teste de envio de e-mail',html:body,text:`DocPrazo — teste de envio para ${org.name}. Este e-mail é um teste da configuração.`,idempotencyKey:`docprazo-test-${orgId}-${Date.now()}`});
      log(orgId,'test','accepted',destination,0,providerId);
      return {accepted:true,recipient:destination.join(', '),provider_id:providerId};
    } catch(e) {log(orgId,'test','failed',destination,0,'',e.message);throw e;}
    finally {inProgress.delete(key);}
  }
  async function scheduledRun() {
    const hour=Number(process.env.EMAIL_REMINDER_HOUR || '9');
    if(!configured()||!scheduled()||localDate().hour<(Number.isInteger(hour)&&hour>=0&&hour<=23?hour:9))return;
    const orgs=db.prepare("SELECT id FROM organizations WHERE notify_enabled=1 AND notification_email<>''").all();
    for(const org of orgs){
      const failed=lastDailyFailed.get(org.id);
      if(failed && Date.now()-Date.parse(failed.created_at.replace(' ','T')+'Z')<60*60*1000)continue;
      try {await sendDaily(org.id);} catch(e) {if(!/já enviado|Não existem|Assinatura sem acesso/.test(e.message))console.warn('[DocPrazo alertas]',org.id,e.message);}
    }
  }
  return {configured,scheduled,preview,sendDaily,sendTest,scheduledRun,recent:orgId=>getLogs.all(orgId)};
}
module.exports={createReminderService,recipients,localDate,buildMessage};
