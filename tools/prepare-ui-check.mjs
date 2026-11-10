import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from '../backend/lib/store.mjs';
import {Studio} from '../backend/lib/studio.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),evidence=JSON.parse(await fs.readFile(path.join(root,'work/real-collaboration-result.json'),'utf8'));
if(!evidence.completed)throw new Error('A completed real collaboration is needed');
const store=new Store(evidence.dataRoot),studio=new Studio(store);
store.patch('settings','workspace',{officeName:'本机工作室 · 验收',autoDispatch:false});
if(!store.all('projects').some(p=>p.name==='下一步的项目想法')){
  const folder=path.join(root,'work/ui-project');await fs.mkdir(folder,{recursive:true});
  const project=await studio.createProject({name:'下一步的项目想法',root:folder,brief:'整理一份团队工作规范，让任务交接和复核更清楚。',acceptance:'规范覆盖分工、输入、成果与验收。'});
  const members=store.all('members'),manager=members.find(m=>m.name==='项目经理'),executor=members.find(m=>m.name==='开发工程师'),reviewer=members.find(m=>m.name==='质量助理');
  studio.appoint(project.id,{memberId:manager.id,role:'manager',responsibility:'先整理目标和计划，等待老板确认'});studio.appoint(project.id,{memberId:executor.id,role:'executor',responsibility:'按批准的任务提交产物'});studio.appoint(project.id,{memberId:reviewer.id,role:'reviewer',responsibility:'独立复核明确版本的成果'});
  studio.createIdea({projectId:project.id,title:'把团队的交接方式写下来',body:'每个任务都包含明确的输入、交付要求和复核证据。先存为草稿，准备好后再安排。'});
  studio.createTask({projectId:project.id,title:'整理团队工作规范',description:'列清成员职责和成果交接要求。',acceptance:'可按规范完成一次交接。',memberId:executor.id,reviewerId:reviewer.id,draft:true});
}
await fs.writeFile(path.join(root,'work/ui-check-data.json'),JSON.stringify({dataRoot:evidence.dataRoot,projectRoot:path.join(root,'work/ui-project')}));await studio.close();store.close();process.stdout.write(evidence.dataRoot+'\n');
