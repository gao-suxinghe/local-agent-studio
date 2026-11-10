import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {Adapter} from '../backend/lib/adapters.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),result=JSON.parse(await fs.readFile(path.join(root,'work/real-collaboration-result.json'),'utf8'));
const db=new DatabaseSync(path.join(result.dataRoot,'studio.sqlite'),{readOnly:true});
const rows=kind=>db.prepare('SELECT data FROM records WHERE kind=?').all(kind).map(r=>JSON.parse(r.data));
const engines=rows('engines'),runs=rows('runs'),projects=rows('projects'),run=runs.find(r=>engines.find(e=>e.id===r.engineId)?.kind==='dsh'),engine=engines.find(e=>e.id===run?.engineId);
if(!engine)throw new Error('No DSH smoke session');
const adapter=new Adapter(engine);
try{const host=await adapter.connect();const response=await host.request('session/resume',{sessionId:run.sessionId,cwd:projects.find(p=>p.id===run.projectId).root,mcpServers:[]},45000);const catalog={models:response.models,configOptions:response.configOptions};await fs.writeFile(path.join(root,'work/dsh-model-catalog.json'),JSON.stringify(catalog,null,2));process.stdout.write(JSON.stringify(catalog)+'\n');}finally{await adapter.close();db.close();}
