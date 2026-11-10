import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Store} from './lib/store.mjs';
import {Studio} from './lib/studio.mjs';
import {validatedConfig} from './lib/discovery.mjs';
import {APP_ID,VERSION,Problem,dataDirectory,clean,string,within,writeAtomic,integer} from './lib/util.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url)),ASSETS=path.join(ROOT,'assets');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
export async function createStudioServer({root=dataDirectory(),port=47941,adapterFactory,registry=true}={}){
  const store=new Store(root);store.recover();const studio=new Studio(store,{adapterFactory}),token=crypto.randomBytes(32).toString('base64url'),clients=new Set();let closing=false,revision=0,lastSignature='',actualPort;
  function json(res,status,value,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(JSON.stringify(value));}
  function authenticated(req,url){const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('agent_studio_session='))?.slice(21);const supplied=req.headers['x-studio-token']||cookie||url.searchParams.get('token')||'';const left=Buffer.from(String(supplied)),right=Buffer.from(token);return left.length===right.length&&crypto.timingSafeEqual(left,right);}
  async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new Problem('请求格式无效。',415);let text='';for await(const chunk of req){text+=chunk;if(text.length>1_500_000)throw new Problem('请求内容过大。',413);}try{return JSON.parse(text||'{}');}catch{throw new Problem('请求内容无效。');}}
  async function routeMutation(route,input){
    let match;
    if(route==='/engines')return studio.createEngine(input);
    if((match=route.match(/^\/engines\/([^/]+)\/probe$/)))return studio.probeEngine(match[1]);
    if(route==='/members')return studio.createMember(input);
    if((match=route.match(/^\/members\/([^/]+)$/)))return studio.updateMember(match[1],input);
    if((match=route.match(/^\/appointments\/([^/]+)\/remove$/)))return studio.removeAppointment(match[1]);
    if(route==='/projects')return studio.createProject(input);
    if((match=route.match(/^\/projects\/([^/]+)\/team$/)))return studio.appoint(match[1],input);
    if((match=route.match(/^\/projects\/([^/]+)\/status$/)))return studio.setProjectStatus(match[1],input.status);
    if((match=route.match(/^\/projects\/([^/]+)\/plan$/)))return studio.planProject(match[1]);
    if((match=route.match(/^\/projects\/([^/]+)\/accept$/)))return studio.acceptProject(match[1]);
    if((match=route.match(/^\/projects\/([^/]+)\/delete$/)))return studio.deleteProject(match[1],input);
    if((match=route.match(/^\/projects\/([^/]+)$/)))return studio.updateProject(match[1],input);
    if(route==='/tasks')return studio.createTask(input);
    if((match=route.match(/^\/tasks\/([^/]+)$/)))return studio.updateTask(match[1],input);
    if((match=route.match(/^\/tasks\/([^/]+)\/run$/)))return studio.startTask(match[1],{manual:true,revision:input.revision});
    if((match=route.match(/^\/tasks\/([^/]+)\/ready$/)))return studio.readyTask(match[1],input);
    if((match=route.match(/^\/tasks\/([^/]+)\/draft$/)))return studio.draftTask(match[1],input);
    if((match=route.match(/^\/tasks\/([^/]+)\/delete$/)))return studio.deleteDraftTask(match[1],input);
    if((match=route.match(/^\/tasks\/([^/]+)\/accept$/)))return studio.acceptTask(match[1],input);
    if((match=route.match(/^\/runs\/([^/]+)\/stop$/)))return studio.stopRun(match[1]);
    if((match=route.match(/^\/runs\/([^/]+)\/resolve$/)))return studio.resolveUnknown(match[1],input);
    if((match=route.match(/^\/approvals\/([^/]+)$/)))return studio.answerApproval(match[1],input);
    if((match=route.match(/^\/plans\/([^/]+)\/approve$/)))return studio.approvePlan(match[1]);
    if((match=route.match(/^\/plans\/([^/]+)\/reject$/))){const plan=store.need('plans',match[1]);if(plan.state!=='pending')throw new Problem('计划已处理。',409);return store.patch('plans',plan.id,{state:'rejected'});}
    if(route==='/ideas')return studio.createIdea(input);
    if((match=route.match(/^\/ideas\/([^/]+)\/promote$/))){
      return store.transaction(()=>{
        const idea=store.need('ideas',match[1],input.ideaRevision);
        if(idea.deleted)throw new Problem('请先从废纸篓恢复这份草稿。',409);
        if(idea.promotedTaskId)throw new Problem('这份草稿已安排为任务。',409);
        const task=studio.createTask({...input,title:input.title||idea.title,description:input.description||idea.body});
        store.patch('ideas',idea.id,{promotedTaskId:task.id});
        return task;
      });
    }
    if((match=route.match(/^\/ideas\/([^/]+)\/delete$/)))return studio.deleteIdea(match[1],input);
    if((match=route.match(/^\/ideas\/([^/]+)$/)))return studio.updateIdea(match[1],input);
    if(route==='/dispatch')return studio.setDispatch(input);
    if(route==='/service/stop'){if(store.all('runs').some(r=>['starting','running','waiting_approval','stopping','unknown'].includes(r.state)))throw new Problem('请先结束或核对当前执行，再退出后台。',409);studio.setDispatch({enabled:false});return{stopping:true};}
    if(route==='/settings'){const settings=studio.settings(),appearance=input.appearance||settings.appearance;return store.patch('settings','workspace',{officeName:string(input.officeName??settings.officeName,32,true),bossName:string(input.bossName??settings.bossName,18,true),maxParallel:integer(input.maxParallel,settings.maxParallel,1,5),appearance:{scene:['city','garden','orbital'].includes(appearance.scene)?appearance.scene:'city',motion:['off','calm','lively'].includes(appearance.motion)?appearance.motion:'lively',bubbles:appearance.bubbles!==false}},input.revision);}
    if(route==='/invitations'){
      if(!['codex','hermes','dsh'].includes(input.kind))throw new Problem('引擎类型无效。');const invite=store.invitation(input.kind,string(input.name,80,true),string(input.model,150));return{...invite,platform:process.platform,baseUrl:`http://127.0.0.1:${actualPort}`,helper:process.env.AGENT_STUDIO_REGISTER_HELPER||path.join(ROOT,'..','tools',process.platform==='win32'?'register-agent.cmd':'register-agent.command')};
    }
    throw new Problem('没有找到这项操作。',404);
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const allowed=new Set([`127.0.0.1:${actualPort}`,`localhost:${actualPort}`]);if(!allowed.has(req.headers.host)||req.headers.origin&&![...allowed].map(host=>'http://'+host).includes(req.headers.origin))throw new Problem('仅接受当前本机工作室请求。',403);
      const url=new URL(req.url,`http://127.0.0.1:${actualPort}`),route=url.pathname;
      if(req.method==='GET'&&route==='/api/health'){json(res,200,{application:APP_ID,version:VERSION,pid:process.pid});return;}
      if(req.method==='POST'&&route==='/api/pair'){
        const input=await body(req),config=await validatedConfig(input),result=store.redeem(input.secret,{...config,name:string(input.name,80)},invite=>{
          const existing=store.all('engines').find(e=>e.kind===config.kind&&e.executable===config.executable&&e.runtimeHome===config.runtimeHome&&e.profile===config.profile);
          const engine=existing||store.put('engines',{id:'engine_'+crypto.randomUUID(),label:input.kind,...config,status:'unverified',capabilities:{},models:[],lastError:''});
          if(existing&&config.catalogRoot)store.patch('engines',existing.id,{catalogRoot:config.catalogRoot});
          const member=store.put('members',{id:'member_'+crypto.randomUUID(),name:invite.name,engineId:engine.id,model:invite.model||'',specialty:'',avatar:store.all('members').length%8,enabled:true});store.event('registration',member.name+' 已通过本机邀请注册');return{engineId:engine.id,memberId:member.id,name:member.name,connection:'unverified'};
        });json(res,200,result);return;
      }
      if(req.method==='POST'&&route==='/api/pair/verify'){const input=await body(req),registered=store.registration(input.secret),engine=await studio.probeEngine(registered.engineId);json(res,200,{...registered,connection:engine.status,version:engine.version||'',models:engine.models||[],catalogWarning:engine.catalogWarning||'',lastError:engine.lastError||''});return;}
      if(!authenticated(req,url))throw new Problem('本机连接需要重新验证，请重新打开客户端。',401);
      if(req.method==='GET'&&route==='/'&&url.searchParams.has('token')){res.writeHead(302,{'set-cookie':`agent_studio_session=${token}; HttpOnly; SameSite=Strict; Path=/`,'location':'/','cache-control':'no-store','referrer-policy':'no-referrer'});res.end();return;}
      if(req.method==='GET'&&route==='/api/state'){json(res,200,studio.snapshot());return;}
      if(req.method==='GET'&&route==='/api/discover'){json(res,200,await studio.candidates());return;}
      if(req.method==='GET'&&route==='/api/events'){
        res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive','x-accel-buffering':'no'});res.write('retry: 1800\n\n');clients.add(res);res.on('error',()=>clients.delete(res));res.write('event: snapshot\ndata: '+JSON.stringify(studio.snapshot())+'\n\n');req.on('close',()=>clients.delete(res));return;
      }
      const artifactMatch=route.match(/^\/api\/artifacts\/([^/]+)$/);
      if(req.method==='GET'&&artifactMatch){const artifact=store.need('artifacts',artifactMatch[1]),project=store.need('projects',artifact.projectId),real=await fs.realpath(artifact.path).catch(()=>null),artifactRoot=await fs.realpath(path.join(root,'artifacts')).catch(()=>null);if(!real||!(within(project.root,real)||artifactRoot&&within(artifactRoot,real)))throw new Problem('成果文件当前不可用。',404);const stat=await fs.stat(real);if(stat.size>1_000_000)throw new Problem('这个文件较大，请在本机项目目录查看。',413);const data=await fs.readFile(real);json(res,200,{...artifact,changed:digestBuffer(data)!==artifact.sha256,content:clean(data.toString('utf8'),100000)});return;}
      if(req.method==='POST'&&route.startsWith('/api/')){if(req.headers['x-studio-action']!=='1'&&!req.headers['x-studio-token'])throw new Problem('操作来源无效。',403);const input=await body(req),{operationId,...payload}=input,result=await store.operation(operationId,route,payload,()=>routeMutation(route.slice(4),payload));json(res,200,result);if(route==='/api/service/stop')setTimeout(()=>close().then(()=>{if(direct)process.kill(process.pid,'SIGTERM');}),350);return;}
      if(req.method==='GET'){
        const asset=route==='/'?'index.html':decodeURIComponent(route.slice(1));if(!/^[\w.-]+$/.test(asset))throw new Problem('文件不存在。',404);const file=path.join(ASSETS,asset),bytes=await fs.readFile(file).catch(()=>null);if(!bytes)throw new Problem('文件不存在。',404);
        res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(bytes);return;
      }
      throw new Problem('请求不存在。',404);
    }catch(error){json(res,error.status||500,{error:clean(error.message,4000),uncertain:!!error.uncertain});}
  });
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(error){await studio.close();store.close();throw error;}actualPort=server.address().port;
  const connection={application:APP_ID,version:VERSION,pid:process.pid,baseUrl:`http://127.0.0.1:${actualPort}`,token,dataRoot:root};if(registry)await writeAtomic(path.join(root,'service.json'),JSON.stringify(connection));
  const timer=setInterval(()=>{if(!clients.size)return;const snapshot=studio.snapshot(),signature=digestBuffer(Buffer.from(JSON.stringify({...snapshot,generatedAt:0})));if(signature!==lastSignature){lastSignature=signature;revision++;for(const client of clients)client.write('event: snapshot\ndata: '+JSON.stringify({...snapshot,revision})+'\n\n');}else for(const client of clients)client.write(': heartbeat\n\n');},1000);timer.unref?.();
  async function close(){if(closing)return;closing=true;clearInterval(timer);for(const client of clients)client.end();await studio.close();await new Promise(resolve=>server.close(resolve));if(registry){const current=JSON.parse(await fs.readFile(path.join(root,'service.json'),'utf8').catch(()=>'{}'));if(current.pid===process.pid)await fs.unlink(path.join(root,'service.json')).catch(()=>{});}store.close();}
  return{server,store,studio,connection,close};
}
function digestBuffer(value){return crypto.createHash('sha256').update(value).digest('hex');}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const option=key=>{const i=process.argv.indexOf(key);return i<0?null:process.argv[i+1];};const root=option('--data-dir')||dataDirectory();await fs.mkdir(root,{recursive:true,mode:0o700});
  let handle;const lock=path.join(root,'service.lock');try{handle=await fs.open(lock,'wx');await handle.writeFile(JSON.stringify({pid:process.pid}));}catch{const old=JSON.parse(await fs.readFile(lock,'utf8').catch(()=>'{}'));let alive=false;try{if(Number.isInteger(old.pid)){process.kill(old.pid,0);alive=true;}}catch{}if(alive)throw new Error('本机工作室后台已经启动。');await fs.unlink(lock).catch(()=>{});handle=await fs.open(lock,'wx');await handle.writeFile(JSON.stringify({pid:process.pid}));}
  let running;try{try{running=await createStudioServer({root,port:Number(option('--port')??47941)});}catch(error){if(error.code!=='EADDRINUSE')throw error;running=await createStudioServer({root,port:0});}}catch(error){await handle.close();await fs.unlink(lock).catch(()=>{});throw error;}
  process.stdout.write(JSON.stringify(running.connection)+'\n');
  const stop=async()=>{await running.close();await handle.close();await fs.unlink(lock).catch(()=>{});process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
