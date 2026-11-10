import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createStudioServer} from '../backend/server.mjs';
import {sandbox} from './helpers.mjs';
import {id} from '../backend/lib/util.mjs';

test('loopback API authenticates reads, rejects foreign origins, and loads without Codex configuration',async t=>{const s=await sandbox(t),app=await createStudioServer({root:path.join(s.base,'http'),port:0,registry:false});s.onCleanup(()=>app.close());const base=app.connection.baseUrl;assert.equal((await fetch(base+'/api/health')).status,200);assert.equal((await fetch(base+'/api/state')).status,401);assert.equal((await fetch(base+'/api/state',{headers:{'x-studio-token':app.connection.token,origin:'http://evil.test'}})).status,403);const state=await(await fetch(base+'/api/state',{headers:{'x-studio-token':app.connection.token}})).json();assert.equal(state.engines.length,0);assert.equal(state.settings.autoDispatch,false);});
test('desktop bootstrap cookie authenticates the subsequent UI request',async t=>{const s=await sandbox(t),app=await createStudioServer({root:path.join(s.base,'http'),port:0,registry:false});s.onCleanup(()=>app.close());const response=await fetch(app.connection.baseUrl+'/?token='+app.connection.token,{redirect:'manual'});assert.equal(response.status,302);const cookie=response.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(app.connection.baseUrl+'/api/state',{headers:{cookie}})).status,200);});
test('HTTP mutation replay does not create duplicate projects',async t=>{const s=await sandbox(t),app=await createStudioServer({root:path.join(s.base,'http'),port:0,registry:false});s.onCleanup(()=>app.close());const payload={operationId:id('op'),name:'项目',root:s.projectRoot},send=value=>fetch(app.connection.baseUrl+'/api/projects',{method:'POST',headers:{'content-type':'application/json','x-studio-token':app.connection.token},body:JSON.stringify(value)});const first=await(await send(payload)).json(),second=await(await send(payload)).json();assert.equal(first.id,second.id);assert.equal(app.store.all('projects').length,1);assert.equal((await send({...payload,name:'改动'})).status,409);});
test('pairing can verify only its own registration and cannot read the workspace',async t=>{const s=await sandbox(t),app=await createStudioServer({root:path.join(s.base,'http'),port:0,registry:false,adapterFactory:()=>({probe:async()=>({status:'connected',capabilities:{execute:true},models:[]}),close:async()=>{}})});s.onCleanup(()=>app.close());const invite=app.store.invitation('codex','接入成员','selected-model'),send=(route,value)=>fetch(app.connection.baseUrl+'/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});const payload={secret:invite.secret,kind:'codex',executable:process.execPath,name:'接入成员'};const first=await(await send('pair',payload)).json(),second=await(await send('pair',payload)).json();assert.equal(first.memberId,second.memberId);assert.equal(app.store.all('members').length,1);assert.equal(app.store.get('members',first.memberId).model,'selected-model');const result=await(await send('pair/verify',{secret:invite.secret})).json();assert.equal(result.connection,'connected');assert.equal((await fetch(app.connection.baseUrl+'/api/state',{headers:{'x-studio-token':invite.secret}})).status,401);});

test('an idea in the trash can be restored or permanently removed with a replayable operation',async t=>{
  const s=await sandbox(t),app=await createStudioServer({root:path.join(s.base,'http'),port:0,registry:false});
  s.onCleanup(()=>app.close());
  const idea=app.studio.createIdea({body:'先记录这个想法'});
  const send=(suffix,payload={})=>fetch(app.connection.baseUrl+'/api/ideas/'+idea.id+suffix,{
    method:'POST',
    headers:{'content-type':'application/json','x-studio-token':app.connection.token},
    body:JSON.stringify({operationId:id('op'),...payload})
  });
  assert.equal((await send('/delete',{revision:idea.revision})).status,409);
  const trashed=await (await send('',{deleted:true,revision:idea.revision})).json();
  const restored=await (await send('',{deleted:false,revision:trashed.revision})).json();
  assert.equal(restored.body,idea.body);
  assert.equal(restored.deleted,false);
  const again=await (await send('',{deleted:true,revision:restored.revision})).json();
  const removal={operationId:id('op'),revision:again.revision};
  assert.equal((await send('/delete',removal)).status,200);
  assert.equal((await send('/delete',removal)).status,200);
  assert.equal(app.store.get('ideas',idea.id),null);
});
