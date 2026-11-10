import {RpcHost} from './rpc.mjs';
import {command,version} from './discovery.mjs';
import {clean,Problem,publicOutput} from './util.mjs';

function sessionModels(session){const config=session.configOptions?.find(o=>o.id==='model'||o.category==='model');if(config){const models=[];for(const group of config.options||[]){for(const item of group.options||[group])if(item.value)models.push({id:item.value,name:(group.options?(group.name||group.group)+' / ':'')+(item.name||item.value)});}return{models,defaultModel:config.currentValue};}return{models:(session.models?.availableModels||[]).map(m=>({id:m.modelId,name:m.name||m.modelId})),defaultModel:session.models?.currentModelId||''};}

export class Adapter {
  constructor(engine,{hostFactory=(...args)=>new RpcHost(...args)}={}){this.engine=engine;this.hostFactory=hostFactory;this.host=null;this.contexts=new Map();this.connecting=null;}
  async connect(){
    if(this.host&&!this.host.closed)return this.host;if(this.connecting)return this.connecting;
    this.connecting=(async()=>{const codex=this.engine.kind==='codex',host=this.hostFactory(command(this.engine),{codex});this.host=host;
      host.requestHandler=(method,params,requestId)=>this.onRequest(method,params,requestId);
      host.on('notification',(method,params)=>this.onNotification(method,params));
      host.on('disconnect',error=>{for(const context of this.contexts.values())context.failed?.(new Problem(clean(error.message),503,true));this.contexts.clear();});
      try{this.initialized=await host.request('initialize',codex?{clientInfo:{name:'agent-office-studio',title:'本机工作室',version:'0.1.0'},capabilities:{experimentalApi:true}}:{protocolVersion:1,clientCapabilities:{fs:{readTextFile:false,writeTextFile:false},terminal:false},clientInfo:{name:'agent-office-studio',version:'0.1.0'}},45000);if(codex)host.notify('initialized');return host;}catch(error){await host.close();throw error;}
    })().finally(()=>{this.connecting=null;});return this.connecting;
  }
  async probe({catalogCwd}={}){
    const host=await this.connect();let models=[],defaultModel='',catalogWarning='';
    if(this.engine.kind==='codex'){
      const listed=(await host.request('model/list',{limit:100}).catch(()=>({data:[]}))).data||[];
      models=listed.map(m=>({id:m.id||m.model,name:m.displayName||m.id||m.model}));
    }else if(catalogCwd){
      try{const session=await host.request('session/new',{cwd:catalogCwd,mcpServers:[]},45000),catalog=sessionModels(session);models=catalog.models;defaultModel=catalog.defaultModel;await host.request('session/close',{sessionId:session.sessionId},4000).catch(()=>{});}
      catch(error){catalogWarning='连接握手通过；模型列表暂未读取，请在真实项目中检查或沿用引擎配置。'+clean(error.message,500);}
    }else catalogWarning='模型列表将在真实项目会话中读取，目前可沿用引擎配置。';
    return{status:'connected',version:await version(this.engine),capabilities:{execute:true,continue:true,stop:true,approval:true,history:false,protocol:this.engine.kind==='codex'?'codex-app-server':'acp'},models,defaultModel,catalogWarning,agentInfo:this.initialized?.agentInfo||null};
  }
  async onRequest(method,params,requestId){
    const key=params.threadId||params.sessionId,context=this.contexts.get(key);if(!context)throw new Error('这次交互不属于当前工作室执行。');
    if(['item/commandExecution/requestApproval','item/fileChange/requestApproval','execCommandApproval','applyPatchApproval'].includes(method)){
      const choices=[{id:'accept',name:'允许本次',kind:'allow_once'},{id:'decline',name:'拒绝',kind:'reject_once'}];const decision=await context.approval({nativeId:requestId,type:'permission',title:clean(params.reason||params.command||'执行需要你的批准',1500),details:clean(JSON.stringify(params),16000),choices});return{decision:decision.choice};
    }
    if(method==='item/tool/requestUserInput'){
      const result=await context.approval({nativeId:requestId,type:'question',title:'成员需要你的回答',questions:params.questions||[],details:'请逐项回答后继续。',choices:[]});return{answers:result.answers};
    }
    if(method==='session/request_permission'){
      const choices=(params.options||[]).map(o=>({id:o.optionId,name:o.name,kind:o.kind}));const result=await context.approval({nativeId:requestId,type:'permission',title:clean(params.toolCall?.title||'执行需要你的批准',1200),details:clean(JSON.stringify(params.toolCall||{}),16000),choices});return{outcome:{outcome:'selected',optionId:result.choice}};
    }
    throw new Error('当前工作室尚未支持这类引擎交互：'+method);
  }
  onNotification(method,params){
    if(this.engine.kind!=='codex'){
      if(method!=='session/update')return;const c=this.contexts.get(params.sessionId);if(!c)return;const update=params.update||{},type=update.sessionUpdate;
      if(type==='agent_message_chunk'&&update.content?.type==='text'){
        const key=update.messageId||update.message_id||'stream',previous=c.messages.get(key)||'',chunk=update.content.text;
        // Hermes output hooks replace a streamed bubble using its existing message id.
        const replacement=/(?:💭\s*)?\*\*(?:推理|思考|Reasoning|Thinking)[：:]\*\*/i.test(chunk)||(previous.length>100&&chunk.length>previous.length&&chunk.startsWith(previous));
        const message=replacement?publicOutput(chunk):previous+chunk;c.messages.set(key,message);c.output=message;
        c.progress('成员正在生成公开回复','message');
      }
      if(['tool_call','tool_call_update'].includes(type)){c.progress(clean(update.title||update.toolCallId||'工具执行进展',800),'tool');}
      return;
    }
    const key=params.threadId||params.thread?.id,c=this.contexts.get(key);if(!c)return;
    if(method==='turn/started'){c.turnId=params.turn?.id;c.identity(key,c.turnId);}
    if(method==='turn/completed'){const turn=params.turn||{},state=turn.status;if(state==='completed')c.completed({output:c.output||'',sessionId:key,turnId:turn.id});else c.failed(new Problem(clean(turn.error?.message||({interrupted:'执行已中断',failed:'引擎执行失败'}[state])||'执行状态尚未确认'),state==='interrupted'?499:502,state!=='interrupted'&&state!=='failed'));}
    if(method==='item/completed'){
      const item=params.item||{};if(item.type==='agentMessage'&&!['analysis','reasoning'].includes(item.phase)){if(item.phase==='commentary')c.progress(clean(item.text,1200),'message');else c.output=clean(item.text,300000);}
      if(['commandExecution','fileChange','mcpToolCall'].includes(item.type))c.progress(clean(item.command||item.tool||item.type,600),'tool');
    }
    if(method==='item/started'){const item=params.item||{};if(['commandExecution','fileChange','mcpToolCall','webSearch'].includes(item.type))c.progress(clean(item.command||item.tool||item.type,600),'tool');}
    if(method==='turn/plan/updated')c.progress((params.plan||[]).map(p=>(p.status==='completed'?'✓ ':'· ')+p.step).join('\n').slice(0,2000),'plan');
  }
  async run({cwd,prompt,member,sessionId=null,roleInstructions='',readOnly=false,...callbacks}){
    const host=await this.connect(),context={...callbacks,output:'',messages:new Map(),turnId:null},codex=this.engine.kind==='codex';let key=sessionId;
    if(codex){
      if(key)await host.request('thread/resume',{threadId:key,excludeTurns:true});
      else{const response=await host.request('thread/start',{cwd,approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:readOnly?'read-only':'workspace-write',developerInstructions:roleInstructions,...(member.model?{model:member.model}:{})});key=response.thread.id;}
      this.contexts.set(key,context);context.identity(key,null);
      return new Promise((resolve,reject)=>{
        let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;this.contexts.delete(key);fn(value);};context.completed=value=>finish(resolve,value);context.failed=error=>finish(reject,error);
        callbacks.control({stop:async()=>{if(!context.turnId)throw new Problem('执行轮正在创建，请稍后再停止。',409);await host.request('turn/interrupt',{threadId:key,turnId:context.turnId});}});
        host.request('turn/start',{threadId:key,input:[{type:'text',text:prompt}]},45000).then(result=>{if(!settled){context.turnId=result.turn.id;context.identity(key,context.turnId);}}).catch(context.failed);
      });
    }
    let session;
    if(key){const capabilities=this.initialized?.agentCapabilities?.sessionCapabilities;if(capabilities?.resume||this.engine.kind==='dsh')session=await host.request('session/resume',{sessionId:key,cwd,mcpServers:[]},45000);else session=await host.request('session/load',{sessionId:key,cwd,mcpServers:[]},45000);}
    else{session=await host.request('session/new',{cwd,mcpServers:[]},60000);key=session.sessionId;callbacks.catalog?.(sessionModels(session));}
    this.contexts.set(key,context);context.identity(key,key);
    if(member.model){const option=session?.configOptions?.find(o=>o.id==='model'||o.category==='model');try{if(option)await host.request('session/set_config_option',{sessionId:key,configId:option.id,value:member.model});else await host.request('session/set_model',{sessionId:key,modelId:member.model});}catch(error){this.contexts.delete(key);throw new Problem('所选模型不可用：'+error.message,400);}}
    callbacks.control({stop:async()=>host.notify('session/cancel',{sessionId:key})});
    try{const result=await host.request('session/prompt',{sessionId:key,prompt:[{type:'text',text:roleInstructions+'\n\n'+prompt}]},30*60*1000);if(result.stopReason==='cancelled')throw new Problem('执行已中断',499);if(!['end_turn','stop_sequence',undefined].includes(result.stopReason))throw new Problem('执行未完成：'+result.stopReason,422);return{output:publicOutput(context.output),sessionId:key,turnId:key};}finally{this.contexts.delete(key);}
  }
  async close(){await this.host?.close();}
}
