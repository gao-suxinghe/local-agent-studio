import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../backend/lib/store.mjs';
import {Studio} from '../backend/lib/studio.mjs';
import {Problem,id} from '../backend/lib/util.mjs';

export async function sandbox(t,{script,adapterFactory}={}){
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'agent-studio-test-')),projectRoot=path.join(base,'project');await fs.mkdir(projectRoot);
  const store=new Store(path.join(base,'data')),calls=[],closers=[];
  class FixtureAdapter{
    constructor(engine){this.engine=engine;}
    async probe(){return{status:'connected',version:'fixture',capabilities:{execute:true,continue:true,stop:true,approval:true}};}
    async run(options){calls.push(options);options.identity('session_'+id('test'),'turn_'+id('test'));let rejectStop;const stop=new Promise((_,reject)=>rejectStop=reject);options.control({stop:async()=>rejectStop(new Problem('执行已中断',499))});return Promise.race([Promise.resolve().then(async()=>{
      const output=script?await script(options):options.prompt.includes('现在独立复核')?JSON.stringify({verdict:'pass',summary:'检查通过',evidence:['已检查明确成果']}):'已完成约定成果';return{output,sessionId:'fixture_session',turnId:'fixture_turn'};
    }),stop]);}
    async close(){}
  }
  const studio=new Studio(store,{adapterFactory:adapterFactory||((e)=>new FixtureAdapter(e)),tickMs:20});
  const engine=store.put('engines',{id:id('engine'),kind:'codex',label:'测试引擎',executable:process.execPath,status:'connected',capabilities:{execute:true,continue:true,stop:true,approval:true}});
  const executor=studio.createMember({name:'执行成员',engineId:engine.id}),reviewer=studio.createMember({name:'复核成员',engineId:engine.id}),manager=studio.createMember({name:'项目经理',engineId:engine.id});
  const project=await studio.createProject({name:'隔离测试项目',root:projectRoot,brief:'生成并复核一个本机产物',acceptance:'产物可检查'});
  studio.appoint(project.id,{memberId:executor.id,role:'executor'});studio.appoint(project.id,{memberId:reviewer.id,role:'reviewer'});studio.appoint(project.id,{memberId:manager.id,role:'manager'});
  const task=(extra={})=>studio.createTask({projectId:project.id,title:'交付一个产物',description:'完成一个可检查的文件',acceptance:'文件与要求一致',memberId:executor.id,reviewerId:reviewer.id,...extra});
  t.after(async()=>{for(const close of closers.reverse())await close();await studio.close();store.close();const target=await fs.realpath(base);const parent=await fs.realpath(os.tmpdir());if(path.dirname(target)!==parent||!path.basename(target).startsWith('agent-studio-test-'))throw new Error('Unsafe test cleanup');await fs.rm(target,{recursive:true,force:true});});
  return{base,projectRoot,store,studio,engine,executor,reviewer,manager,project,calls,task,onCleanup:fn=>closers.push(fn)};
}
export async function until(predicate,{timeout=3000}={}){const start=Date.now();while(Date.now()-start<timeout){const value=predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Timed out waiting for expected state');}
