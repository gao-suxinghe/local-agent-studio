const {contextBridge,ipcRenderer}=require('electron');
const ALLOWED=new Set(['office','projects','board','ideas','members','inbox','connections','new-task','settings','refresh']);
contextBridge.exposeInMainWorld('studioDesktop',{chooseFolder:()=>ipcRenderer.invoke('studio:choose-folder'),chooseEngine:()=>ipcRenderer.invoke('studio:choose-engine')});
window.addEventListener('DOMContentLoaded',()=>{document.getElementById('retry')?.addEventListener('click',()=>ipcRenderer.send('studio:retry'));});
ipcRenderer.on('studio:status',(_event,message)=>{const node=document.getElementById('loading-status');if(node)node.textContent=String(message).slice(0,1500);});
ipcRenderer.on('studio:menu',(_event,action)=>{if(ALLOWED.has(action))window.dispatchEvent(new CustomEvent('studio-menu',{detail:action}));});
