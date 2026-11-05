'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const data=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(root,'data');
const database=path.join(data,'docprazo.sqlite');
if(!fs.existsSync(database)){console.error('Banco ainda não existe. Execute npm start e cadastre uma empresa.');process.exit(1);}
const backupRoot=process.env.BACKUP_DIR?path.resolve(process.env.BACKUP_DIR):path.join(root,'backups');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const dest=path.join(backupRoot,stamp+'-'+crypto.randomBytes(3).toString('hex'));
fs.mkdirSync(dest,{recursive:true,mode:0o700});
const backupPath=path.join(dest,'docprazo.sqlite');
const db=new DatabaseSync(database);
try{
 db.exec('PRAGMA busy_timeout=10000');
 db.exec(`VACUUM INTO '${backupPath.replace(/'/g,"''")}'`);
}finally{db.close();}
if(fs.existsSync(path.join(data,'uploads')))fs.cpSync(path.join(data,'uploads'),path.join(dest,'uploads'),{recursive:true});
fs.writeFileSync(path.join(dest,'LEIA-ME.txt'),'Backup DocPrazo - '+new Date().toISOString()+'\nConteúdo: banco SQLite consistente e anexos.\nRestaurar somente com o servidor parado.\n');
console.log('Backup concluído em:',dest);
