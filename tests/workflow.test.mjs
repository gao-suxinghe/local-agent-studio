import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {sandbox,until} from './helpers.mjs';
import {checkDependencies} from '../backend/lib/studio.mjs';
import {id,Problem} from '../backend/lib/util.mjs';

test('execution automatically hands off to a different reviewer and then allows owner acceptance',async t=>{const s=await sandbox(t),task=s.task();await s.studio.startTask(task.id,{manual:true});await until(()=>s.store.get('tasks',task.id).state==='verified');assert.deepEqual(s.calls.map(c=>c.member.id),[s.executor.id,s.reviewer.id]);assert.equal(s.calls[1].readOnly,true);assert.equal(s.store.all('artifacts').length,2);s.studio.acceptProject(s.project.id);assert.equal(s.store.get('projects',s.project.id).status,'completed');assert.equal(s.store.get('tasks',task.id).state,'done');});
test('dependent work waits until its predecessor is verified',async t=>{let release;const gate=new Promise(resolve=>release=resolve);let count=0;const s=await sandbox(t,{script:async o=>{if(!o.prompt.includes('现在独立复核'))return '产物';if(++count===1)await gate;return JSON.stringify({verdict:'pass',evidence:['检查产物']});}}),first=s.task(),second=s.task({dependsOn:[first.id],title:'后续任务'});s.studio.setProjectStatus(s.project.id,'active');s.studio.setDispatch({enabled:true});await until(()=>s.store.get('tasks',first.id).state==='reviewing');assert.equal(s.store.get('tasks',second.id).state,'ready');release();await until(()=>s.store.get('tasks',second.id).state==='verified');});
test('review changes trigger bounded rework and preserve the feedback',async t=>{let reviews=0;const s=await sandbox(t,{script:async o=>o.prompt.includes('现在独立复核')?JSON.stringify(++reviews===1?{verdict:'changes_requested',summary:'补充验收证据'}:{verdict:'pass',evidence:['补充检查通过']}):'执行报告'}),task=s.task();await s.studio.startTask(task.id,{manual:true});await until(()=>s.store.get('tasks',task.id).state==='verified');assert.equal(s.store.get('tasks',task.id).reworks,1);assert.equal(s.calls.length,4);assert.match(s.calls[2].prompt,/补充验收证据/);});
test('rework limit blocks instead of creating an unbounded conversation',async t=>{const s=await sandbox(t,{script:async o=>o.prompt.includes('现在独立复核')?JSON.stringify({verdict:'changes_requested',summary:'仍未达标'}):'报告'});s.studio.updateProject(s.project.id,{maxReworks:1});const task=s.task();await s.studio.startTask(task.id,{manual:true});await until(()=>s.store.get('tasks',task.id).state==='blocked');assert.equal(s.calls.length,4);assert.equal(s.store.get('tasks',task.id).autoChain,false);});
test('a pass without review evidence is blocked',async t=>{const s=await sandbox(t,{script:async o=>o.prompt.includes('现在独立复核')?' {"verdict":"pass","summary":"凭感觉通过"} ':'报告'}),task=s.task();await s.studio.startTask(task.id,{manual:true});await until(()=>s.store.get('tasks',task.id).state==='blocked');assert.equal(s.store.get('projects',s.project.id).status,'active');});
test('self review and cross-project dependencies are rejected',async t=>{const s=await sandbox(t);s.studio.appoint(s.project.id,{memberId:s.executor.id,role:'reviewer'});assert.throws(()=>s.task({reviewerId:s.executor.id}),/分开/);assert.throws(()=>s.task({dependsOn:['foreign_task']}),/同一个项目/);});
test('dependency cycles are rejected before dispatch',()=>{const a={id:'a',projectId:'p',dependsOn:['b']},b={id:'b',projectId:'p',dependsOn:['a']};assert.throws(()=>checkDependencies([a,b],a),/循环/);});
test('separate project records sharing one physical directory serialize writers',async t=>{let release;const gate=new Promise(resolve=>release=resolve);const s=await sandbox(t,{script:async()=>{await gate;return '报告';}}),first=s.task({reviewerId:null}),project2=await s.studio.createProject({name:'同目录项目',root:s.projectRoot});const engine2=s.store.put('engines',{...s.engine,id:id('engine')});const member2=s.studio.createMember({name:'另一个成员',engineId:engine2.id});s.studio.appoint(project2.id,{memberId:member2.id,role:'executor'});const second=s.studio.createTask({projectId:project2.id,title:'另一个写任务',description:'写文件',acceptance:'文件正确',memberId:member2.id});await s.studio.startTask(first.id,{manual:true});await assert.rejects(()=>s.studio.startTask(second.id,{manual:true}),/目录正在/);release();await until(()=>s.store.get('tasks',first.id).state==='submitted');});
test('only the current pending native approval can be answered',async t=>{const s=await sandbox(t,{script:async o=>{await o.approval({nativeId:7,type:'permission',title:'写入文件',choices:[{id:'yes',name:'允许本次',kind:'allow_once'},{id:'no',name:'拒绝',kind:'reject_once'}]});return '报告';}}),task=s.task({reviewerId:null});await s.studio.startTask(task.id,{manual:true});const approval=await until(()=>s.store.all('approvals').find(a=>a.state==='pending'));assert.throws(()=>s.studio.answerApproval(approval.id,{choice:'permanent'}),/提供的/);s.studio.answerApproval(approval.id,{choice:'yes'});assert.throws(()=>s.studio.answerApproval(approval.id,{choice:'yes'}),/过期/);await until(()=>s.store.get('tasks',task.id).state==='submitted');});
test('unknown execution prevents automatic retry until the owner resolves it',async t=>{const s=await sandbox(t,{script:async()=>{throw new Problem('transport lost',503,true);}}),task=s.task();await s.studio.startTask(task.id,{manual:true});const run=await until(()=>s.store.all('runs').find(r=>r.state==='unknown'));assert.equal(s.store.get('tasks',task.id).state,'uncertain');assert.throws(()=>s.studio.readyTask(task.id));s.studio.resolveUnknown(run.id,{confirmInterrupted:true});s.studio.readyTask(task.id);assert.equal(s.store.get('tasks',task.id).state,'ready');});
test('project completion rejects unfinished or unverified work',async t=>{const s=await sandbox(t);s.task();assert.throws(()=>s.studio.acceptProject(s.project.id),/先完成/);});
test('plan confirmation is atomic and preserves dependency mapping',async t=>{const s=await sandbox(t);const p=s.store.put('plans',{id:id('plan'),projectId:s.project.id,state:'pending',teamRevision:s.store.get('projects',s.project.id).teamRevision,tasks:[{key:'a',title:'需求',description:'梳理',acceptance:'完整',memberId:s.executor.id,reviewerId:s.reviewer.id,dependsOn:[],outputPaths:[]},{key:'b',title:'实现',description:'实现',acceptance:'可用',memberId:s.executor.id,reviewerId:s.reviewer.id,dependsOn:['a'],outputPaths:[]}]});const result=s.studio.approvePlan(p.id);assert.equal(result.taskIds.length,2);const tasks=s.store.all('tasks');assert.deepEqual(tasks.find(t=>t.title==='实现').dependsOn,[tasks.find(t=>t.title==='需求').id]);assert.throws(()=>s.studio.approvePlan(p.id),/已经处理/);assert.equal(s.store.all('tasks').length,2);});
test('team changes invalidate an old planning proposal',async t=>{const s=await sandbox(t),project=s.store.get('projects',s.project.id),plan=s.store.put('plans',{id:id('plan'),projectId:project.id,state:'pending',teamRevision:project.teamRevision,tasks:[]});s.studio.appoint(project.id,{memberId:s.executor.id,role:'executor',responsibility:'新职责'});assert.throws(()=>s.studio.approvePlan(plan.id),/任命已变化/);});
test('artifact capture rejects symlinks leading out of the project',async t=>{const s=await sandbox(t),outside=path.join(s.base,'outside.txt');await fs.writeFile(outside,'not an artifact');let link=true;try{await fs.symlink(outside,path.join(s.projectRoot,'link.txt'));}catch{link=false;}if(!link){t.skip('Windows symlink privilege unavailable');return;}const run={id:id('run'),projectId:s.project.id,taskId:null,phase:'execution'};const artifacts=await s.studio.capture(run,'report',['link.txt']);assert.equal(artifacts.length,1);});
test('declared output files are versioned with hashes',async t=>{const s=await sandbox(t);await fs.writeFile(path.join(s.projectRoot,'result.txt'),'version one');const run={id:id('run'),projectId:s.project.id,taskId:null,phase:'execution'},artifacts=await s.studio.capture(run,'report',['result.txt']);assert.equal(artifacts.length,2);assert.equal(artifacts.find(a=>a.kind==='file').sha256.length,64);});
test('missing declared artifacts block handoff instead of claiming completion',async t=>{const s=await sandbox(t),task=s.task({outputPaths:['missing.txt']});await s.studio.startTask(task.id,{manual:true});await until(()=>s.store.get('tasks',task.id).state==='blocked');assert.match(s.store.get('tasks',task.id).lastError,/成果文件/);assert.equal(s.calls.length,1);});
test('verified projects retain their accepted scope',async t=>{const s=await sandbox(t),task=s.task();await s.studio.startTask(task.id,{manual:true});await until(()=>s.store.get('tasks',task.id).state==='verified');s.studio.acceptProject(s.project.id);assert.throws(()=>s.studio.updateProject(s.project.id,{brief:'改写'}),/已验收/);assert.throws(()=>s.task(),/已验收/);await assert.rejects(()=>s.studio.planProject(s.project.id),/已验收/);});
test('changing project goals invalidates an unapproved plan',async t=>{const s=await sandbox(t),project=s.store.get('projects',s.project.id),plan=s.store.put('plans',{id:id('plan'),projectId:project.id,state:'pending',teamRevision:project.teamRevision,briefRevision:0,tasks:[]});s.studio.updateProject(project.id,{brief:'新的交付范围'});assert.throws(()=>s.studio.approvePlan(plan.id),/目标已变化/);});
test('low priority zero is preserved and malformed numeric limits are rejected',async t=>{const s=await sandbox(t);assert.equal(s.task({priority:0}).priority,0);assert.throws(()=>s.task({priority:'bad'}),/数字/);assert.throws(()=>s.studio.updateProject(s.project.id,{maxReworks:'bad'}),/数字/);});

test('deleting a completed project clears its work records and keeps linked ideas and project files',async t=>{
  const s=await sandbox(t);
  const unrelated=await s.studio.createProject({name:'同目录的另一个项目',root:s.projectRoot});
  const task=s.task({reviewerId:null,outputPaths:['result.txt']});
  const idea=s.studio.createIdea({projectId:s.project.id,body:'保留的想法'});
  s.store.patch('ideas',idea.id,{promotedTaskId:task.id});
  const output=path.join(s.projectRoot,'result.txt');
  await fs.writeFile(output,'keep me');
  await s.studio.startTask(task.id,{manual:true});
  await until(()=>s.store.get('tasks',task.id).state==='submitted');
  s.studio.acceptTask(task.id,{});
  const completed=s.studio.acceptProject(s.project.id);

  s.studio.deleteProject(completed.id,{revision:completed.revision});

  assert.deepEqual(s.store.all('projects').map(project=>project.id),[unrelated.id]);
  for(const kind of ['tasks','runs','artifacts','assignments']){
    assert.equal(s.store.all(kind).some(record=>record.projectId===completed.id),false);
  }
  assert.deepEqual(s.store.events({projectId:completed.id}),[]);
  assert.equal(s.store.get('ideas',idea.id).projectId,null);
  assert.equal(s.store.get('ideas',idea.id).promotedTaskId,null);
  assert.equal(s.store.all('members').length,3);
  assert.equal(await fs.readFile(output,'utf8'),'keep me');
});

test('draft moves and deletion respect revisions, dependencies and active runs',async t=>{
  const s=await sandbox(t),first=s.task({title:'前置工作',draft:true});
  const ready=s.studio.readyTask(first.id,{revision:first.revision});
  assert.throws(()=>s.studio.deleteDraftTask(first.id,{revision:first.revision}),/内容已更新/);
  const draft=s.studio.draftTask(first.id,{revision:ready.revision});
  assert.equal(draft.state,'draft');
  const dependent=s.task({title:'后续工作',dependsOn:[first.id],draft:true});
  assert.throws(()=>s.studio.deleteDraftTask(first.id,{revision:draft.revision}),/后续工作.*前置任务/);
  s.studio.deleteDraftTask(dependent.id,{revision:dependent.revision});
  s.studio.deleteDraftTask(first.id,{revision:draft.revision});
  assert.equal(s.store.get('tasks',first.id),null);

  const task=s.task({reviewerId:null});
  await s.studio.startTask(task.id,{manual:true});
  assert.throws(()=>s.studio.deleteProject(s.project.id),/先停止或核对/);
  assert.throws(()=>s.studio.draftTask(task.id),/尚未领取/);
});
