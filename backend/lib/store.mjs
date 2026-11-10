import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Problem,id,stamp,clean,digest,stable,assertOperation} from './util.mjs';

export class Store {
  constructor(root){
    this.root=root;fs.mkdirSync(root,{recursive:true,mode:0o700});
    this.db=new DatabaseSync(path.join(root,'studio.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER NOT NULL,project_id TEXT,run_id TEXT,type TEXT NOT NULL,message TEXT NOT NULL,details TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,kind TEXT NOT NULL,fingerprint TEXT NOT NULL,state TEXT NOT NULL,result TEXT,at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS invitations(hash TEXT PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,expires INTEGER NOT NULL,result TEXT,fingerprint TEXT,model TEXT NOT NULL DEFAULT '');
      PRAGMA user_version=1;`);
    if(!this.db.prepare('PRAGMA table_info(invitations)').all().some(c=>c.name==='model'))this.db.exec("ALTER TABLE invitations ADD COLUMN model TEXT NOT NULL DEFAULT ''");
    if(!this.get('settings','workspace'))this.put('settings',{id:'workspace',officeName:'我的本机工作室',bossName:'我',appearance:{scene:'city',motion:'lively',bubbles:true},autoDispatch:false,maxParallel:2});
  }
  get(kind,key){const row=this.db.prepare('SELECT data,revision FROM records WHERE kind=? AND id=?').get(kind,key);if(!row)return null;return {...JSON.parse(row.data),revision:row.revision};}
  need(kind,key,expected){
    const item=this.get(kind,key);
    if(!item)throw new Problem('这条记录不存在。',404);
    if(expected!==undefined&&item.revision!==expected)throw new Problem('内容已更新，请刷新后重试。',409);
    return item;
  }
  all(kind){return this.db.prepare('SELECT data,revision FROM records WHERE kind=? ORDER BY updated DESC,id').all(kind).map(row=>({...JSON.parse(row.data),revision:row.revision}));}
  put(kind,item,expected){
    const old=this.get(kind,item.id);if(expected!==undefined&&old?.revision!==expected)throw new Problem('内容已更新，请刷新后重试。',409);
    const next={...item,createdAt:old?.createdAt||item.createdAt||stamp(),updatedAt:stamp()};delete next.revision;
    this.db.prepare('INSERT INTO records(kind,id,data,revision,updated) VALUES(?,?,?,1,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,revision=records.revision+1,updated=excluded.updated').run(kind,item.id,JSON.stringify(next),next.updatedAt);
    return this.get(kind,item.id);
  }
  patch(kind,key,changes,expected){return this.put(kind,{...this.need(kind,key),...changes,id:key},expected);}
  delete(kind,key){this.db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,key);}
  deleteRelated(kind,field,key){
    this.db.prepare('DELETE FROM records WHERE kind=? AND json_extract(data,?)=?').run(kind,'$.'+field,key);
  }
  deleteProjectEvents(key){this.db.prepare('DELETE FROM events WHERE project_id=?').run(key);}
  deleteTaskEvents(key){
    this.db.prepare(`DELETE FROM events WHERE json_extract(details,'$.taskId')=?
      OR run_id IN (SELECT id FROM records WHERE kind='runs' AND json_extract(data,'$.taskId')=?)`).run(key,key);
  }
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  event(type,message,{projectId=null,runId=null,...details}={}){this.db.prepare('INSERT INTO events(at,project_id,run_id,type,message,details) VALUES(?,?,?,?,?,?)').run(stamp(),projectId,runId,type,clean(message,1500),JSON.stringify(details));}
  events({projectId=null,after=0,limit=150}={}){return this.db.prepare('SELECT * FROM events WHERE seq>? AND (? IS NULL OR project_id=?) ORDER BY seq DESC LIMIT ?').all(Number(after)||0,projectId,projectId,Math.min(limit,300)).map(e=>({id:e.seq,at:e.at,projectId:e.project_id,runId:e.run_id,type:e.type,message:e.message,...JSON.parse(e.details)}));}
  async operation(key,kind,payload,fn){
    assertOperation(key);const fingerprint=digest(stable(payload)),old=this.db.prepare('SELECT * FROM operations WHERE id=?').get(key);
    if(old){if(old.kind!==kind||old.fingerprint!==fingerprint)throw new Problem('这个操作编号已用于其他内容。',409);if(old.state==='done')return JSON.parse(old.result);throw new Problem('这次操作已提交，请先刷新核对结果。',409,true);}
    this.db.prepare('INSERT INTO operations VALUES(?,?,?,?,?,?)').run(key,kind,fingerprint,'started',null,stamp());
    try{const result=await fn();this.db.prepare("UPDATE operations SET state='done',result=? WHERE id=?").run(JSON.stringify(result??{}),key);return result;}catch(error){this.db.prepare("UPDATE operations SET state='failed',result=? WHERE id=?").run(JSON.stringify({error:clean(error.message)}),key);throw error;}
  }
  invitation(kind,name,model=''){const secret=crypto.randomBytes(24).toString('base64url'),expires=stamp()+10*60*1000;this.db.prepare('INSERT INTO invitations(hash,kind,name,expires,result,fingerprint,model) VALUES(?,?,?,?,NULL,NULL,?)').run(digest(secret),kind,name,expires,model);return{secret,expires,kind,name,model};}
  registration(secret){const invite=this.db.prepare('SELECT * FROM invitations WHERE hash=?').get(digest(String(secret||'')));if(!invite||invite.expires<stamp()||!invite.result)throw new Problem('注册邀请未完成或已经失效。',403);return JSON.parse(invite.result);}
  redeem(secret,payload,fn){
    const hash=digest(String(secret||'')),invite=this.db.prepare('SELECT * FROM invitations WHERE hash=?').get(hash);
    if(!invite||invite.expires<stamp())throw new Problem('邀请已失效，请重新生成。',403);
    if(payload.kind!==invite.kind)throw new Problem('邀请与引擎类型不一致。',403);
    const fingerprint=digest(stable(payload));
    if(invite.result){if(invite.fingerprint!==fingerprint)throw new Problem('邀请已经使用。',409);return JSON.parse(invite.result);}
    return this.transaction(()=>{const result=fn(invite);this.db.prepare('UPDATE invitations SET result=?,fingerprint=? WHERE hash=?').run(JSON.stringify(result),fingerprint,hash);return result;});
  }
  recover(){for(const run of this.all('runs'))if(['starting','running','waiting_approval','stopping'].includes(run.state)){this.patch('runs',run.id,{state:'unknown',error:'后台曾中断，请先核对已有执行。',endedAt:stamp()});if(run.taskId)this.patch('tasks',run.taskId,{state:'uncertain',lastError:'上次执行结果未确认，等待核对。'});this.event('recovery','发现需要核对的上次执行',{projectId:run.projectId,runId:run.id});}for(const approval of this.all('approvals'))if(approval.state==='pending')this.patch('approvals',approval.id,{state:'expired'});}
  close(){this.db.close();}
}
