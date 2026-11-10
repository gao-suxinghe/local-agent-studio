import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStudioServer} from '../backend/server.mjs';
import {discover} from '../backend/lib/discovery.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),qa=path.join(root,'work/real-collaboration-'+Date.now());
await fs.mkdir(path.join(qa,'project'),{recursive:true});
const app=await createStudioServer({root:path.join(qa,'data'),port:0}),{studio,store}=app;
const record={startedAt:new Date().toISOString(),dataRoot:path.join(qa,'data'),purpose:'three local engines, one bounded no-tools collaboration',phases:[],modelTasksExecuted:true,completed:false};
async function wait(predicate,limit=180000){const started=Date.now();while(Date.now()-started<limit){const blocked=store.all('approvals').find(a=>a.state==='pending');if(blocked)throw new Error('A native approval needs user input: '+blocked.title);const value=predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,400));}throw new Error('Smoke stage timed out');}
try{
  const candidates=await discover(),members={};for(const kind of ['codex','hermes','dsh']){
    const candidate=candidates.find(c=>c.kind===kind);if(!candidate?.executable)throw new Error(kind+' executable not found');
    let engine=await studio.createEngine({...candidate,label:kind+' 本机验证'});engine=await studio.probeEngine(engine.id);if(engine.status!=='connected')throw new Error(engine.lastError);
    members[kind]=studio.createMember({name:kind==='codex'?'开发工程师':kind==='hermes'?'项目经理':'质量助理',engineId:engine.id,model:kind==='dsh'&&process.argv.includes('--dsh-account')?'["deepseek-account","deepseek-flash"]':'',specialty:'接口与协作验证，仅执行本次简短验收要求'});record.phases.push({engine:kind,probe:'connected'});
  }
  const project=await studio.createProject({name:'本机三引擎协作验收',root:path.join(qa,'project'),brief:'这是隔离验收。请只规划一条无需工具的任务：执行成员只在最终回复中返回 LOCAL_STUDIO_OK。复核成员根据收到的执行回复检查是否包含该字符串，只在回复中给出结构化结论。整个验收不需要调用任何工具或读写项目文件。',acceptance:'执行回复含 LOCAL_STUDIO_OK，独立复核给出 pass 与明确字符串检查证据。'});
  studio.appoint(project.id,{memberId:members.hermes.id,role:'manager',responsibility:'只返回一条任务的JSON计划，分配给执行成员和不同的复核成员'});
  studio.appoint(project.id,{memberId:members.codex.id,role:'executor',responsibility:'不调用工具，在最终回复中只返回 LOCAL_STUDIO_OK'});
  studio.appoint(project.id,{memberId:members.dsh.id,role:'reviewer',responsibility:'不调用工具，检查给出的执行输出是否包含 LOCAL_STUDIO_OK，返回JSON复核证据'});
  const planning=await studio.planProject(project.id);process.stdout.write('Planning dispatched to Hermes\n');
  const plan=await wait(()=>{const run=store.get('runs',planning.id);if(['failed','unknown','cancelled'].includes(run.state))throw new Error(run.error);if(run.planError)throw new Error(run.planError);return store.all('plans').find(p=>p.projectId===project.id&&p.state==='pending');});
  if(plan.tasks.length!==1)throw new Error('Planner should propose one bounded task');record.phases.push({phase:'planning',engine:'hermes',status:'completed',runId:planning.id});
  const approved=studio.approvePlan(plan.id);await studio.startTask(approved.taskIds[0],{manual:true});process.stdout.write('Plan approved; Codex execution and DSH review dispatched\n');
  const task=await wait(()=>{const task=store.get('tasks',approved.taskIds[0]);if(['blocked','uncertain','cancelled'].includes(task.state))throw new Error(task.lastError);return task.state==='verified'?task:null;});
  studio.acceptProject(project.id);record.completed=true;record.projectId=project.id;record.taskId=task.id;record.runs=store.all('runs').map(r=>({id:r.id,engine:store.get('engines',r.engineId).kind,phase:r.phase,state:r.state,sessionId:r.sessionId,output:r.output}));process.stdout.write('Three-engine collaboration verified and accepted\n');
}catch(error){record.error=String(error.message);for(const run of store.all('runs').filter(r=>['starting','running','waiting_approval','stopping'].includes(r.state))){try{await studio.stopRun(run.id);}catch{}}process.stdout.write('Smoke incomplete: '+record.error+'\n');process.exitCode=1;}
finally{record.endedAt=new Date().toISOString();record.runs=store.all('runs').map(r=>({id:r.id,engine:store.get('engines',r.engineId).kind,phase:r.phase,state:r.state,sessionId:r.sessionId,output:r.output,error:r.error}));await fs.writeFile(path.join(root,'work/real-collaboration-result.json'),JSON.stringify(record,null,2));await app.close();}
