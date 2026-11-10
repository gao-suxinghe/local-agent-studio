import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Problem,clean} from './util.mjs';

const exec=promisify(execFile);
export const KINDS=Object.freeze({codex:'Codex',hermes:'Hermes',dsh:'DeepSeek Harness'});
async function file(value){if(!value||!path.isAbsolute(value)||/[\r\n\0]/.test(value))return null;try{const p=await fs.realpath(value);return(await fs.stat(p)).isFile()?p:null;}catch{return null;}}
export async function discover({env=process.env,home=os.homedir()}={}){
  const candidates={codex:[],hermes:[],dsh:[]};
  for(const kind of Object.keys(candidates))for(const folder of String(env.PATH||'').split(path.delimiter).filter(Boolean))candidates[kind].push(path.join(folder,kind+(process.platform==='win32'?'.exe':'')));
  if(process.platform==='win32'){
    const local=env.LOCALAPPDATA||path.join(home,'AppData/Local');
    const codexBin=path.join(local,'OpenAI/Codex/bin');for(const item of(await fs.readdir(codexBin,{withFileTypes:true}).catch(()=>[])).reverse())if(item.isDirectory())candidates.codex.push(path.join(codexBin,item.name,'codex.exe'));
    candidates.hermes.push(path.join(local,'hermes/bin/hermes.exe'));
    try{
      const script="Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -match '^DeepSeek Harness'} | Select-Object -ExpandProperty InstallLocation | ConvertTo-Json -Compress";
      const info=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10000,maxBuffer:20000});
      const locations=JSON.parse(info.stdout.replace(/^\uFEFF/,''));for(const location of Array.isArray(locations)?locations:[locations])if(typeof location==='string')candidates.dsh.push(path.join(location,'DeepSeek Harness.exe'));
    }catch{}
    for(const root of[path.join(env.APPDATA||path.join(home,'AppData/Roaming'),'npm/node_modules'),path.join(path.dirname(process.execPath),'node_modules')])candidates.dsh.push(path.join(root,'@deepseek-ai/dsh/dist/bin.js'),path.join(root,'@deepseek-ai/dsh/lib/bin.js'));
  }else{
    for(const kind of Object.keys(candidates))for(const root of[path.join(home,'.local/bin'),'/opt/homebrew/bin','/usr/local/bin'])candidates[kind].push(path.join(root,kind));
    candidates.codex.push('/Applications/Codex.app/Contents/Resources/codex');
    candidates.dsh.push('/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness',path.join(home,'Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'));
  }
  const result=[];for(const [kind,list]of Object.entries(candidates)){let executable=null;for(const candidate of list){executable=await file(candidate);if(executable)break;}result.push({kind,label:KINDS[kind],executable,discovered:!!executable});}return result;
}
export async function validatedConfig(input){
  if(!Object.hasOwn(KINDS,input.kind))throw new Problem('请选择支持的引擎。');
  const executable=await file(input.executable);if(!executable)throw new Problem('没有找到这个可执行文件，请选择本机绝对路径。');
  if(/\.(?:cmd|bat|ps1)$/i.test(executable))throw new Problem('请选择原生程序或 Node 的 .js/.mjs 入口，避免通过命令行脚本间接执行。');
  const runtimeHome=input.runtimeHome?await fs.realpath(input.runtimeHome).catch(()=>null):null;
  if(input.runtimeHome&&(!runtimeHome||!(await fs.stat(runtimeHome)).isDirectory()))throw new Problem('引擎配置目录不可用。');
  const catalogRoot=input.catalogRoot?await fs.realpath(input.catalogRoot).catch(()=>null):null;
  if(input.catalogRoot&&(!catalogRoot||!path.isAbsolute(catalogRoot)||!(await fs.stat(catalogRoot)).isDirectory()))throw new Problem('模型检查使用的项目目录不可用。');
  return{kind:input.kind,executable,runtimeHome,catalogRoot,profile:input.kind==='dsh'?String(input.profile||'acp').replace(/[^\w.-]/g,'').slice(0,60):'',nodeExecutable:input.nodeExecutable?await file(input.nodeExecutable):null};
}
export function command(config,mode='run'){
  let args=config.kind==='codex'?(mode==='version'?['--version']:['app-server']):config.kind==='hermes'?(mode==='version'?['--version']:mode==='check'?['acp','--check']:['acp']):(mode==='version'?['--version']:['--profile',config.profile||'acp']);
  const env={};if(config.runtimeHome)env[config.kind==='codex'?'CODEX_HOME':config.kind==='hermes'?'HERMES_HOME':'DSH_HOME']=config.runtimeHome;
  let executable=config.executable;
  if(config.kind==='dsh'&&/^DeepSeek Harness(?:\.exe)?$/i.test(path.basename(executable))){
    const resources=process.platform==='darwin'?path.resolve(path.dirname(executable),'../Resources'):path.join(path.dirname(executable),'resources');
    args=['--expose-internals',path.join(resources,'app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'),...args];env.ELECTRON_RUN_AS_NODE='1';
  }
  if(/\.(?:m?js|cjs)$/i.test(executable)){args=[executable,...args];executable=config.nodeExecutable||process.execPath;if(executable===process.execPath)env.ELECTRON_RUN_AS_NODE='1';}
  return{file:executable,args,env};
}
export async function version(config){const target=command(config,'version');try{const result=await exec(target.file,target.args,{env:{...process.env,...target.env,PYTHONDONTWRITEBYTECODE:'1'},windowsHide:true,timeout:15000,maxBuffer:150000});return clean(result.stdout.trim().split('\n')[0],500);}catch(error){return clean(error.stderr||error.message,500);}}
