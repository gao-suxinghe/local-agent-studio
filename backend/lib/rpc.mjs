import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {clean,Problem} from './util.mjs';

export class RpcHost extends EventEmitter {
  constructor(command,{cwd,env=process.env,codex=false}={}){
    super();this.sequence=0;this.pending=new Map();this.buffer='';this.stderr='';this.closed=false;this.codex=codex;this.requestHandler=null;
    this.child=spawn(command.file,command.args||[],{cwd,env:{...env,...command.env,PYTHONDONTWRITEBYTECODE:'1'},shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stdout.setEncoding('utf8');this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data',chunk=>{this.buffer+=chunk;if(this.buffer.length>8_000_000){this.fail(new Error('引擎响应过大。'));this.child.kill();return;}let at;while((at=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,at).trim();this.buffer=this.buffer.slice(at+1);if(!line)continue;try{this.message(JSON.parse(line));}catch{ /* runtime banners are not protocol frames */ }}});
    this.child.stderr.on('data',chunk=>{this.stderr=clean(this.stderr+chunk,12000).slice(-12000);});
    this.child.on('error',error=>this.fail(error));this.child.on('exit',(code,signal)=>this.fail(new Error('引擎连接已结束 '+(code??signal??'')+(this.stderr?'：'+this.stderr.slice(-1200):''))));
    this.child.stdin.on('error',()=>{});
  }
  send(value){if(this.closed||this.child.stdin.destroyed)throw new Problem('引擎连接已断开。',503,true);this.child.stdin.write(JSON.stringify(this.codex?value:{jsonrpc:'2.0',...value})+'\n');}
  request(method,params={},timeout=30000){return new Promise((resolve,reject)=>{const key=++this.sequence;const timer=setTimeout(()=>{this.pending.delete(key);reject(new Problem('引擎响应超时，请核对执行状态。',504,true));},timeout);timer.unref?.();this.pending.set(key,{resolve,reject,timer});try{this.send({id:key,method,params});}catch(error){clearTimeout(timer);this.pending.delete(key);reject(error);}});}
  notify(method,params={}){this.send({method,params});}
  async message(frame){
    if(frame.method&&Object.hasOwn(frame,'id')){
      try{if(!this.requestHandler)throw new Error('此交互暂不支持。');const result=await this.requestHandler(frame.method,frame.params||{},frame.id);this.send({id:frame.id,result});}
      catch(error){try{this.send({id:frame.id,error:{code:-32601,message:clean(error.message,800)}});}catch{}}
    }else if(Object.hasOwn(frame,'id')){const pending=this.pending.get(frame.id);if(pending){clearTimeout(pending.timer);this.pending.delete(frame.id);if(frame.error){const detail=frame.error.data?.details;pending.reject(new Problem(clean((frame.error.message||'引擎请求失败')+(typeof detail==='string'?'：'+detail:''),2000),502));}else pending.resolve(frame.result);}}
    else if(frame.method)this.emit('notification',frame.method,frame.params||{});
  }
  fail(error){if(this.closed)return;this.closed=true;for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Problem(clean(error.message,2000),503,true));}this.pending.clear();this.emit('disconnect',error);}
  async close(){if(!this.closed){try{this.child.stdin.end();}catch{}await Promise.race([new Promise(resolve=>this.child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,800))]);if(this.child.exitCode===null)this.child.kill();this.fail(new Error('连接已关闭。'));}}
}
