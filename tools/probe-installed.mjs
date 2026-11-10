import fs from 'node:fs/promises';
import {discover,validatedConfig} from '../backend/lib/discovery.mjs';
import {Adapter} from '../backend/lib/adapters.mjs';
const results=[];
for(const candidate of await discover()){
  if(!candidate.executable){results.push({...candidate,status:'not-found'});continue;}
  const config=await validatedConfig(candidate),adapter=new Adapter(config);
  try{const result=await adapter.probe();results.push({...candidate,...result});process.stdout.write(JSON.stringify({kind:candidate.kind,status:result.status,version:result.version})+'\n');}
  catch(error){results.push({...candidate,status:'error',error:error.message});process.stdout.write(JSON.stringify({kind:candidate.kind,status:'error',error:error.message})+'\n');}
  finally{await adapter.close();}
}
await fs.mkdir(new URL('../work/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../work/engine-probes.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),modelTasksExecuted:false,results},null,2));
