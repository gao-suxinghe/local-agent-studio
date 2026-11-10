import {createOfficeLife} from './office-life.js';
import {svg,path,ellipse,text,short} from './svg.js';
import {SCENES,ZONES,normalizeAppearance,CAPACITY} from './scene-config.js';
import {buildRoom,deskArt,chair,executiveChair,bossNameplate,wallDisplay,bossMonitor} from './scene-art.js';
import {createCharacter} from './characters.js';
import {createMotionLoop} from './scene-motion.js';
import {deliveryRoute,pointAlong,routeLength} from './navigation.js';
import {poseAt} from './motion-model.js';
export const capacity=CAPACITY;
const controllers=new WeakMap(),seenFlows=new Set();

function createController(container,tasks,labels,onSelect,options){
  let appearance=normalizeAppearance(options.appearance),model={},disposed=false,hovered=null,tooltip=null,speech=null,speechUntil=0,courier=null,clockMinute=-1,screenSignature='',bossSignature='';
  const scene=SCENES[appearance.scene],world=svg('svg',{viewBox:scene.view.join(' '),class:'office-world scene-'+scene.id,role:'group','aria-label':scene.name+'，主办公区、独立老板办公室与休闲区'}),camera=svg('g',{class:'scene-camera'});
  const room=buildRoom(scene),floorEffects=svg('g',{class:'floor-effects','aria-hidden':'true'}),depthLayer=svg('g',{class:'room-depth'}),overlays=svg('g',{class:'scene-overlays','aria-hidden':'true'}),display=wallDisplay(scene);
  const actors=[],stations=new Map(),layers=[...room.props],life=createOfficeLife(scene),mobileActors=new Map();let signals=new Map(),activeZone='all';
  const cameraState={zoom:1,x:0,y:0,panning:true};let pointer=null,lastDrag=-1000;
  const canClick=event=>event.type!=='click'||performance.now()-lastDrag>250;
  function activate(node,callback){node.addEventListener('click',e=>{if(canClick(e)){e.stopPropagation();callback();}});node.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();callback();}});}
  const screenButton=svg('rect',{width:414,height:147,fill:'transparent',role:'button',tabindex:0,'aria-label':'任务大屏，打开草稿箱',class:'screen-hit'});screenButton.setAttribute('pointer-events','none');display.append(screenButton);activate(screenButton,options.onDrafts);activate(display,options.onDrafts);
  for(let index=0;index<CAPACITY;index++){
    const point=scene.points[index],task=tasks[index],node=svg('g',{transform:`translate(${point[0]} ${point[1]})`,class:'workstation station-'+(task?.runState||'empty'),'data-seat':index,'data-x':point[0],'data-y':point[1]});
    node.append(deskArt(scene),chair(scene,-6,61));let actor;
    if(task){
      const rig=createCharacter(task.id),anchor=svg('g',{transform:'translate(-6 58)',class:'person-anchor'});anchor.append(rig.node);node.append(anchor);
      actor={rig,node,anchor,index,state:task.runState,taskId:task.id,task,reporting:false};actors.push(actor);
      node.setAttribute('role','button');node.setAttribute('tabindex','0');node.dataset.taskId=task.id;
      node.append(svg('title',{},task.title+' · '+(labels[task.runState]||'待核实')),ellipse(5,64,83,29,'none',{stroke:scene.palette.accent,'stroke-width':2,opacity:0,class:'activity-ring'}));
      const marker=svg('g',{transform:'translate(39 -66)',class:'state-marker'},svg('rect',{x:-13,y:-11,width:26,height:22,rx:7,fill:'#ecdbb5'}),text(0,5,'!',{'text-anchor':'middle',fill:'#897140','font-size':15,'font-weight':700}));node.append(marker);
      activate(node,()=>onSelect(actor.task));
      const show=()=>{hovered=task.id;node.classList.add('station-highlight');options.onHighlight?.(task.id);drawTooltip(actor,point);};
      const hide=()=>{hovered=null;node.classList.remove('station-highlight');options.onHighlight?.(null);tooltip?.remove();tooltip=null;};
      node.addEventListener('pointerenter',show);node.addEventListener('pointerleave',hide);node.addEventListener('focus',show);node.addEventListener('blur',hide);
      stations.set(task.id,{node,actor,index,point});
    }else node.setAttribute('aria-hidden','true');
    layers.push({y:point[1]+86,node});
  }
  const bossNode=svg('g',{transform:`translate(${scene.boss[0]} ${scene.boss[1]})`,class:'boss-desk',role:'button',tabindex:0,'aria-label':'你的老板工位，打开审核台'}),bossRig=createCharacter('boss-self',{boss:true}),bossAnchor=svg('g',{transform:'translate(-4 66)',class:'person-anchor'}),bossScreen=bossMonitor(scene),nameplate=bossNameplate(scene);
  bossAnchor.append(bossRig.node);bossNode.append(deskArt(scene,{boss:true,monitor:false}),bossScreen,executiveChair(scene,-5,70),bossAnchor,nameplate,svg('g',{class:'boss-notification',visibility:'hidden',transform:'translate(127 -96)'},ellipse(0,0,15,15,'#c4a86c'),text(0,6,'!',{'text-anchor':'middle',fill:'#fff','font-size':20,'font-weight':700})));
  actors.push({rig:bossRig,node:bossNode,state:'boss',boss:true,taskId:'boss'});activate(bossNode,options.onReviews);layers.push({y:scene.boss[1]+128,node:bossNode});
  layers.sort((a,b)=>a.y-b.y);for(const item of layers){item.node.dataset.depth=String(item.y);depthLayer.append(item.node);}
  activate(room.bossDisplay,options.onReviews);camera.append(room.backdrop,floorEffects,display,room.bossDisplay,depthLayer,overlays);world.append(camera);container.replaceChildren(world);container.dataset.scene=scene.id;
  function transformCamera(){const bounds=ZONES[activeZone].view,cx=bounds[0]+bounds[2]/2,cy=bounds[1]+bounds[3]/2;world.setAttribute('viewBox',bounds.join(' '));camera.setAttribute('transform',`translate(${cx+cameraState.x} ${cy+cameraState.y}) scale(${cameraState.zoom}) translate(${-cx} ${-cy})`);world.classList.toggle('camera-panning',cameraState.panning);container.dataset.zoom=cameraState.zoom.toFixed(2);container.dataset.zone=activeZone;options.onCamera?.({...cameraState,zone:activeZone});}
  function cameraPoint(event){const p=world.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(world.getScreenCTM().inverse());}
  world.addEventListener('pointerdown',event=>{if(!cameraState.panning||event.button!==0)return;const p=cameraPoint(event);pointer={id:event.pointerId,start:p,client:[event.clientX,event.clientY],x:cameraState.x,y:cameraState.y,moved:0,dragging:false};});
  world.addEventListener('pointermove',event=>{if(!pointer||pointer.id!==event.pointerId)return;const p=cameraPoint(event),dx=p.x-pointer.start.x,dy=p.y-pointer.start.y;pointer.moved=Math.hypot(event.clientX-pointer.client[0],event.clientY-pointer.client[1]);if(!pointer.dragging&&pointer.moved<5)return;if(!pointer.dragging){pointer.dragging=true;world.setPointerCapture(event.pointerId);}event.preventDefault();cameraState.x=Math.max(-550,Math.min(550,pointer.x+dx));cameraState.y=Math.max(-380,Math.min(380,pointer.y+dy));transformCamera();});
  const endPointer=event=>{if(pointer?.id!==event.pointerId)return;if(pointer.dragging)lastDrag=performance.now();pointer=null;if(world.hasPointerCapture(event.pointerId))world.releasePointerCapture(event.pointerId);};world.addEventListener('pointerup',endPointer);world.addEventListener('pointercancel',endPointer);
  world.addEventListener('wheel',event=>{
    if(!event.deltaY)return;event.preventDefault();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?world.clientHeight:1),zoom=Math.round(Math.max(.7,Math.min(1.8,cameraState.zoom*Math.exp(-delta*.0012)))*1000)/1000;
    const p=cameraPoint(event),bounds=ZONES[activeZone].view,cx=bounds[0]+bounds[2]/2,cy=bounds[1]+bounds[3]/2,ratio=zoom/cameraState.zoom;
    setCamera({zoom,x:p.x-cx-(p.x-cx-cameraState.x)*ratio,y:p.y-cy-(p.y-cy-cameraState.y)*ratio});
  },{passive:false});
  world.addEventListener('dblclick',event=>{if(!event.target.closest('[role="button"]'))setCamera({zoom:1,x:0,y:0});});
  function setCamera(patch){Object.assign(cameraState,patch);cameraState.zoom=Math.round(Math.max(.7,Math.min(1.8,cameraState.zoom))*1000)/1000;transformCamera();}
  function drawTooltip(actor,point){
    tooltip?.remove();const x=point[0]+(point[0]>1000?-220:75),y=point[1]-118;
    tooltip=svg('g',{class:'station-tooltip','pointer-events':'none'},svg('rect',{x,y,width:225,height:75,rx:12,fill:'#fffffc',stroke:'#d6dfd9','stroke-width':1.2}),text(x+14,y+23,short(actor.task.title,14),{fill:'#374b49','font-size':15,'font-weight':650}),text(x+14,y+44,labels[actor.state]||'待核实',{fill:'#6e8677','font-size':12}),text(x+14,y+61,short(actor.task.latestProgress||actor.task.stateEvidence||'点击查看任务',23),{fill:'#89938e','font-size':10.5}));overlays.append(tooltip);
  }
  function bubble(actor,time){
    if(courier||hovered||!actor.speechProfile)return;speech?.remove();const station=stations.get(actor.taskId);if(!station)return;
    const[x,y]=actor.visual?.mobile?actor.visual.position:station.point,candidates=[{x:x+90,y:y-165},{x:x-350,y:y-165},{x:x-130,y:y-220}],w=260,h=86;
    const blockers=[...stations.values()].filter(s=>s!==station).map(s=>({x:s.point[0]-85,y:s.point[1]-65,w:185,h:170}));
    blockers.push({x:130,y:50,w:430,h:310},{x:scene.boss[0]-120,y:scene.boss[1]-110,w:280,h:240});
    const overlap=(a,b)=>Math.max(0,Math.min(a.x+w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+h,b.y+b.h)-Math.max(a.y,b.y));
    const chosen=candidates.map(p=>({x:Math.max(40,Math.min(1920,p.x)),y:Math.max(-80,p.y)})).sort((a,b)=>blockers.reduce((n,r)=>n+overlap(a,r),0)-blockers.reduce((n,r)=>n+overlap(b,r),0))[0];
    const letters=Array.from(actor.speechProfile.speech);speech=svg('g',{class:'ambient-speech','data-ambient-line':actor.speechProfile.speech,'pointer-events':'none'},path(`M${chosen.x+w/2} ${chosen.y+h-3} ${x-10} ${y-9}`,'none',{stroke:'#d4dccf','stroke-width':1.3}),svg('rect',{...chosen,width:w,height:h,rx:13,fill:actor.speechProfile.kind==='working'?'#f2f8fa':'#fffcf2',stroke:'#d6dfd6','stroke-width':1.2}),text(chosen.x+15,chosen.y+19,'工位闲聊',{fill:'#98a59f','font-size':10.5}),text(chosen.x+15,chosen.y+45,letters.slice(0,13).join(''),{fill:'#536b67','font-size':16.5}),text(chosen.x+15,chosen.y+69,letters.slice(13).join(''),{fill:'#536b67','font-size':16.5}));overlays.append(speech);speechUntil=time+5.5;
  }
  function clearCourier(){bossNode.classList.remove('receiving-report');if(!courier)return;courier.station.actor.reporting=false;courier.station.actor.rig.node.setAttribute('visibility','visible');courier.node.remove();courier.trace.remove();courier=null;}
  function startReport(flow,time){
    if(courier||appearance.motion==='off'||model.stale||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const station=stations.get(flow.taskId);if(!station||!life.isHome(flow.taskId))return;const route=deliveryRoute(scene,station.index);if(route.length<2)return;
    const rig=createCharacter(flow.taskId,{standing:true}),node=svg('g',{class:'report-courier','aria-hidden':'true','data-report-task':flow.taskId}),anchor=svg('g',{transform:'translate(0 -44)'});anchor.append(rig.node);node.append(ellipse(0,1,17,7,scene.id==='orbital'?'#142c39':'#78938e',{opacity:.18}),anchor);
    const trace=path('M'+route.map(p=>p.join(' ')).join('L'),'none',{stroke:flow.type==='review'?'#bda26c':scene.palette.accent,'stroke-width':2.1,'stroke-dasharray':'4 8',opacity:.5,class:'report-trail'});
    station.actor.reporting=true;station.actor.rig.node.setAttribute('visibility','hidden');speech?.remove();speech=null;floorEffects.append(trace);depthLayer.append(node);
    const length=route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-route[i][0],p[1]-route[i][1]),0),duration=Math.max(2.2,length/110);courier={rig,node,route,trace,length,start:time,duration,station,label:flow.label};
  }
  const loop=createMotionLoop(container,actors,()=>({...appearance,stale:!!model.stale,suspended:!!document.querySelector('dialog[open]')}), (time,intensity)=>{
    if(speech&&(time>speechUntil||!appearance.bubbles||!intensity||hovered)){speech.remove();speech=null;}
    if(courier){const age=time-courier.start,d=courier.duration;if(age>d*2+1){clearCourier();return;}
      const progress=age<d?age/d:age<d+1?1:1-(age-d-1)/d,position=pointAlong(courier.route,progress);
      courier.node.setAttribute('transform',`translate(${position[0]} ${position[1]})`);const nextPosition=pointAlong(courier.route,Math.min(1,Math.max(0,progress+(age<d?.005:-.005)))),dx=nextPosition[0]-position[0],dy=nextPosition[1]-position[1],distance=Math.hypot(dx,dy)||1,facing=dx>0?-1:1;courier.node.querySelector('.character').parentElement.setAttribute('transform',`translate(0 -44) scale(${facing} 1)`);courier.rig.apply(poseAt(age>=d&&age<d+1?'standing':'walking',((age<d?progress:1-progress)*courier.length)/76,{intensity}),age>=d&&age<d+1?'standing':'walking',time,{stance:1,intensity,distance:(age<d?progress:1-progress)*courier.length,heading:[dx/distance,dy/distance],facing});
      const before=layers.find(item=>item.y>position[1])?.node||null;if(courier.node.nextSibling!==before)depthLayer.insertBefore(courier.node,before);bossNode.classList.toggle('receiving-report',age>=d&&age<d+1);
    }
  },bubble,(time,intensity)=>{
    signals=life.tick(time,actors,{allowTravel:intensity>0&&!courier});
    for(const actor of actors){if(actor.boss){actor.visual={direction:model.reviews?.length?'screen':'free'};continue;}const visual=signals.get(actor.taskId);actor.visual=visual;
      let mobile=mobileActors.get(actor.taskId);
      if(visual?.mobile){
        if(!mobile){const node=svg('g',{class:'leisure-person',role:'button',tabindex:0,'data-task-id':actor.taskId}),anchor=svg('g',{class:'mobile-person-anchor'}),caption=text(0,-116,'',{'text-anchor':'middle',fill:scene.palette.ink,'font-size':12.5,'font-weight':600,stroke:scene.palette.floor,'stroke-width':3,'paint-order':'stroke','class':'life-caption'});node.append(ellipse(0,3,21,8,scene.id==='orbital'?'#162c38':'#66877b',{opacity:.18}),anchor,caption);activate(node,()=>onSelect(actor.task));anchor.append(actor.rig.node);depthLayer.append(node);node.addEventListener('pointerenter',()=>{hovered=actor.taskId;options.onHighlight?.(actor.taskId);drawTooltip(actor,actor.visual.position);});node.addEventListener('pointerleave',()=>{hovered=null;options.onHighlight?.(null);tooltip?.remove();tooltip=null;});mobile={node,anchor,caption};mobileActors.set(actor.taskId,mobile);}
        mobile.node.setAttribute('transform',`translate(${visual.position[0]} ${visual.position[1]})`);mobile.anchor.setAttribute('transform',`translate(0 ${-37-7*visual.stance}) scale(${visual.facing} 1)`);mobile.node.dataset.phase=visual.phase;mobile.node.dataset.activity=visual.label||'';if(mobile.caption.textContent!==visual.label)mobile.caption.textContent=visual.label||'';mobile.node.setAttribute('aria-label',actor.task.title+'，空闲日常：'+visual.label);
        const before=layers.find(item=>item.y>visual.position[1])?.node||null;depthLayer.insertBefore(mobile.node,before);actor.node.classList.add('person-away');
      }else if(mobile){actor.anchor.append(actor.rig.node);mobile.node.remove();mobileActors.delete(actor.taskId);actor.node.classList.remove('person-away');}
    }
    container.dataset.leisureCount=String([...signals.values()].filter(s=>s.phase==='rest').length);
  });
  transformCamera();
  function update(newTasks,newModel){
    model=newModel;appearance=normalizeAppearance(newModel.appearance||appearance);container.classList.toggle('scene-still',appearance.motion==='off'||!!model.stale||matchMedia('(prefers-reduced-motion: reduce)').matches);container.classList.toggle('scene-calm',appearance.motion==='calm');
    const byId=new Map(newTasks.filter(Boolean).map(t=>[t.id,t]));
    for(const[id,station]of stations){const task=byId.get(id);if(!task)continue;const actor=station.actor,old=actor.state;actor.state=task.runState;actor.task=task;
      if(old!==task.runState){station.node.classList.remove('station-'+old);station.node.classList.add('station-'+task.runState);}
      station.node.setAttribute('aria-label',task.title+'，'+(labels[task.runState]||'待核实'));station.node.querySelector('title').textContent=task.title+' · '+(labels[task.runState]||'待核实');
      station.node.querySelector('.state-marker').setAttribute('aria-hidden',String(!['waiting_input','waiting_approval','unknown','error','interrupted'].includes(task.runState)));station.node.querySelector('.state-marker').setAttribute('visibility',['waiting_input','waiting_approval','unknown','error','interrupted'].includes(task.runState)?'visible':'hidden');
      station.node.querySelector('.state-marker text').textContent=task.runState==='waiting_input'?'?':task.runState==='unknown'?'…':'!';
      if(hovered===id)drawTooltip(actor,station.point);
      const at=Math.max(task.lastActivityAt||0,task.updatedAt||0),previous=Number(station.node.dataset.activityAt||0);station.node.dataset.activityAt=String(at);
      if(previous&&at>previous&&['active','recent'].includes(task.runState)){station.node.classList.remove('activity-flash');requestAnimationFrame(()=>{if(!disposed)station.node.classList.add('activity-flash');});}
    }
    const c=model.counts||{};world.querySelector('[data-screen="states-main"]').textContent=`执行中 ${c.processing||0}    待你处理 ${c.attention||0}    草稿 ${c.draft||0}`;world.querySelector('[data-screen="states-more"]').textContent=`待办 ${c.todo||0}    复核通过 ${c.done||0}    待核实 ${c.unverified||0}`;
    const drafts=model.drafts||[],signature=JSON.stringify(drafts.slice(0,3).map(t=>[t.id,t.title]));if(screenSignature!==signature){screenSignature=signature;const group=world.querySelector('[data-screen="drafts"]');group.replaceChildren(...(drafts.length?drafts.slice(0,3).map((task,i)=>{const row=text(15,101+i*19,'· '+short(task.title,21),{fill:'#e1ece5','font-size':14.5,role:'button',tabindex:0,'aria-label':'草稿：'+task.title});activate(row,()=>onSelect(task));return row;}):[text(15,111,'点击大屏，记下你的下一个想法',{fill:'#a7c1bd','font-size':14.5})]));}
    const reviews=model.reviews||[];world.querySelector('[data-boss-wall="name"]').textContent=short(appearance.officeName,22);world.querySelector('[data-boss-wall="summary"]').textContent=`执行中 ${c.processing||0}  ·  待你决定 ${reviews.length}  ·  草稿 ${c.draft||0}`;world.querySelector('[data-boss-wall="requests"]').replaceChildren(...(reviews.length?reviews.slice(0,2).map((t,i)=>text(15,84+i*24,'· '+short(t.title,22),{fill:'#e0e9db','font-size':14})):[text(15,88,'暂时没有需要你决定的事项',{fill:'#bdd1c4','font-size':14}),text(15,114,'任务进展和草稿都在这里汇合',{fill:'#96b2ac','font-size':12})]));const bossSig=JSON.stringify([appearance.bossName,reviews.slice(0,2).map(t=>[t.id,t.title]),reviews.length]);if(bossSig!==bossSignature){bossSignature=bossSig;world.querySelector('[data-screen="boss-heading"]').textContent=reviews.length?'待你决定 · '+reviews.length:'你的审核台';world.querySelector('[data-screen="reviews"]').replaceChildren(...(reviews.length?reviews.slice(0,2).map((task,i)=>text(11,56+i*20,short(task.title,10),{fill:'#60755d','font-size':12})):[text(11,62,'暂时没有待决定事项',{fill:'#80917b','font-size':12})]),text(11,94,'点击电脑查看',{fill:'#93a18e','font-size':10}));world.querySelector('[data-boss="name"]').textContent=short(appearance.bossName,5);world.querySelector('[data-boss="name-title"]').textContent=appearance.bossName+' · 老板';nameplate.setAttribute('aria-label',appearance.bossName+'的桌面名牌');bossNode.querySelector('.boss-notification').setAttribute('visibility',reviews.length?'visible':'hidden');bossNode.setAttribute('aria-label',appearance.bossName+' · 老板，'+(reviews.length?reviews.length+' 项需要你决定':'暂无待审核事项'));bossNode.classList.toggle('has-review',reviews.length>0);}
    const now=new Date(),minute=now.getMinutes();if(minute!==clockMinute){clockMinute=minute;world.querySelector('[data-clock="minute"]').setAttribute('transform','rotate('+(minute*6)+')');world.querySelector('[data-clock="hour"]').setAttribute('transform','rotate('+((now.getHours()%12)*30+minute*.5)+')');}
    for(const flow of model.flows||[]){if(seenFlows.has(flow.id))continue;seenFlows.add(flow.id);if(seenFlows.size>300)seenFlows.delete(seenFlows.values().next().value);if(Date.now()-flow.at<6500&&!courier)startReport(flow,loop.time());}
    if(appearance.motion==='off'||model.stale){clearCourier();speech?.remove();speech=null;}loop.sync();loop.draw();
  }
  return{scene,update,camera(patch){setCamera(patch);},reset(){activeZone='all';setCamera({zoom:1,x:0,y:0});},zone(id){activeZone=ZONES[id]?id:'all';setCamera({zoom:1,x:0,y:0});},highlight(id){for(const[key,station]of stations)station.node.classList.toggle('station-selected',key===id);for(const[key,mobile]of mobileActors)mobile.node.classList.toggle('selected',key===id);},dispose(){disposed=true;clearCourier();loop.dispose();life.dispose();speech?.remove();}};
}
export function renderOffice(container,tasks,labels,onSelect,options={}){controllers.get(container)?.dispose();controllers.set(container,createController(container,tasks,labels,onSelect,options));}
export function updateOfficeActivity(container,tasks,model={}){controllers.get(container)?.update(tasks,model);}
export function setOfficeCamera(container,patch){controllers.get(container)?.camera(patch);}
export function resetOfficeCamera(container){controllers.get(container)?.reset();}
export function highlightOfficeTask(container,id){controllers.get(container)?.highlight(id);}

export function setOfficeZone(container,id){controllers.get(container)?.zone(id);}
