const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{spawn}=require('node:child_process');
const APP='agent-office-studio';
const {version}=require('./package.json');
async function json(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}}
function rootDirectory(){return process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'AgentOfficeStudio'):process.platform==='darwin'?path.join(os.homedir(),'Library/Application Support/AgentOfficeStudio'):path.join(process.env.XDG_DATA_HOME||path.join(os.homedir(),'.local/share'),'agent-office-studio');}
function loopback(value){try{const u=new URL(value);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&!!u.port&&u.pathname==='/'&&!u.username&&!u.password;}catch{return false;}}
function health(record){return new Promise((resolve,reject)=>{if(record?.application!==APP||!loopback(record.baseUrl)||typeof record.token!=='string'){reject(new Error('服务身份无效'));return;}const request=http.get(record.baseUrl+'/api/health',res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>{try{const value=JSON.parse(body);if(value.application!==APP||value.pid!==record.pid||value.version!==version)throw new Error('服务不匹配');resolve(record);}catch(error){reject(error);}});});request.setTimeout(2000,()=>request.destroy(new Error('服务未响应')));request.on('error',reject);});}
async function connect({backendRoot,dataRoot=rootDirectory(),execPath=process.execPath,onStatus=()=>{},helper}={}){
  const root=path.resolve(dataRoot);if(/(?:CodexTaskBoard|CodexOfficeClient)(?:[\\/]|$)/i.test(root))throw new Error('请为本机工作室选择独立的数据目录。');await fs.mkdir(root,{recursive:true,mode:0o700});
  const existing=await json(path.join(root,'service.json'));if(existing){const running=await health(existing).catch(()=>null);if(running)return{...running,url:running.baseUrl+'/?token='+running.token};}
  onStatus('正在启动独立的本机工作室服务…');const fd=await fs.open(path.join(root,'service.log'),'a');
  const child=spawn(execPath,[path.join(backendRoot,'server.mjs'),'--data-dir',root,'--port','47941'],{cwd:backendRoot,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',AGENT_STUDIO_DATA_DIR:root,AGENT_STUDIO_REGISTER_HELPER:helper||'',PYTHONDONTWRITEBYTECODE:'1'},detached:true,windowsHide:true,stdio:['ignore','ignore',fd.fd]});child.on('error',()=>{});child.unref();await fd.close();
  for(let index=0;index<100;index++){await new Promise(resolve=>setTimeout(resolve,250));const record=await json(path.join(root,'service.json'));const running=record&&await health(record).catch(()=>null);if(running)return{...running,url:running.baseUrl+'/?token='+running.token};}
  throw new Error('本机工作室服务没有就绪，请查看独立数据目录中的 service.log。');
}
module.exports={json,rootDirectory,loopback,health,connect};
