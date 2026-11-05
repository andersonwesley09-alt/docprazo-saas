'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'docprazo-migracao-'));
process.env.DATA_DIR=temp;
const old=new DatabaseSync(path.join(temp,'docprazo.sqlite'));
old.exec(`CREATE TABLE organizations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE documents(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER NOT NULL,title TEXT NOT NULL,category TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '',responsible TEXT NOT NULL DEFAULT '',issue_date TEXT,expires_on TEXT NOT NULL,lead_days INTEGER NOT NULL DEFAULT 30,notes TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO organizations(name) VALUES ('Empresa V1');
INSERT INTO users(organization_id,name,email,password_hash) VALUES (1,'Ana','ana-legacy@example.com','fake-hash');
INSERT INTO documents(organization_id,title,category,expires_on) VALUES (1,'Licença Antiga','Licença','2027-01-01');`);
old.close();
const {server,db}=require('../server');
test('Upgrade preserva documentos e contas da V1',()=>{
 try {
  assert.equal(db.prepare('SELECT name FROM organizations WHERE id=1').get().name,'Empresa V1');
  assert.equal(db.prepare('SELECT title FROM documents WHERE id=1').get().title,'Licença Antiga');
  const user=db.prepare('SELECT role,active FROM users WHERE id=1').get();
  assert.equal(user.role,'admin');assert.equal(user.active,1);
  assert.equal(db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'attachments\'').get().name,'attachments');
 }finally{db.close();server.close();fs.rmSync(temp,{recursive:true,force:true});}
});
