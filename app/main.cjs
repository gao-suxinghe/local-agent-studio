const {app,BrowserWindow,Menu,dialog,shell,ipcMain,screen}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const runtime=require('./runtime.cjs');
app.setName('本机工作室');
const option=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const profile=path.resolve(option('--profile-dir')||path.join(app.getPath('appData'),'AgentOfficeStudio'));fs.mkdirSync(profile,{recursive:true,mode:0o700});app.setPath('userData',profile);if(process.platform==='win32')app.setAppUserModelId('local.agentoffice.studio');
const singleton=app.requestSingleInstanceLock();
if(!singleton)app.quit();else{
  let window,service,connecting=false;const loading=path.join(__dirname,'loading.html'),backendRoot=app.isPackaged?path.join(process.resourcesPath,'backend'):path.join(__dirname,'../backend');
  const helperName=process.platform==='win32'?'register-agent.cmd':'register-agent.command';
  const helper=app.isPackaged
    ? process.platform==='win32'
      ? path.join(path.dirname(process.execPath),helperName)
      : path.join(process.resourcesPath,'tools',helperName)
    : path.join(__dirname,'../tools',helperName);
  const trusted=event=>window&&event.sender===window.webContents&&service&&event.senderFrame?.url?.startsWith(service.baseUrl+'/');
  const fromLoader=event=>window&&event.sender===window.webContents&&event.senderFrame?.url===pathToFileURL(loading).href;
  const send=action=>window?.webContents.send('studio:menu',action);
  async function bootstrap(){if(connecting||!window)return;connecting=true;try{service=await runtime.connect({backendRoot,dataRoot:option('--data-dir')||runtime.rootDirectory(),helper,onStatus:message=>window?.webContents.send('studio:status',message)});await window.loadURL(service.url);}catch(error){window?.webContents.send('studio:status',error.message);}finally{connecting=false;}}
  async function create(){if(window){window.show();window.focus();return;}const area=screen.getPrimaryDisplay().workAreaSize;window=new BrowserWindow({width:Math.min(area.width,1580),height:Math.min(area.height,1020),minWidth:960,minHeight:680,show:false,title:'本机工作室',backgroundColor:'#f5f6f7',icon:path.join(__dirname,'icons/office.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
    const contents=window.webContents;contents.setWindowOpenHandler(()=>({action:'deny'}));contents.on('will-attach-webview',e=>e.preventDefault());
    const internal=url=>url===pathToFileURL(loading).href||service&&(()=>{try{const u=new URL(url);return u.origin===service.baseUrl&&['/','/index.html'].includes(u.pathname)&&!u.username&&!u.password;}catch{return false;}})();
    contents.on('will-navigate',(event,url)=>{if(!internal(url))event.preventDefault();});contents.on('will-redirect',(event,url)=>{if(!internal(url))event.preventDefault();});
    contents.session.setPermissionRequestHandler((_c,permission,callback)=>callback(permission==='clipboard-sanitized-write'));contents.session.setPermissionCheckHandler((_c,permission,origin)=>permission==='clipboard-sanitized-write'&&service&&origin===service.baseUrl);
    contents.on('page-title-updated',(_event,title)=>window?.setTitle(title));window.once('ready-to-show',()=>window?.show());window.on('closed',()=>window=null);await window.loadFile(loading);await bootstrap();
  }
  ipcMain.on('studio:retry',event=>{if(fromLoader(event))void bootstrap();});
  ipcMain.handle('studio:choose-folder',async event=>{if(!trusted(event))return null;const result=await dialog.showOpenDialog(window,{title:'选择本机项目目录',properties:['openDirectory']});return result.canceled?null:result.filePaths[0];});
  ipcMain.handle('studio:choose-engine',async event=>{if(!trusted(event))return null;const result=await dialog.showOpenDialog(window,{title:'选择本机引擎程序或 Node 入口',properties:['openFile']});return result.canceled?null:result.filePaths[0];});
  app.on('second-instance',create);app.on('activate',create);app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
  app.whenReady().then(()=>{
    const menu=[];if(process.platform==='darwin')menu.push({label:'本机工作室',submenu:[{role:'about',label:'关于本机工作室'},{type:'separator'},{role:'hide',label:'隐藏工作室'},{role:'quit',label:'退出客户端'}]});
    menu.push({label:'文件',submenu:[{label:'新建任务',accelerator:'CmdOrCtrl+N',click:()=>send('new-task')},{label:'工作室设置',click:()=>send('settings')},{type:'separator'},{role:'quit',label:'退出客户端'}]},
      {label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
      {label:'工作空间',submenu:Object.entries({office:'办公室',projects:'项目工作台',board:'任务看板',ideas:'草稿箱',members:'团队成员',inbox:'待我处理',connections:'接入中心'}).map(([action,label])=>({label,click:()=>send(action)})).concat([{type:'separator'},{label:'刷新',accelerator:'CmdOrCtrl+R',click:()=>send('refresh')},{role:'togglefullscreen',label:'全屏'}])},
      {label:'帮助',submenu:[{label:'打开独立数据目录',click:()=>shell.openPath(service?.dataRoot||runtime.rootDirectory())},{label:'关于本机工作室',click:()=>dialog.showMessageBox(window,{title:'本机工作室',message:'本机工作室 '+app.getVersion(),detail:'个人多 Agent 项目团队。与办公室 0.8.0 分开安装和保存数据。关闭窗口后，后台按当前派发设置继续运行。'})}]});
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));void create();
  });
}
