import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

export const VERSION='0.1.1', APP_ID='agent-office-studio';
export class Problem extends Error {constructor(message,status=400,uncertain=false){super(message);this.status=status;this.uncertain=uncertain;}}
export const id=prefix=>prefix+'_'+crypto.randomUUID();
export const stamp=()=>Date.now();
export function integer(value,fallback,min,max){const result=Number(value??fallback);if(!Number.isInteger(result)||result<min||result>max)throw new Problem('数字超出支持范围，请检查后重试。');return result;}
export function clean(value,max=12000){return String(value??'').replace(/\bBearer\s+[\w.~+/=-]+/gi,'Bearer [已隐藏]').replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|authorization)[\s"']*[:=：]\s*["']?[^\s"',;<>]+/gi,'$1: [已隐藏]').replace(/\bsk-[A-Za-z0-9_-]{12,}/g,'[已隐藏]').slice(0,max);}
export function string(value,max=10000,required=false){if(typeof value!=='string'){if(required)throw new Problem('请填写完整内容。');return '';}const result=value.replaceAll('\0','').trim();if(result.length>max)throw new Problem('内容超过长度限制。');if(required&&!result)throw new Problem('请填写完整内容。');return result;}
export const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
export function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
export function dataDirectory(env=process.env){if(env.AGENT_STUDIO_DATA_DIR)return path.resolve(env.AGENT_STUDIO_DATA_DIR);return process.platform==='win32'?path.join(env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'AgentOfficeStudio'):process.platform==='darwin'?path.join(os.homedir(),'Library/Application Support/AgentOfficeStudio'):path.join(env.XDG_DATA_HOME||path.join(os.homedir(),'.local/share'),'agent-office-studio');}
export async function directory(value){if(!path.isAbsolute(value||''))throw new Problem('请选择绝对路径的本机项目目录。');const resolved=await fs.realpath(value).catch(()=>null);if(!resolved||!(await fs.stat(resolved)).isDirectory())throw new Problem('这个项目目录不存在或无法读取。');if(resolved===path.parse(resolved).root)throw new Problem('请选择具体的项目文件夹。');return resolved;}
export function within(root,target){const relative=path.relative(root,target);return !relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
export async function writeAtomic(file,data){await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';await fs.writeFile(temp,data,{mode:0o600});await fs.rename(temp,file);}
export function publicOutput(value){return clean(String(value||'').replace(/<(think|analysis|reasoning)>[\s\S]*?<\/\1>/gi,'').replace(/<(think|analysis|reasoning)>[\s\S]*$/gi,'').replace(/(?:💭\s*)?\*\*(?:推理|思考|Reasoning|Thinking)[：:]\*\*\s*\n?```[^\n]*\n[\s\S]*?```\s*/gi,'').replace(/(?:💭\s*)?\*\*(?:推理|思考|Reasoning|Thinking)[：:]\*\*[\s\S]*$/gi,''),300000).trim();}
export function jsonOutput(value){
  const text=publicOutput(value),results=[];
  try{return JSON.parse(text);}catch{}
  let start=-1,depth=0,quoted=false,escape=false;
  for(let index=0;index<text.length;index++){
    const ch=text[index];if(start<0){if(ch==='{'){start=index;depth=1;quoted=false;escape=false;}continue;}
    if(quoted){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')quoted=false;continue;}
    if(ch==='"')quoted=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){try{results.push(JSON.parse(text.slice(start,index+1)));}catch{}start=-1;}
  }
  const unique=new Map(results.map(result=>[stable(result),result]));if(unique.size===1)return unique.values().next().value;
  throw new Problem(unique.size?'成员返回了多个不同版本的结果，请核对后处理。':'成员没有返回约定的结构化结果，请查看原始输出后处理。',422);
}
export function assertOperation(value){if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{12,100}$/.test(value))throw new Problem('操作编号无效，请刷新重试。');return value;}
