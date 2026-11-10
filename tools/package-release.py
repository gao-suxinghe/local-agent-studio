from pathlib import Path
import hashlib,json,os,shutil,stat,struct,sys,zipfile

root=Path(__file__).resolve().parents[1]
version=json.loads((root/'app/package.json').read_text('utf-8'))['version']
out=Path(os.environ.get('STUDIO_RELEASE_OUT',root/'release'));out.mkdir(parents=True,exist_ok=True)

def copy_project_notices(folder):
    shutil.copy2(root/'LICENSE',folder/'LICENSE-STUDIO.txt')
    shutil.copy2(root/'THIRD_PARTY_NOTICES.md',folder/'THIRD_PARTY_NOTICES.md')

def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def archive(folder,target,prefix):
 links=0
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for directory,dirs,files in os.walk(folder,followlinks=False):
   for name in dirs[:]:
    p=Path(directory)/name
    if p.is_symlink():
     dirs.remove(name);info=zipfile.ZipInfo(prefix+'/'+p.relative_to(folder).as_posix());info.create_system=3;info.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(info,os.readlink(p));links+=1
   for name in files:
    p=Path(directory)/name;relative=prefix+'/'+p.relative_to(folder).as_posix()
    if p.is_symlink():
     info=zipfile.ZipInfo(relative);info.create_system=3;info.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(info,os.readlink(p));links+=1
    else:z.write(p,relative)
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None
 return {'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target),'symlinks':links}

mode=sys.argv[1] if len(sys.argv)>1 else 'windows'
if mode=='windows':
 payload=Path(os.environ.get('STUDIO_BUILD_OUT',root/'dist'))/'本机工作室-win32-x64';marker=json.loads((payload/'studio-build.json').read_text())
 assert marker['id']=='local.agentoffice.studio' and marker['version']==version
 binary=(payload/'AgentOfficeStudio.exe').read_bytes();offset=struct.unpack_from('<I',binary,0x3c)[0];assert binary[offset:offset+4]==b'PE\0\0' and struct.unpack_from('<H',binary,offset+4)[0]==0x8664
 kit=out/'Windows安装目录';kit.mkdir(exist_ok=True)
 target=kit/'payload/本机工作室-win32-x64'
 if target.exists():raise RuntimeError('The release payload already exists; preserve and inspect it before repackaging.')
 shutil.copytree(payload,target)
 for name in ['install-windows.ps1','安装Windows客户端.cmd']:
  text=(root/'tools'/name).read_text('utf-8-sig').replace('\r\n','\n').replace('\n','\r\n')
  (kit/name).write_bytes(text.encode('utf-8-sig' if name.endswith('.ps1') else 'utf-8'))
 (kit/'先读我.txt').write_bytes((f'本机工作室 {version} · Windows x64\r\n\r\n完整解压，运行“安装Windows客户端.cmd”，随后双击桌面“本机工作室”。\r\n升级时请先在设置中结束本机后台，再关闭窗口。\r\n独立客户端自带 Node 和数据库组件；准备好自己的本机引擎与模型登录即可。\r\n与办公室 0.8.0 独立安装，使用不同的数据目录和桌面入口。\r\n使用方法见“使用与接入说明.txt”。\r\n').encode('utf-8-sig'))
 shutil.copy2(root/'docs/使用与接入说明.txt',kit/'使用与接入说明.txt')
 copy_project_notices(kit)
 result=archive(kit,out/f'本机工作室-Windows-x64-{version}.zip','本机工作室')
 (out/'windows-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(result,ensure_ascii=False))
elif mode=='source':
 selected=[]
 for name in ['package.json','package-lock.json','README.md','LICENSE','THIRD_PARTY_NOTICES.md','.gitignore','.gitattributes']:selected.append(root/name)
 for folder in ['app','backend','tools','tests','docs']:
  selected.extend(p for p in (root/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix not in {'.pyc','.log','.sqlite','.jsonl'})
 target=out/f'本机工作室-源码-{version}.zip'
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in selected:z.write(p,'local-agent-studio/'+p.relative_to(root).as_posix())
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None
  assert not any('/work/' in name or '/node_modules/' in name or name.endswith(('service.json','studio.sqlite')) for name in z.namelist())
 print(json.dumps({'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target),'entries':len(selected)},ensure_ascii=False))
elif mode=='mac':
 build=Path(sys.argv[2]);target_out=Path(sys.argv[3]);target_out.mkdir(parents=True,exist_ok=True);results=[]
 for arch,cpu in [('arm64',0x100000c),('x64',0x1000007)]:
  folder=build/('本机工作室-darwin-'+arch);app=folder/'本机工作室.app'
  assert struct.unpack('<I',(app/'Contents/MacOS/AgentOfficeStudio').read_bytes()[4:8])[0]==cpu
  marker=json.loads((app/'Contents/Resources/studio-build.json').read_text())
  assert marker['id']=='local.agentoffice.studio' and marker['version']==version
  installer=folder/'安装Mac客户端.command';installer.write_bytes((root/'tools/安装Mac客户端.command').read_text('utf-8-sig').replace('\r\n','\n').encode('utf-8'));installer.chmod(0o755)
  shutil.copy2(root/'docs/使用与接入说明.txt',folder/'使用与接入说明.txt')
  copy_project_notices(folder)
  (folder/'先读我.txt').write_text(f'本机工作室 {version} · Mac 预览版\n\n完整解压，运行“安装Mac客户端.command”。\n应用安装在 ~/Applications/本机工作室.app；与办公室旧版独立。\n升级时请先在设置中结束本机后台，再关闭窗口。\n客户端自带 Node 和数据库组件，使用者自行准备引擎及其登录。\n\nMac 包由 Linux 交叉打包，已检查架构、资源和归档。尚未完成 Mac 真机启动、正式签名公证及三引擎协作验收。\n安装器会进行本机临时签名，系统来源验证按 macOS 正常流程处理。\n','utf-8')
  info=archive(folder,target_out/f'本机工作室-macOS-{arch}-{version}-预览.zip','本机工作室');info['macNativeTested']=False;assert info['symlinks']>=14;results.append(info)
 (target_out/'mac-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(results,ensure_ascii=False))
