import {renderOffice,updateOfficeActivity,setOfficeCamera,resetOfficeCamera,setOfficeZone} from './scene.js';
import {normalizeAppearance} from './scene-config.js';

const $=id=>document.getElementById(id),roles={manager:'项目经理',executor:'执行成员',reviewer:'复核成员'},engineNames={codex:'Codex',hermes:'Hermes',dsh:'DeepSeek Harness'};
const labels={draft:'草稿',idle:'空闲待命',ready:'待执行',running:'执行中',starting:'正在启动',review_ready:'待复核',reviewing:'复核中',submitted:'待你验收',verified:'复核通过',done:'已完成',blocked:'需要处理',uncertain:'待核对',unknown:'待核对',cancelled:'已中断',failed:'执行失败',waiting_approval:'等待处理',stopping:'正在停止',completed:'已完成',pending:'待确认',connected:'已连接',unverified:'未检查',checking:'正在检查',error:'连接异常',paused:'已暂停',active:'进行中'};
const active=new Set(['starting','running','waiting_approval','stopping']);
const state={data:null,view:'office',project:'all',query:'',detail:null,sceneSignature:'',seatPage:0,zone:'all',projectTab:'tasks',candidates:[],draftTrash:false,modalHandler:null};
let boardDrag=null,snapshotSignature='';
const paths={office:'M3 20V9l9-5 9 5v11M7 20v-7h10v7M10 13V9h4v4',project:'M3 7h7l2 2h9v11H3ZM3 7V4h7l2 3',board:'M4 4h16v16H4ZM9 4v16M15 4v16M6 8h1M11 11h2M17 8h1',note:'M5 3h14v18H5ZM8 8h8M8 12h8M8 16h5',team:'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-3a7 7 0 0 1 14 0v3M3 7a2 2 0 0 1 2-2M21 7a2 2 0 0 0-2-2',inbox:'M4 4h16l2 12v4H2v-4ZM2 16h6l2 2h4l2-2h6',plug:'M8 3v6M16 3v6M6 9h12v3a6 6 0 0 1-12 0ZM12 18v4',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',refresh:'M20 10a8 8 0 1 0 0 5M20 3v7h-7',search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM15 15l6 6',plus:'M12 4v16M4 12h16',check:'m5 12 4 4L20 5',arrow:'M4 12h16m-5-5 5 5-5 5'};
function symbol(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','symbol');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.project);svg.append(p);return svg;}
for(const node of document.querySelectorAll('[data-symbol]'))node.append(symbol(node.dataset.symbol));
function el(tag,props={},...children){const node=document.createElement(tag);for(const[key,value]of Object.entries(props)){if(key==='text')node.textContent=value;else if(key==='class')node.className=value;else if(key.startsWith('on'))node.addEventListener(key.slice(2),value);else if(['checked','disabled','hidden','required','selected'].includes(key))node[key]=!!value;else if(value!==undefined&&value!==null)node.setAttribute(key,String(value));}for(const child of children.flat())if(child!==null&&child!==undefined&&child!==false)node.append(typeof child==='string'?document.createTextNode(child):child);return node;}
const all=key=>state.data?.[key]||[],byId=(kind,id)=>all(kind).find(item=>item.id===id),projectName=id=>byId('projects',id)?.name||'未分配项目',memberName=id=>byId('members',id)?.name||'待分配',engineOf=member=>byId('engines',member.engineId),scope=items=>state.project==='all'?items:items.filter(item=>item.projectId===state.project),when=value=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'暂无记录';
function relative(value){const age=Math.max(0,Date.now()-value);return age<60000?'刚刚':age<3600000?Math.floor(age/60000)+' 分钟前':age<86400000?Math.floor(age/3600000)+' 小时前':new Date(value).toLocaleDateString('zh-CN');}
function button(text,fn,style='',icon=null){return el('button',{type:'button',class:'studio-button '+style,onclick:event=>act(event.currentTarget,fn)},icon?symbol(icon):null,text);}
const tag=(value,text)=>el('span',{class:'tag '+value,text:text||labels[value]||value});
const avatar=member=>el('span',{class:'avatar-mark b'+((member?.avatar||0)%4),text:member?.name?.slice(0,1)||'·'});
function empty(title,text,action){return el('div',{class:'empty-state center'},symbol('project'),el('h3',{text:title}),el('p',{text}),action);}
function toast(message,error=false){const node=el('div',{class:'studio-toast'+(error?' error':''),text:message});$('toast-region').append(node);setTimeout(()=>node.remove(),6500);}
async function act(node,fn){if(node)node.disabled=true;try{await fn();}catch(error){toast(error.message,true);}finally{if(node?.isConnected)node.disabled=false;}}
async function api(route,options={}){let response;try{response=await fetch('/api'+route,{credentials:'same-origin',cache:'no-store',...options,headers:{'content-type':'application/json','x-studio-action':'1',...options.headers}});}catch{const error=new Error('本机连接暂时中断，请先刷新核对操作结果。');error.uncertain=!!options.method;throw error;}const result=await response.json();if(!response.ok){const error=new Error(result.error||'操作没有完成。');error.uncertain=result.uncertain;throw error;}return result;}
async function post(route,body={}){const result=await api(route,{method:'POST',body:JSON.stringify({...body,operationId:crypto.randomUUID()})});await refresh();return result;}
async function refresh(){const data=await api('/state');apply(data);}
function navigate(view,project){finishBoardDrag();if(view!=='office')document.body.classList.remove('full-scene');if(project!==undefined)state.project=project;state.view=view;state.sceneSignature='';state.seatPage=0;render();}
function taskFilter(){const q=state.query.toLowerCase();return scope(all('tasks')).filter(t=>!q||[t.title,t.description,memberName(t.memberId),projectName(t.projectId)].some(s=>String(s).toLowerCase().includes(q)));}
function inboxItems(){return[...scope(all('approvals')).filter(a=>a.state==='pending').map(a=>({...a,inboxType:'approval'})),...scope(all('plans')).filter(a=>a.state==='pending').map(a=>({...a,inboxType:'plan',title:'确认项目计划'})),...scope(all('tasks')).filter(a=>['submitted','uncertain','blocked'].includes(a.state)).map(a=>({...a,inboxType:'task'})),...all('projects').filter(p=>(state.project==='all'||p.id===state.project)&&p.status!=='completed'&&all('tasks').some(t=>t.projectId===p.id)&&all('tasks').filter(t=>t.projectId===p.id).every(t=>['verified','done'].includes(t.state))).map(p=>({...p,projectId:p.id,inboxType:'acceptance',title:'验收项目：'+p.name}))];}
function apply(data){
  const {generatedAt,revision,...content}=data;
  if(state.data&&generatedAt<state.data.generatedAt)return;
  const signature=JSON.stringify(content);
  state.data=data;
  $('service-dot').className='online';
  $('service-label').textContent='本机工作室已连接';
  $('sync-label').textContent='已同步 '+new Date().toLocaleTimeString('zh-CN',{hour12:false});
  if(signature===snapshotSignature)return;
  snapshotSignature=signature;
  render();
}
function render(){
  if(!state.data||boardDrag)return;document.body.classList.toggle('studio-office',state.view==='office');if(state.project!=='all'&&!byId('projects',state.project))state.project='all';
  document.title=state.data.settings.officeName+' · 本机工作室';$('scope-name').textContent=state.project==='all'?'全部项目':projectName(state.project);
  for(const node of document.querySelectorAll('[data-view]')){node.classList.toggle('selected',node.dataset.view===state.view);node.setAttribute('aria-current',node.dataset.view===state.view?'page':'false');}
  const ideas=all('ideas').filter(i=>!i.deleted&&!i.promotedTaskId);$('idea-count').textContent=ideas.length||'';$('inbox-count').textContent=inboxItems().length||'';$('engine-health').classList.toggle('online',all('engines').some(e=>e.status==='connected'));
  $('project-nav').replaceChildren(el('button',{class:'project-link'+(state.project==='all'?' selected':''),onclick:()=>navigate(state.view,'all')},el('span',{text:'▦'}),el('span',{class:'project-name',text:'全部项目'}),el('small',{text:all('projects').length})),...all('projects').map(p=>el('button',{class:'project-link'+(state.project===p.id?' selected':''),onclick:()=>navigate('projects',p.id)},el('span',{text:p.name.slice(0,1)}),el('span',{class:'project-name',text:p.name}),el('small',{text:all('tasks').filter(t=>t.projectId===p.id).length}))));
  const titles={office:state.data.settings.officeName,projects:state.project==='all'?'项目工作台':projectName(state.project),board:'任务看板',ideas:'草稿箱',members:'团队成员',inbox:'待我处理',connections:'接入中心'};
  const descriptions={office:'给成员分工，让真实进展在办公室里流动。',projects:'从明确的目标开始，按计划交付，按证据验收。',board:'任务按依赖推进，执行、交接和复核都留有记录。',ideas:'先把想法放下来，准备好后再交给团队。',members:'每位成员保留自己的引擎和配置，按项目承担职责。',inbox:'计划、问题、工具授权和成果验收，在这里汇合。',connections:'连接当前电脑上的 Codex、Hermes 和 DeepSeek Harness。'};
  $('page-title').textContent=titles[state.view];$('page-description').textContent=descriptions[state.view];$('page-eyebrow').textContent=state.project==='all'?'我的本机工作空间':projectName(state.project);
  const tasks=taskFilter(),counts=[['正在执行',scope(all('runs')).filter(r=>active.has(r.state)).length,'blue','board'],['待你处理',inboxItems().length,'amber','inbox'],['待执行',tasks.filter(t=>['ready','review_ready'].includes(t.state)).length,'','board'],['复核通过',tasks.filter(t=>['verified','done'].includes(t.state)).length,'','board']];
  $('summary-strip').replaceChildren(...counts.map(([name,count,color,view])=>el('button',{class:'summary-item',onclick:()=>navigate(view)},el('i',{class:'status-dot '+color}),el('span',{text:name}),el('strong',{text:count}))),el('span',{class:'summary-tail',text:all('members').filter(m=>m.enabled).length+' 位成员 · '+all('engines').filter(e=>e.status==='connected').length+' 个引擎已连接'}));
  $('coverage').textContent=`${all('projects').length} 个本机项目 · ${all('members').length} 位成员 · ${all('tasks').length} 项任务`;
  if(!$('editor').open){({office:renderOfficeView,projects:renderProjects,board:renderBoard,ideas:renderIdeas,members:renderMembers,inbox:renderInbox,connections:renderConnections}[state.view])();if(state.detail)renderDetail();}
}

function renderOfficeView(){
  let scene=$('office-canvas');if(!scene){$('view-root').replaceChildren(el('div',{class:'office-layout'},el('section',{class:'scene-panel'},el('div',{class:'scene-toolbar'},el('div',{class:'scene-caption'},el('i',{class:'status-dot'}),el('span',{text:'成员工位 · 实时项目动态'})),el('div',{class:'zone-tabs'},...Object.entries({all:'空间总览',work:'主办公区',boss:'老板办公室',leisure:'休闲区'}).map(([id,name])=>el('button',{class:id===state.zone?'selected':'',text:name,'data-zone':id,onclick:()=>{state.zone=id;setOfficeZone($('office-canvas'),id);for(const n of document.querySelectorAll('[data-zone]'))n.classList.toggle('selected',n.dataset.zone===id);}})))),el('div',{id:'office-canvas',class:'scene-canvas'}),el('div',{class:'scene-footer'},el('span',{id:'seat-status'}),el('span',{text:'拖动浏览 · 滚轮缩放 · 点击成员查看工作'}),el('div',{class:'scene-tools'},button('‹',()=>{state.seatPage=Math.max(0,state.seatPage-1);state.sceneSignature='';render();},'small'),button('›',()=>{state.seatPage++;state.sceneSignature='';render();},'small'),button('复位',()=>resetOfficeCamera($('office-canvas')),'small'),button('专注',()=>{const focused=document.body.classList.toggle('full-scene');const control=document.querySelector('.focus-button');if(control){control.textContent=focused?'返回工作台':'专注';control.setAttribute('aria-pressed',String(focused));}},'small focus-button')))),el('aside',{id:'office-activity',class:'studio-activity'})));scene=$('office-canvas');state.sceneSignature='';}
  const assignments=scope(all('assignments')),members=all('members').filter(m=>state.project==='all'||assignments.some(a=>a.memberId===m.id)),pages=Math.max(1,Math.ceil(members.length/8));state.seatPage=Math.min(state.seatPage,pages-1);
  const seats=members.slice(state.seatPage*8,state.seatPage*8+8).map(member=>{const run=all('runs').find(r=>r.memberId===member.id&&active.has(r.state)),engine=engineOf(member),task=run?.taskId?byId('tasks',run.taskId):null;return{id:'member:'+member.id,memberId:member.id,title:member.name,projectId:run?.projectId,runState:run?(run.state==='waiting_approval'?'waiting_approval':run.state==='stopping'?'stopping':'active'):member.enabled&&engine?.status==='connected'?'idle':'unknown',latestProgress:run?(task?.title||'整理项目计划')+' · '+run.progress:!member.enabled?'成员已暂停':engine?.status==='connected'?'已连接，等待团队任务':'请检查引擎连接',stateEvidence:run?.progress||engine?.lastError||'本机连接状态',createdAt:member.createdAt,runtime:{active:!!run,owned:!!run},boardLane:run?'processing':'done'};});
  const appearance=normalizeAppearance({...state.data.settings.appearance,officeName:state.data.settings.officeName,bossName:state.data.settings.bossName}),signature=JSON.stringify([seats.map(s=>s.id),appearance,state.project]);
  if(signature!==state.sceneSignature){state.sceneSignature=signature;renderOffice(scene,seats,labels,t=>t.memberId?openMember(t.memberId):navigate('ideas'),{appearance,onDrafts:()=>navigate('ideas'),onReviews:()=>navigate('inbox')});if(state.zone!=='all')setOfficeZone(scene,state.zone);}
  const tasks=taskFilter(),drafts=scope(all('ideas')).filter(i=>!i.deleted&&!i.promotedTaskId).map(i=>({...i,title:i.title,runState:'draft'})),reviews=inboxItems(),events=scope(all('events'));
  updateOfficeActivity(scene,seats,{appearance,counts:{processing:scope(all('runs')).filter(r=>active.has(r.state)).length,attention:reviews.length,draft:drafts.length,todo:tasks.filter(t=>['ready','review_ready'].includes(t.state)).length,done:tasks.filter(t=>['verified','done'].includes(t.state)).length,unverified:tasks.filter(t=>t.state==='uncertain').length},drafts,reviews,flows:events.slice(0,8).map(e=>({id:String(e.id),taskId:e.memberId?'member:'+e.memberId:null,title:e.message,type:['start','handoff','approval','plan_ready','acceptance'].includes(e.type)?e.type==='approval'?'review':e.type==='handoff'?'complete':e.type==='plan_ready'?'review':e.type==='acceptance'?'complete':'start':'progress',label:e.message,at:e.at})),stale:false});
  $('seat-status').textContent=members.length?`${state.seatPage+1} / ${pages} 页 · ${members.length} 位成员`:'等待第一位成员加入';
  const inbox=el('section',{class:'activity-section'},el('div',{class:'section-title'},el('h2',{text:'老板的待办'}),el('button',{class:'text-action',text:'查看全部',onclick:()=>navigate('inbox')})));
  const feed=el('section',{class:'activity-section'},el('div',{class:'section-title'},el('h2',{text:'最近的协作'}),el('span',{text:'本机记录'})));
  const queue=el('section',{class:'activity-section'},el('div',{class:'section-title'},el('h2',{text:'下一步工作'}),el('span',{text:'按依赖派发'})));
  if(!reviews.length)inbox.append(el('p',{class:'empty-mini',text:'需要你确认的计划、问题和成果，会出现在这里。'}));else for(const item of reviews.slice(0,3))inbox.append(activity(item.title||item.name,projectName(item.projectId),()=>openInbox(item)));
  if(!events.length)feed.append(el('p',{class:'empty-mini',text:'从接入一位成员、建立一个项目开始。'}));else for(const event of events.slice(0,5))feed.append(activity(event.message,relative(event.at),()=>event.taskId?openTask(event.taskId):navigate('projects',event.projectId||'all')));
  const next=tasks.filter(t=>['ready','review_ready'].includes(t.state));if(!next.length)queue.append(el('p',{class:'empty-mini',text:'想法可以先放在草稿箱，准备好后再安排给团队。'}));else for(const task of next.slice(0,3))queue.append(activity(task.title,memberName(task.phase==='review'?task.reviewerId:task.memberId),()=>openTask(task.id)));
  queue.append(el('div',{class:'dispatch-controls'},el('label',{class:'switch-label'},el('input',{type:'checkbox',checked:state.data.settings.autoDispatch,onchange:e=>act(e.target,()=>post('/dispatch',{enabled:e.target.checked}))}),'自动派发'),button('安排任务',()=>editTask(),'small')));$('office-activity').replaceChildren(inbox,feed,queue);
}
function activity(title,meta,fn){return el('button',{class:'activity-item',onclick:fn},el('div',{class:'activity-meta'},el('span',{text:meta})),el('strong',{text:title}));}

function renderProjects(){
  if(state.project==='all'){
    const projects=all('projects').filter(p=>!state.query||[p.name,p.brief].some(t=>t.toLowerCase().includes(state.query.toLowerCase()))),list=el('div',{class:'panel project-list'});
    for(const project of projects){const tasks=all('tasks').filter(t=>t.projectId===project.id),done=tasks.filter(t=>['verified','done'].includes(t.state)).length;list.append(el('button',{class:'project-row',onclick:()=>navigate('projects',project.id)},el('div',{},el('h3',{text:project.name}),el('p',{text:project.brief||'补充项目目标，让团队知道要交付什么。'}),el('small',{text:project.root})),el('div',{class:'row-side'},tag(project.status),el('span',{text:done+' / '+tasks.length+' 项任务'}),symbol('arrow'))));}
    $('view-root').replaceChildren(el('div',{class:'view-toolbar'},el('span',{class:'helper',text:'项目资料和成果保存在当前电脑'}),button('建立项目',()=>editProject(),'primary','plus')),projects.length?list:empty('建立你的第一个项目','选一个本机目录，写清目标，再邀请成员加入。',button('建立项目',()=>editProject(),'primary')));return;
  }
  const project=byId('projects',state.project),tasks=all('tasks').filter(t=>t.projectId===project.id),team=all('assignments').filter(a=>a.projectId===project.id),panel=el('section',{class:'panel'});
  const actions=el('div',{class:'inline-actions'},button('编辑目标',()=>editProject(project),'small'),button('任命成员',()=>appoint(project.id),'small'),button('整理计划',()=>post('/projects/'+project.id+'/plan').then(()=>toast('项目经理已收到规划任务')),'small primary'));
  if(project.status==='completed')for(const control of actions.querySelectorAll('button')){control.disabled=true;control.title='项目已经验收，新的工作请建立项目。';}
  if(project.status!=='completed')actions.append(button(project.status==='active'?'暂停项目':'启动项目',()=>post('/projects/'+project.id+'/status',{status:project.status==='active'?'paused':'active'}),'small'));
  if(tasks.length&&tasks.every(t=>['verified','done'].includes(t.state))&&project.status!=='completed')actions.append(button('验收项目',()=>post('/projects/'+project.id+'/accept').then(()=>toast('项目已验收')),'small primary'));
  actions.append(button('删除项目',()=>deleteProject(project),'small quiet danger'));
  panel.append(el('div',{class:'project-overview'},el('div',{},el('div',{class:'inline-actions'},el('h2',{text:project.name}),tag(project.status)),el('p',{text:project.brief||'请补充项目目标'}),el('p',{class:'helper',text:project.root})),actions),el('div',{class:'project-tabs'},...Object.entries({tasks:'项目任务',team:'团队与任命',brief:'目标与验收',activity:'协作记录'}).map(([tab,name])=>el('button',{class:state.projectTab===tab?'selected':'',text:name,onclick:()=>{state.projectTab=tab;renderProjects();}}))));
  const content=el('div',{class:'project-section'});
  if(state.projectTab==='tasks'){
    const pending=all('plans').filter(p=>p.projectId===project.id&&p.state==='pending');for(const plan of pending)content.append(el('div',{class:'welcome-line'},'项目经理已提交计划，确认后才能创建并派发任务。 ',el('button',{class:'text-action',text:'查看计划',onclick:()=>showPlan(plan)})));
    if(!tasks.length)content.append(empty('先确定团队，再安排工作','任命项目经理和执行、复核成员后，可以让项目经理整理计划，也可以直接创建任务。',button('新建任务',()=>editTask(),'primary')));else for(const task of tasks)content.append(el('div',{class:'task-list-row'},tag(task.state),el('div',{class:'text-column'},el('strong',{text:task.title}),el('small',{text:memberName(task.memberId)+(task.reviewerId?' · '+memberName(task.reviewerId)+'复核':'')+(task.dependsOn.length?' · '+task.dependsOn.length+' 项前置':'' )})),button('查看',()=>openTask(task.id),'small')));
  }else if(state.projectTab==='team'){
    if(!team.length)content.append(empty('给成员任命一个岗位','每位成员可以在不同项目中承担不同职责。',button('任命成员',()=>appoint(project.id),'primary')));else content.append(teamTable(team));
  }else if(state.projectTab==='brief'){content.append(info('项目目标',project.brief||'尚未填写'),info('验收要求',project.acceptance||'尚未填写'),info('返工上限',project.maxReworks+' 轮'),info('运行规则','任务按依赖推进。复核通过后放行后续任务，最终由你验收项目。自动派发开关单独控制新工作。'));}
  else content.append(timeline(all('events').filter(e=>e.projectId===project.id)));
  panel.append(content);$('view-root').replaceChildren(panel);
}
function info(title,text){return el('section',{class:'info-block'},el('h3',{text:title}),el('p',{class:'brief-text',text}));}
function teamTable(assignments){const table=el('table',{class:'data-table'},el('thead',{},el('tr',{},...['成员','项目岗位','责任范围','操作'].map(name=>el('th',{text:name}))))),body=el('tbody');for(const a of assignments){const member=byId('members',a.memberId);body.append(el('tr',{},el('td',{},el('div',{class:'member-name'},avatar(member),el('span',{},el('strong',{text:member.name}),el('small',{text:engineNames[engineOf(member)?.kind]||'未接入'})))),el('td',{},tag('',roles[a.role])),el('td',{class:'cell-muted',text:a.responsibility||'按项目目标完成岗位工作'}),el('td',{},button('撤销任命',()=>modal('撤销项目任命',[el('p',{class:'brief-text',text:'撤销后，尚未执行的任务需要重新安排成员。可以在项目中重新任命。'})],async()=>post('/appointments/'+a.id+'/remove'),{save:'撤销任命'}),'small quiet'))));}table.append(body);return table;}
function modelName(member){const known=engineOf(member)?.models?.find(m=>m.id===member.model);if(known)return known.name;if(!member.model)return '沿用引擎模型';try{const value=JSON.parse(member.model);if(Array.isArray(value))return value[value.length-1];}catch{}return member.model;}
function renderMembers(){
  const ids=new Set(scope(all('assignments')).map(a=>a.memberId)),members=all('members').filter(m=>(state.project==='all'||ids.has(m.id))&&(!state.query||m.name.includes(state.query)||m.specialty.includes(state.query))),panel=el('section',{class:'panel'}),table=el('table',{class:'data-table'}),body=el('tbody');table.append(el('thead',{},el('tr',{},...['成员','引擎与配置','项目岗位','当前工作','操作'].map(name=>el('th',{text:name})))));
  for(const member of members){const engine=engineOf(member),run=all('runs').find(r=>r.memberId===member.id&&active.has(r.state)),appointments=scope(all('assignments')).filter(a=>a.memberId===member.id);body.append(el('tr',{},el('td',{},el('div',{class:'member-name'},avatar(member),el('span',{},el('strong',{text:member.name}),el('small',{text:member.specialty||'个人团队成员'})))),el('td',{},el('div',{text:engineNames[engine?.kind]||'未接入'}),el('small',{class:'cell-muted',text:modelName(member)})),el('td',{},el('div',{class:'inline-actions'},...(appointments.length?[...new Set(appointments.map(a=>a.role))].map(role=>tag('',roles[role]+(appointments.filter(a=>a.role===role).length>1?' · '+appointments.filter(a=>a.role===role).length+' 个项目':''))):[el('small',{class:'cell-muted',text:'等待项目任命'})]))),el('td',{},run?tag(run.state,run.phase==='planning'?'整理计划':byId('tasks',run.taskId)?.title||labels[run.state]):tag(member.enabled?engine?.status||'unverified':'paused',member.enabled&&engine?.status==='connected'?'等待任务':undefined)),el('td',{},el('div',{class:'cell-actions'},button('查看',()=>openMember(member.id),'small'),button('编辑',()=>editMember(member),'small')))));}
  table.append(body);panel.append(table);$('view-root').replaceChildren(el('div',{class:'view-toolbar'},el('p',{class:'helper',text:'岗位按项目任命；并发由本机服务统一调度'}),el('div',{class:'inline-actions'},button('接入引擎',()=>navigate('connections'),'quiet','plug'),button('添加成员',()=>editMember(),'primary','plus'))),members.length?panel:empty('第一位团队成员，准备入职','先连接本机引擎，再创建成员，并在项目中任命岗位。',button('前往接入中心',()=>navigate('connections'),'primary')));
}
function renderConnections(){
  const panel=el('section',{class:'panel'});for(const[kind,name]of Object.entries(engineNames)){
    const engines=all('engines').filter(e=>e.kind===kind),candidate=state.candidates.find(c=>c.kind===kind);for(const engine of engines.length?engines:[null]){
      const actions=el('div',{class:'connection-actions'});if(engine)actions.append(button('检查连接',()=>post('/engines/'+engine.id+'/probe').then(e=>toast(e.status==='connected'?'引擎连接成功':e.lastError,e.status!=='connected')),'small'),button('添加成员',()=>editMember(null,engine.id),'small'));else actions.append(button('配置入口',()=>editEngine(kind,candidate?.executable),'small primary'));actions.append(button('接入提示词',()=>invite(kind),'small'));
      panel.append(el('div',{class:'connection-row'},el('div',{class:'engine-brand'},el('span',{class:'engine-mark',text:kind==='codex'?'C':kind==='hermes'?'H':'DS'}),el('div',{},el('h3',{text:name}),tag(engine?.status||'unverified',engine?undefined:candidate?.discovered?'已发现本机入口':'等待配置'))),el('div',{class:'connection-info'},el('strong',{text:engine?.label||name+' 本机连接'}),el('p',{text:engine?.executable||candidate?.executable||'点击检测本机引擎，或选择本机程序的绝对路径。'}),engine?.version?el('p',{text:engine.version}):null,engine?.lastError?el('p',{class:'error-line',text:engine.lastError}):null,engine?.catalogWarning?el('p',{class:'helper',text:engine.catalogWarning}):null,el('div',{class:'connection-capabilities'},...(engine?.capabilities?.execute?['任务执行','继续','停止','工具授权'].map(t=>tag('',t)):[el('span',{class:'helper',text:'连接检查通过后显示能力；模型登录与可用额度由原引擎管理。'})]))),actions));
    }
  }
  $('view-root').replaceChildren(el('div',{class:'welcome-line',text:'本机服务只连接当前电脑的引擎。已有配置可以直接检查；也可以复制提示词，让自己的 Agent 完成注册。'}),el('div',{class:'view-toolbar'},el('span',{class:'helper',text:'一次性邀请有效 10 分钟；长期凭据由引擎自己管理'}),button('检测本机引擎',async()=>{state.candidates=await api('/discover');renderConnections();toast('本机入口检测完成');},'primary','refresh')),panel);
}
function taskMoves(task,runs=all('runs').filter(run=>run.taskId===task.id)){
  const current=runs.find(run=>active.has(run.state));
  const moves={};
  if(current&&current.state!=='stopping'){
    moves.attention={label:'停止当前执行',run:async()=>{
      await post('/runs/'+current.id+'/stop');
      toast('停止请求已送达，等待引擎确认');
    }};
  }
  if(current||runs.some(run=>run.state==='unknown'))return moves;

  const route='/tasks/'+task.id,version={revision:task.revision};
  if(['ready','review_ready'].includes(task.state)){
    moves.running={label:task.phase==='review'?'开始复核':'执行任务',run:async()=>{
      await post(route+'/run',version);
      toast('任务已领取');
    }};
  }
  if(task.state==='ready'){
    moves.draft={label:'移回草稿',run:async()=>{
      await post(route+'/draft',version);
      toast('已移回草稿');
    }};
  }
  if(['draft','blocked','cancelled','submitted'].includes(task.state)){
    moves.ready={label:task.state==='draft'?'加入待执行':'重新安排',run:async()=>{
      await post(route+'/ready',version);
      toast('已加入待执行');
    }};
  }
  if(['submitted','verified','blocked'].includes(task.state)){
    moves.done={label:'人工验收',run:()=>acceptTaskDialog(task)};
  }
  return moves;
}

function startBoardDrag(event,task,moves,card){
  if(!event.dataTransfer||$('editor').open){
    event.preventDefault();
    return;
  }
  const board=card.closest('.kanban');
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('application/x-studio-task',task.id);
  boardDrag={board,card,task,moves,signature:snapshotSignature,hover:null,scrollSpeed:0,scrollFrame:0};
  card.classList.add('dragging');
  for(const lane of board.querySelectorAll('[data-lane]')){
    const move=moves[lane.dataset.lane];
    if(!move)continue;
    lane.classList.add('drop-target');
    const hint=lane.querySelector('.lane-drop-label');
    hint.textContent=move.label;
    hint.hidden=false;
  }
}
function finishBoardDrag(sync=false){
  const drag=boardDrag;
  if(!drag)return;
  boardDrag=null;
  cancelAnimationFrame(drag.scrollFrame);
  drag.card.classList.remove('dragging');
  for(const lane of drag.board.querySelectorAll('.drop-target')){
    lane.classList.remove('drop-target','drop-hover');
    lane.querySelector('.lane-drop-label').hidden=true;
  }
  if(sync&&snapshotSignature!==drag.signature)render();
}
function scrollBoardDuringDrag(drag){
  const previous=drag.board.scrollLeft;
  drag.board.scrollLeft+=drag.scrollSpeed;
  drag.scrollFrame=drag.board.scrollLeft!==previous?requestAnimationFrame(()=>scrollBoardDuringDrag(drag)):0;
}
function dragOverBoard(event){
  const drag=boardDrag;
  if(!drag||drag.board!==event.currentTarget)return;
  const lane=event.target.closest('[data-lane]'),move=drag.moves[lane?.dataset.lane];
  if(move)event.preventDefault();
  event.dataTransfer.dropEffect=move?'move':'none';
  const hover=move?lane:null;
  if(hover!==drag.hover){
    drag.hover?.classList.remove('drop-hover');
    hover?.classList.add('drop-hover');
    drag.hover=hover;
  }
  const {left,right}=drag.board.getBoundingClientRect();
  drag.scrollSpeed=event.clientX<left+40?-12:event.clientX>right-40?12:0;
  if(drag.scrollSpeed&&!drag.scrollFrame)drag.scrollFrame=requestAnimationFrame(()=>scrollBoardDuringDrag(drag));
}
function dragLeaveBoard(event){
  const drag=boardDrag;
  if(!drag||drag.board.contains(event.relatedTarget))return;
  const {left,right,top,bottom}=drag.board.getBoundingClientRect();
  if(event.clientX>left&&event.clientX<right&&event.clientY>top&&event.clientY<bottom)return;
  drag.hover?.classList.remove('drop-hover');
  drag.hover=null;
  drag.scrollSpeed=0;
  cancelAnimationFrame(drag.scrollFrame);
  drag.scrollFrame=0;
}
function dropOnBoard(event){
  const drag=boardDrag;
  if(!drag||drag.board!==event.currentTarget)return;
  event.preventDefault();
  const move=drag.moves[event.target.closest('[data-lane]')?.dataset.lane];
  finishBoardDrag(true);
  if(!move)return;
  if(byId('tasks',drag.task.id)?.revision!==drag.task.revision){
    toast('任务已更新，请从当前位置重新拖动。',true);
    return;
  }
  void act(null,move.run);
}

function renderTaskCard(task){
  const moves=taskMoves(task),draggable=Object.keys(moves).length>0;
  const memberId=task.phase==='review'?task.reviewerId:task.memberId;
  const card=el('article',{class:'task-card','data-task':task.id});
  const open=el('button',{
    type:'button',class:'task-card-main',draggable,onclick:()=>openTask(task.id),
    ondragstart:event=>startBoardDrag(event,task,moves,card),
    ondragend:()=>finishBoardDrag(true)
  },
  el('div',{class:'card-top'},
    el('span',{class:'task-card-project'},draggable?el('span',{class:'task-grip','aria-hidden':'true',title:'拖动任务'}):null,projectName(task.projectId)),
    tag(task.state)),
  el('h3',{text:task.title}),el('p',{text:task.lastError||task.description}),
  el('div',{class:'card-bottom'},el('div',{class:'inline-actions'},avatar(byId('members',memberId)),memberName(memberId)),
    el('span',{text:task.dependsOn.length?task.dependsOn.length+' 项依赖':'可独立安排'})));
  card.append(open);
  if(task.state==='draft')card.append(el('div',{class:'task-card-actions'},button('删除草稿',()=>deleteTaskDraft(task),'small quiet danger')));
  return card;
}

function renderBoard(){
  const tasks=taskFilter(),columns=[
    ['draft','草稿',t=>t.state==='draft'],
    ['ready','待执行',t=>['ready','review_ready'].includes(t.state)],
    ['running','正在执行',t=>['running','reviewing'].includes(t.state)],
    ['review','提交与复核',t=>['submitted','verified'].includes(t.state)],
    ['attention','需要处理',t=>['blocked','uncertain','cancelled'].includes(t.state)],
    ['done','已完成',t=>t.state==='done']
  ];
  const scrollLeft=$('task-board')?.scrollLeft||0;
  const board=el('div',{id:'task-board',class:'kanban',ondragover:dragOverBoard,ondragleave:dragLeaveBoard,ondrop:dropOnBoard});
  for(const [key,name,match] of columns){
    const items=tasks.filter(match);
    board.append(el('section',{class:'board-lane','data-lane':key},
      el('div',{class:'lane-heading'},el('strong',{text:name}),el('span',{class:'lane-count',text:items.length}),
        el('span',{class:'lane-drop-label',hidden:true})),
      items.length?items.map(renderTaskCard):el('div',{class:'lane-empty',text:'这一阶段暂时没有任务'})));
  }
  $('view-root').replaceChildren(
    el('div',{class:'view-toolbar'},el('span',{class:'helper',text:'拖动任务到高亮的列，也可以在详情中操作。'}),
      el('label',{class:'switch-label'},el('input',{type:'checkbox',checked:state.data.settings.autoDispatch,onchange:e=>act(e.target,()=>post('/dispatch',{enabled:e.target.checked}))}),'自动派发')),
    tasks.length?board:empty('给项目安排第一项工作','先建立项目并任命执行成员，再创建任务。',button('新建任务',()=>editTask(),'primary')));
  board.scrollLeft=scrollLeft;
}
function renderIdeas(){
  const ideas=scope(all('ideas')).filter(i=>!i.promotedTaskId&&!!i.deleted===state.draftTrash&&(!state.query||[i.title,i.body].some(t=>t.includes(state.query))));
  const grid=el('div',{class:'idea-grid'});
  for(const idea of ideas){
    const move=async deleted=>{
      await post('/ideas/'+idea.id,{deleted,revision:idea.revision});
      toast(deleted?'已移到废纸篓，可在废纸篓恢复':'已恢复草稿');
    };
    const actions=state.draftTrash
      ?[button('恢复',()=>move(false),'small'),button('彻底删除',()=>deleteIdea(idea),'small quiet danger')]
      :[button('编辑',()=>editIdea(idea),'small'),button('删除',()=>move(true),'small quiet danger')];
    grid.append(el('article',{class:'idea-card'},
      el('div',{class:'card-top'},el('span',{text:projectName(idea.projectId)}),el('time',{text:relative(idea.updatedAt)})),
      el('h3',{text:idea.title}),el('p',{class:'idea-body',text:idea.body}),
      el('footer',{},el('div',{class:'inline-actions'},actions),!state.draftTrash?button('安排任务',()=>editTask(null,idea),'small primary'):null)));
  }
  $('view-root').replaceChildren(el('div',{class:'idea-capture'},el('div',{},el('h2',{text:'先记下来，再交给团队'}),el('p',{text:'想法可以暂不选择项目和引擎，保存不会开始执行。'})),button('写下想法',()=>editIdea(),'primary','note')),el('div',{class:'view-toolbar'},el('div',{class:'segmented'},...[[false,'想法草稿'],[true,'废纸篓']].map(([trash,name])=>el('button',{class:state.draftTrash===trash?'selected':'',text:name,onclick:()=>{state.draftTrash=trash;renderIdeas();}}))),el('span',{class:'helper',text:ideas.length+' 份草稿'})),ideas.length?grid:empty(state.draftTrash?'废纸篓是空的':'给下一个项目留一点灵感','可以记录一个需求、一段素材或还没想完整的点子。',!state.draftTrash?button('记个想法',()=>editIdea(),'primary'):null));
}
function renderInbox(){const items=inboxItems(),panel=el('section',{class:'panel'});for(const item of items){const type={approval:item.type==='question'?'问题确认':'工具授权',plan:'项目计划',task:'任务处理',acceptance:'成果验收'}[item.inboxType];panel.append(el('article',{class:'inbox-item'},el('div',{class:'inline-actions'},tag('pending',type),el('span',{class:'cell-muted',text:projectName(item.projectId)})),el('h3',{text:item.title}),el('p',{text:item.inboxType==='plan'?item.summary:item.lastError||item.details||'项目任务已经通过复核，等待你的最终验收。'}),el('div',{class:'inline-actions'},button('查看并处理',()=>openInbox(item),'small primary'))));} $('view-root').replaceChildren(items.length?panel:empty('当前没有需要你处理的事项','项目计划、授权请求、阻塞和待验收成果会汇总在这里。'));
}
function timeline(events){return events.length?el('div',{},...events.map(e=>el('div',{class:'timeline-entry'},el('time',{title:when(e.at),text:new Date(e.at).toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit'})}),el('p',{text:e.message})))):el('p',{class:'empty-mini',text:'新的协作进展会自动记录在这里。'});}

function field(name,label,value='',options={}){const wrapper=el('label',{class:'field'},label);let input;if(options.choices){input=el('select',{name,required:options.required});for(const choice of options.choices)input.append(el('option',{value:choice.value,text:choice.label}));input.value=value||'';}else input=el(options.multiline?'textarea':'input',{name,type:options.type||'text',value:options.multiline?undefined:value,rows:options.rows||4,required:options.required,maxlength:options.max||100000,placeholder:options.placeholder||''});if(options.multiline)input.value=value||'';input.setAttribute('aria-label',label);wrapper.append(input);if(options.help)wrapper.append(el('small',{class:'helper',text:options.help}));return wrapper;}
function formData(form){return Object.fromEntries(new FormData(form));}
function modal(title,children,handler,{save='保存',context='本机工作室',readOnly=false,danger=false}={}){
  const submit=$('save-editor');
  $('dialog-title').textContent=title;
  $('dialog-context').textContent=context;
  $('dialog-body').replaceChildren(...children);
  $('form-error').hidden=true;
  submit.textContent=save;
  submit.hidden=readOnly;
  submit.classList.toggle('primary',!danger);
  submit.classList.toggle('danger',danger);
  $('cancel-editor').textContent=readOnly?'关闭':'取消';
  state.modalHandler=handler;
  $('editor').showModal();
  if(danger)$('cancel-editor').focus();
  else $('dialog-body').querySelector('input,textarea,select')?.focus();
}
function closeModal(){$('editor').close();state.modalHandler=null;render();}
$('editor-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const save=$('save-editor'),cancel=$('cancel-editor'),close=$('close-editor');
  if(save.disabled)return;
  save.disabled=cancel.disabled=close.disabled=true;
  $('form-error').hidden=true;
  try{
    const result=await state.modalHandler?.(formData(event.currentTarget),event.currentTarget);
    if(result!==false)closeModal();
  }catch(error){
    $('form-error').textContent=error.message;
    $('form-error').hidden=false;
  }finally{save.disabled=cancel.disabled=close.disabled=false;}
});
$('editor').addEventListener('cancel',event=>{
  if($('save-editor').disabled){event.preventDefault();return;}
  state.modalHandler=null;
  setTimeout(render,0);
});
$('close-editor').onclick=closeModal;$('cancel-editor').onclick=closeModal;
function confirmDeletion(title,context,description,remove){
  modal(title,[el('p',{class:'brief-text',text:description})],remove,{save:title,context,danger:true});
}
function deleteProject(project){
  if(all('runs').some(run=>run.projectId===project.id&&(active.has(run.state)||run.state==='unknown'))){
    toast('请先停止或核对项目中的执行，再删除项目。',true);
    return;
  }
  confirmDeletion('删除项目',project.name,
    '将删除工作室中的项目、任务、计划、任命和协作记录。关联的想法会保留在草稿箱。项目目录和本机成果文件会保留。删除后无法撤销。',
    async()=>{
      await post('/projects/'+project.id+'/delete',{revision:project.revision});
      state.project='all';
      state.projectTab='tasks';
      toast('项目已删除');
    });
}
function deleteTaskDraft(task){
  confirmDeletion('删除草稿任务',task.title,
    '将删除这条看板草稿及其工作室执行记录。若它来自草稿箱，原想法会回到草稿箱。删除后无法撤销。',
    async()=>{
      await post('/tasks/'+task.id+'/delete',{revision:task.revision});
      if(state.detail?.type==='task'&&state.detail.id===task.id)closeDetail();
      toast('草稿任务已删除');
    });
}
function deleteIdea(idea){
  confirmDeletion('彻底删除',idea.title,'这份草稿将从废纸篓移除，删除后无法恢复。',async()=>{
    await post('/ideas/'+idea.id+'/delete',{revision:idea.revision});
    toast('草稿已彻底删除');
  });
}
function acceptTaskDialog(task){
  modal('验收这项任务',[
    el('p',{class:'brief-text',text:'请核对实际产物及检查证据，再记录验收结论。'}),
    field('reason','验收依据','',{multiline:true,rows:4,required:task.state==='blocked'})
  ],async data=>{
    await post('/tasks/'+task.id+'/accept',{...data,revision:task.revision});
    toast('任务已验收');
  },{save:'验收通过'});
}
function projectChoices(){return[{value:'',label:'选择项目'},...all('projects').filter(p=>p.status!=='completed').map(p=>({value:p.id,label:p.name}))];}
function memberChoices(projectId,role){const ids=new Set(all('assignments').filter(a=>a.projectId===projectId&&a.role===role).map(a=>a.memberId));return[{value:'',label:role==='reviewer'?'由你直接验收':'选择已任命成员'},...all('members').filter(m=>ids.has(m.id)).map(m=>({value:m.id,label:m.name+' · '+engineNames[engineOf(m)?.kind]}))];}
function editProject(project){modal(project?'编辑项目目标':'建立本机项目',[field('name','项目名称',project?.name,{required:true,max:100,placeholder:'例如：公司官网改版'}),field('root','本机项目目录',project?.root,{required:true,placeholder:'例如：E:\\项目\\公司官网',help:project?'项目目录固定，团队在这个范围内工作。':'选择已有的具体文件夹，项目工作在这里执行。'}),field('brief','项目目标',project?.brief,{multiline:true,rows:4,placeholder:'要交付什么，范围和重点是什么？'}),field('acceptance','验收要求',project?.acceptance,{multiline:true,rows:3,placeholder:'什么结果才算达成目标？'}),project?field('maxReworks','最多返工轮数',project.maxReworks,{type:'number'}):null].filter(Boolean),async data=>{await post(project?'/projects/'+project.id:'/projects',{...data,...(project?{revision:project.revision}:{})});toast(project?'项目目标已更新':'项目已建立，请接着任命团队');},{save:project?'保存目标':'建立项目'});if(project)$('editor-form').elements.root.disabled=true;else if(window.studioDesktop){const input=$('editor-form').elements.root;input.parentNode.append(button('选择文件夹',async()=>{const chosen=await window.studioDesktop.chooseFolder();if(chosen)input.value=chosen;},'small quiet'));}}
function modelField(engineId,value){const models=byId('engines',engineId)?.models||[];return field('model','模型',value,{...(models.length?{choices:[{value:'',label:'沿用这个引擎的默认配置'},...models.map(m=>({value:m.id,label:m.name})),...(value&&!models.some(m=>m.id===value)?[{value,label:value}]:[])]}:{placeholder:'留空沿用引擎配置'}),help:'模型选项来自这个引擎的实际会话。账号模型和 API Key 模型是不同路由。'});}
function editMember(member,engineId){if(!all('engines').length){navigate('connections');toast('先配置一个本机引擎');return;}modal(member?'编辑成员':'添加团队成员',[field('name','成员名称',member?.name,{required:true,max:80,placeholder:'给这位成员取个名字'}),field('engineId','使用的引擎',member?.engineId||engineId||'',{required:true,choices:[{value:'',label:'选择已配置引擎'},...all('engines').map(e=>({value:e.id,label:e.label+' · '+(labels[e.status]||e.status)}))]}),modelField(member?.engineId||engineId,member?.model),field('specialty','擅长和工作方式',member?.specialty,{multiline:true,rows:3,placeholder:'例如：梳理需求、编写实现、独立检查结果'}),member?el('label',{class:'switch-label'},el('input',{name:'enabled',type:'checkbox',checked:member.enabled}),'允许接收新任务'):null].filter(Boolean),async(data,form)=>{await post(member?'/members/'+member.id:'/members',{...data,...(member?{enabled:form.elements.enabled.checked,revision:member.revision}:{avatar:all('members').length%8})});toast('成员已保存');},{save:'保存成员'});if(member)$('editor-form').elements.engineId.disabled=true;else $('editor-form').elements.engineId.onchange=()=>{const form=$('editor-form');form.elements.model.parentNode.replaceWith(modelField(form.elements.engineId.value,''));};}
function editEngine(kind,executable){modal('配置 '+engineNames[kind],[field('label','连接名称',engineNames[kind]+' 本机'),field('executable','本机程序或 Node 入口',executable,{required:true,placeholder:'选择绝对路径的 .exe / 原生程序 / .js 入口',help:'Windows 的 .cmd / .bat 不作为直接入口，DSH 可填写其 Node 入口文件。'}),kind==='dsh'?field('profile','DSH profile','acp',{help:'使用包含 ACP 的本机 profile。'}):null,field('runtimeHome','引擎配置目录（可留空）','',{help:'留空使用原引擎默认配置；填写后只影响这个连接。'})].filter(Boolean),async data=>{await post('/engines',{...data,kind});toast('入口已保存，点击检查连接确认能力');},{save:'保存入口'});if(window.studioDesktop){const input=$('editor-form').elements.executable;input.parentNode.append(button('选择程序',async()=>{const chosen=await window.studioDesktop.chooseEngine();if(chosen)input.value=chosen;},'small quiet'));}}
function appoint(projectId){if(!all('members').length){navigate('members');toast('先添加一位团队成员');return;}modal('任命项目成员',[field('memberId','成员','',{required:true,choices:[{value:'',label:'选择成员'},...all('members').filter(m=>m.enabled).map(m=>({value:m.id,label:m.name}))]}),field('role','项目岗位','executor',{choices:Object.entries(roles).map(([value,label])=>({value,label}))}),field('responsibility','责任范围','',{multiline:true,rows:4,placeholder:'这位成员需要完成什么，交付什么，遇到什么问题向你汇报？'}),el('p',{class:'helper',text:'岗位职责随本次执行传递；文件和工具权限仍由原引擎及项目规则约束。'})],async data=>{await post('/projects/'+projectId+'/team',data);toast('项目任命已保存');},{save:'任命成员',context:projectName(projectId)});}
function editTask(task,idea){
  if(!all('projects').length){editProject();return;}const selected=task?.projectId||idea?.projectId||(state.project!=='all'?state.project:'')||all('projects').find(p=>p.status!=='completed')?.id;
  modal(idea?'把想法安排给团队':task?'编辑任务':'新建项目任务',[field('projectId','所属项目',selected,{choices:projectChoices(),required:true}),field('title','任务标题',task?.title||idea?.title,{required:true,max:200}),field('description','要完成的工作',task?.description||idea?.body,{multiline:true,rows:4,required:true}),field('acceptance','验收条件',task?.acceptance,{multiline:true,rows:3,required:true,placeholder:'明确应交付的结果和检查方式'}),el('div',{class:'field-row'},field('memberId','执行成员',task?.memberId,{choices:memberChoices(selected,'executor'),required:true}),field('reviewerId','复核成员',task?.reviewerId,{choices:memberChoices(selected,'reviewer')})),field('outputPaths','成果文件（相对项目目录，每行一个）',task?.outputPaths?.join('\n'),{multiline:true,rows:2,placeholder:'例如：docs/方案.md'}),el('label',{class:'field'},'前置任务',el('div',{id:'dependency-options',class:'check-list'})),el('div',{class:'field-row'},field('priority','优先级',String(task?.priority??1),{choices:[{value:'1',label:'普通'},{value:'2',label:'优先'},{value:'3',label:'紧急'},{value:'0',label:'稍后'}]}),field('draft','安排方式',task?.state==='draft'?'yes':'no',{choices:[{value:'no',label:'加入待执行'},{value:'yes',label:'先存为任务草稿'}]})),el('p',{class:'helper',text:'成员需要先在项目团队中任命。自动派发关闭时，可以稍后手动执行。'})],async(data,form)=>{const payload={...data,reviewerId:data.reviewerId||null,outputPaths:data.outputPaths.split('\n').map(s=>s.trim()).filter(Boolean),dependsOn:[...form.querySelectorAll('[name=dependsOn]:checked')].map(n=>n.value),draft:data.draft==='yes'};await post(idea?'/ideas/'+idea.id+'/promote':task?'/tasks/'+task.id:'/tasks',{...payload,...(task?{revision:task.revision}:{}),...(idea?{ideaRevision:idea.revision}:{})});toast('任务已安排');},{save:'保存任务'});
  function updateProjectFields(initial=false){const form=$('editor-form'),projectId=form.elements.projectId.value;for(const[name,role]of[['memberId','executor'],['reviewerId','reviewer']]){const select=form.elements[name],value=initial?task?.[name]:'';select.replaceChildren(...memberChoices(projectId,role).map(c=>el('option',{value:c.value,text:c.label})));select.value=value||'';}$('dependency-options').replaceChildren(...all('tasks').filter(t=>t.projectId===projectId&&t.id!==task?.id).map(t=>el('label',{},el('input',{type:'checkbox',name:'dependsOn',value:t.id,checked:task?.dependsOn.includes(t.id)}),t.title)));if(!$('dependency-options').children.length)$('dependency-options').append(el('span',{class:'helper',text:'暂无其他任务，可独立安排。'}));}updateProjectFields(true);$('editor-form').elements.projectId.onchange=()=>updateProjectFields();
}
function editIdea(idea){modal(idea?'编辑想法':'记个想法',[field('title','标题（可留空）',idea?.title,{max:180,placeholder:'给这个想法起个名字'}),field('body','想法内容',idea?.body,{required:true,multiline:true,rows:7,placeholder:'还没想完整的需求、素材和灵感，都可以先放在这里。'}),field('projectId','关联项目',idea?.projectId||(state.project==='all'?'':state.project),{choices:[{value:'',label:'暂不分配项目'},...all('projects').map(p=>({value:p.id,label:p.name}))]})],async data=>{await post(idea?'/ideas/'+idea.id:'/ideas',{...data,...(idea?{revision:idea.revision}:{})});toast('想法已存入草稿箱');},{save:'保存想法'});}
async function invite(kind){
  const matchingEngine=all('engines').find(e=>e.kind===kind),preferredModel=all('members').find(m=>m.engineId===matchingEngine?.id&&m.model)?.model||'';
  modal('生成 '+engineNames[kind]+' 接入邀请',[
    field('name','注册后的成员名称',engineNames[kind]+' 成员',{required:true,max:80}),
    modelField(matchingEngine?.id,preferredModel),
    el('p',{class:'helper',text:'邀请只在当前电脑使用，有效 10 分钟。接入助手会自动注册并检查本机接口。'})
  ],async data=>{
    const result=await post('/invitations',{kind,name:data.name,model:data.model});
    const packet=btoa(unescape(encodeURIComponent(JSON.stringify(result)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    const windows=result.platform==='win32';
    const quoted="'"+result.helper.replaceAll("'",windows?"''":"'\\''")+"'";
    const command=(windows?'& ':'/bin/sh ')+quoted+' --invitation '+packet;
    const prompt='请使用本机工作室接入助手，将当前电脑上的 '+engineNames[kind]+' 注册为“'+data.name+'”。\n\n在'+(windows?' PowerShell ':'终端')+'执行以下随客户端提供的助手：\n'+command+'\n\n助手会检测本机入口并使用一次性邀请配对。若入口未被发现，请定位真实程序或 Node 入口，追加 --executable 绝对路径；需要自定义配置目录时追加 --runtime-home。注册后报告成员编号、连接状态和需要我处理的事项。';
    closeModal();
    modal('复制给你的 Agent',[
      el('p',{class:'helper',text:'在本机 '+engineNames[kind]+' 中粘贴执行。邀请有效至 '+new Date(result.expires).toLocaleTimeString('zh-CN')+'。'}),
      el('pre',{class:'code-box',text:prompt})
    ],async()=>{await navigator.clipboard.writeText(prompt);toast('接入提示词已复制');return false;},{save:'复制提示词'});
    return false;
  },{save:'生成专属提示词'});
}
function openInbox(item){if(item.inboxType==='approval')showApproval(item);else if(item.inboxType==='plan')showPlan(item);else if(item.inboxType==='acceptance'){navigate('projects',item.id);}else openTask(item.id);}
function showPlan(plan){const children=[el('p',{class:'brief-text',text:plan.summary}),...plan.tasks.map((t,i)=>el('section',{class:'info-block'},el('h3',{text:(i+1)+'. '+t.title}),el('p',{class:'brief-text',text:t.description}),el('p',{class:'helper',text:'执行：'+memberName(t.memberId)+' · 复核：'+memberName(t.reviewerId)+' · 前置：'+(t.dependsOn.join('、')||'无')}),el('p',{class:'brief-text',text:'验收：'+t.acceptance}))),el('p',{class:'helper',text:'确认后创建任务，是否开始执行由自动派发开关及项目状态决定。'}),button('退回计划',async()=>{await post('/plans/'+plan.id+'/reject');closeModal();toast('计划已退回，可以调整目标后重新整理');},'quiet danger')];modal('确认项目计划',children,async()=>{await post('/plans/'+plan.id+'/approve');toast('计划已确认，任务已加入看板');},{save:'确认计划',context:projectName(plan.projectId)});}
function showApproval(approval){
  if(approval.type==='question'){modal('回答成员的问题',[...approval.questions.map(q=>field(q.id,q.header||q.question,'',{multiline:true,rows:3,required:true,help:q.question})),el('p',{class:'helper',text:memberName(approval.memberId)+' · '+projectName(approval.projectId)})],async data=>post('/approvals/'+approval.id,{answers:Object.fromEntries(approval.questions.map(q=>[q.id,{answers:[data[q.id]]}]))}),{save:'提交回答'});return;}
  const choices=approval.choices,defaultChoice=choices.find(c=>c.kind==='reject_once')||choices.find(c=>c.kind==='allow_once')||choices[0];modal('处理工具授权',[el('p',{class:'brief-text',text:approval.title}),el('pre',{class:'code-box',text:approval.details}),field('choice','处理方式',defaultChoice?.id,{choices:choices.map(c=>({value:c.id,label:c.name+(['allow_always','allow_session'].includes(c.kind)?'（扩展授权范围）':'')}))}),el('p',{class:'helper',text:'只处理这条引擎请求；永久或会话授权由引擎提供的选项决定。'})],async data=>{await post('/approvals/'+approval.id,data);toast('处理结果已送达');},{save:'提交处理',context:memberName(approval.memberId)+' · '+projectName(approval.projectId)});
}
function closeDetail(){state.detail=null;$('detail-panel').hidden=true;}
function openTask(key){if(!byId('tasks',key))return;state.detail={type:'task',id:key};$('detail-panel').hidden=false;renderDetail();}
function openMember(key){state.detail={type:'member',id:key};$('detail-panel').hidden=false;renderDetail();}
function detailSection(title,content){return el('section',{class:'detail-section'},el('h3',{text:title}),typeof content==='string'?el('p',{text:content}):content);}
function renderDetail(){if(!state.detail)return;const body=$('detail-body');
  if(state.detail.type==='member'){const member=byId('members',state.detail.id);if(!member)return;const engine=engineOf(member),runs=all('runs').filter(r=>r.memberId===member.id);$('detail-label').textContent='团队成员';body.replaceChildren(avatar(member),el('h2',{class:'detail-title',text:member.name}),el('div',{class:'detail-meta'},tag(engine?.status||'unverified'),el('span',{text:engineNames[engine?.kind]||'尚未接入'})),button('编辑成员',()=>editMember(member),'small'),detailSection('工作方式',member.specialty||'按项目任命承担工作'),detailSection('项目任命',el('div',{class:'inline-actions'},...all('assignments').filter(a=>a.memberId===member.id).map(a=>tag('',projectName(a.projectId)+' · '+roles[a.role])))),detailSection('最近执行',runs.length?el('div',{},...runs.slice(0,8).map(r=>el('div',{class:'task-list-row'},tag(r.state),el('div',{class:'text-column'},el('strong',{text:r.phase==='planning'?'整理项目计划':byId('tasks',r.taskId)?.title||'项目执行'}),el('small',{text:projectName(r.projectId)})),r.taskId?button('查看',()=>openTask(r.taskId),'small'):null))):el('p',{text:'尚未安排执行'})));return;}
  const task=byId('tasks',state.detail.id);
  if(!task){closeDetail();return;}
  $('detail-label').textContent='项目任务';
  const runs=all('runs').filter(r=>r.taskId===task.id).sort((a,b)=>b.startedAt-a.startedAt);
  const current=runs.find(r=>active.has(r.state)),unknown=runs.find(r=>r.state==='unknown');
  const moves=taskMoves(task,runs),actions=el('div',{class:'inline-actions'});
  for(const [lane,style] of [['running','primary'],['ready','quiet'],['draft','quiet'],['attention','danger'],['done','quiet']]){
    const move=moves[lane];
    if(move)actions.append(button(move.label,move.run,style));
  }
  if(['draft','ready','blocked','cancelled'].includes(task.state)&&!unknown&&!current)actions.append(button('编辑任务',()=>editTask(task),'quiet'));
  if(task.state==='draft'&&!unknown&&!current)actions.append(button('删除草稿',()=>deleteTaskDraft(task),'quiet danger'));
  if(current?.state==='stopping')actions.append(tag('stopping','等待停止确认'));
  if(unknown)actions.append(button('核对上次执行',()=>modal('确认上次执行已结束',[el('p',{class:'brief-text',text:'请先在原引擎确认这个执行已经结束。确认后仅释放当前工作室工位，任务仍需手动重新安排。'}),field('confirmed','已在原引擎核对','',{required:true,placeholder:'输入：已结束'})],async data=>{if(data.confirmed!=='已结束')throw new Error('请在核对后输入“已结束”。');await post('/runs/'+unknown.id+'/resolve',{confirmInterrupted:true});},{save:'确认上次已结束'}),'quiet'));
  const sections=[tag(task.state),el('h2',{class:'detail-title',text:task.title}),el('div',{class:'detail-meta'},el('span',{text:projectName(task.projectId)}),el('span',{text:'执行：'+memberName(task.memberId)}),el('span',{text:'复核：'+(task.reviewerId?memberName(task.reviewerId):'你')})),actions,task.lastError?el('div',{class:'state-banner',text:task.lastError}):null,detailSection('任务要求',task.description),detailSection('验收条件',task.acceptance)];
  if(task.dependsOn.length)sections.push(detailSection('前置任务',el('div',{class:'inline-actions'},...task.dependsOn.map(key=>button(byId('tasks',key)?.title||key,()=>openTask(key),'small')))));
  const approvals=all('approvals').filter(a=>a.runId===current?.id&&a.state==='pending');if(approvals.length)sections.push(detailSection('等待你的处理',el('div',{class:'inline-actions'},...approvals.map(a=>button(a.title,()=>showApproval(a),'small primary')))));
  const artifacts=all('artifacts').filter(a=>a.taskId===task.id);if(artifacts.length)sections.push(detailSection('成果与执行报告',el('div',{class:'inline-actions'},...artifacts.map(a=>button(a.name,async()=>{const result=await api('/artifacts/'+a.id);modal(a.name,[el('p',{class:'helper',text:a.path}),result.changed?el('p',{class:'state-banner',text:'文件已发生变化，当前内容与提交时版本不同。'}):null,el('pre',{class:'code-box',text:result.content})].filter(Boolean),null,{readOnly:true});},'small')))));
  sections.push(detailSection('执行与复核记录',runs.length?el('div',{},...runs.map(run=>el('section',{class:'run-entry'},el('div',{class:'run-heading'},el('span',{text:memberName(run.memberId)+' · '+(run.phase==='review'?'独立复核':'任务执行')}),tag(run.state)),el('small',{class:'cell-muted',text:when(run.startedAt)}),el('p',{text:run.progress||run.error||''}),run.output?el('pre',{text:run.output}):null))):el('p',{text:'任务还未开始。'})));body.replaceChildren(...sections.filter(Boolean));
}
function settings(){const current=state.data.settings;modal('工作室设置',[field('officeName','工作室名称',current.officeName,{required:true,max:32}),field('bossName','老板名牌',current.bossName,{required:true,max:18}),field('scene','办公室场景',current.appearance.scene,{choices:[{value:'city',label:'城市工作室'},{value:'garden',label:'花园工坊'},{value:'orbital',label:'星际夜班'}]}),field('motion','人物动效',current.appearance.motion,{choices:[{value:'lively',label:'活泼'},{value:'calm',label:'轻动效'},{value:'off',label:'暂停动效'}]}),field('maxParallel','最多同时执行',String(current.maxParallel),{type:'number',help:'同一个引擎连接和同一项目写目录仍分别排队。'}),el('label',{class:'switch-label'},el('input',{type:'checkbox',name:'bubbles',checked:current.appearance.bubbles}),'显示人物气泡'),button('结束本机后台',()=>modal('结束本机后台',[el('p',{class:'brief-text',text:'后台结束后将暂停派发，本机窗口会断开连接。请先处理当前执行；重新打开客户端会启动服务。'})],async()=>{await post('/service/stop');toast('本机后台正在结束，可以关闭窗口。');},{save:'结束后台'}),'quiet danger')],async(data,form)=>{await post('/settings',{officeName:data.officeName,bossName:data.bossName,maxParallel:Number(data.maxParallel),revision:current.revision,appearance:{scene:data.scene,motion:data.motion,bubbles:form.elements.bubbles.checked}});state.sceneSignature='';},{save:'保存设置'});}
for(const node of document.querySelectorAll('[data-view]'))node.onclick=()=>navigate(node.dataset.view);
$('brand-home').onclick=()=>navigate('office');$('scope-all').onclick=()=>navigate(state.view,'all');$('rail-new-project').onclick=()=>editProject();$('new-task').onclick=()=>editTask();$('quick-note').onclick=()=>editIdea();$('open-settings').onclick=settings;$('refresh').onclick=e=>act(e.currentTarget,refresh);$('search').oninput=e=>{state.query=e.target.value;render();};$('close-detail').onclick=closeDetail;
$('about').onclick=()=>modal('本机工作室 '+(state.data?.version||''),[info('数据与执行','项目、任命、任务、成果与事件由当前电脑的独立本机服务保存。模型账号与网络依各引擎配置。工作室仅控制自己建立或接续的专用执行。'),info('协作流程','确认项目计划后，任务按依赖派发。执行成员提交成果，由不同成员复核；通过后放行后续任务，最终由你验收。'),info('后台运行','关闭客户端窗口后，后台按现有派发设置继续运行。暂停派发停止领取新任务，当前执行需要单独停止。电脑睡眠和关机后需要重新核对执行状态。'),info('角色与权限','角色提示词说明职责，工具及文件权限仍由原引擎及项目策略约束。工位状态来自实际记录，随机人物气泡属于场景表现。')],null,{readOnly:true});
document.addEventListener('keydown',event=>{if($('editor').open||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;if(event.key==='/'){event.preventDefault();$('search').focus();}if(['1','2','3'].includes(event.key))navigate({1:'office',2:'projects',3:'board'}[event.key]);});
window.addEventListener('studio-menu',event=>{const action=event.detail;if(['office','projects','board','ideas','members','inbox','connections'].includes(action))navigate(action);else if(action==='new-task')editTask();else if(action==='settings')settings();else if(action==='refresh')act(null,refresh);});
try{await refresh();const stream=new EventSource('/api/events');stream.addEventListener('snapshot',event=>{try{apply(JSON.parse(event.data));}catch{}});stream.onerror=()=>{$('service-dot').className='';$('service-label').textContent='连接恢复中';};}catch(error){$('view-root').replaceChildren(empty('本机工作室尚未连接',error.message,button('重新连接',refresh,'primary')));}
