'use strict';
// Execute SOMENTE no ambiente administrativo privado:
// node scripts/promover-proprietario.js email@seu-dominio.com.br
const {db}=require('../server');
const email=String(process.argv[2]||'').trim().toLowerCase();
if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 console.error('Uso: node scripts/promover-proprietario.js email@empresa.com');process.exitCode=1;
}else{
 const user=db.prepare('SELECT id,name FROM users WHERE email=? AND active=1').get(email);
 if(!user){console.error('Conta não encontrada ou inativa. Cadastre a empresa antes.');process.exitCode=1;}
 else{
   db.prepare('UPDATE users SET platform_owner=1 WHERE id=?').run(user.id);
   console.log('Proprietário da plataforma habilitado para:',user.name);
   console.log('Saia e entre novamente na conta para visualizar Painel SaaS.');
 }
}
db.close();
