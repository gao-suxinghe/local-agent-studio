import fs from 'node:fs/promises';
import {discover} from '../backend/lib/discovery.mjs';

const option=key=>{const index=process.argv.indexOf(key);return index<0?null:process.argv[index+1];};
try{
  const encoded=option('--invitation');if(!encoded)throw new Error('请使用客户端生成的接入命令。');
  const invite=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')),url=new URL(invite.baseUrl);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/')throw new Error('邀请必须指向本机工作室。');
  if(invite.expires<Date.now())throw new Error('邀请已经过期，请重新生成。');
  const candidates=await discover(),executable=option('--executable')||candidates.find(c=>c.kind===invite.kind)?.executable;
  if(!executable)throw new Error('未发现本机 '+invite.kind+' 入口。请在接入中心选择本机程序，或追加 --executable 绝对路径。');
  const response=await fetch(new URL('/api/pair',url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({secret:invite.secret,kind:invite.kind,executable,name:invite.name,catalogRoot:process.cwd(),runtimeHome:option('--runtime-home')||undefined,profile:option('--profile')||undefined}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'注册失败');
  process.stdout.write('成员已注册，正在核对本机接口…\n');
  const check=await fetch(new URL('/api/pair/verify',url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({secret:invite.secret}),signal:AbortSignal.timeout(120000)});
  const verified=await check.json();if(!check.ok)throw new Error(verified.error||'连接检查失败');
  process.stdout.write(JSON.stringify({...verified,message:verified.connection==='connected'?'成员已自动连接，可以在客户端加入项目团队。':'成员已注册；请按连接诊断补充配置。'},null,2)+'\n');
}catch(error){process.stderr.write(String(error.message)+'\n');process.exitCode=1;}
