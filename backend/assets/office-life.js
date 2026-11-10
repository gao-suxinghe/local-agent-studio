import {avatarIdentity} from './motion-model.js';
import {findRoute,leisureRoute,homePoint,pointAlong,routeLength,blockedAt} from './navigation.js';
export const canRelax=state=>state==='idle';
const walkingSpeed=76;
const smooth=n=>n*n*(3-2*n);
const activityLabels={cafe:'喝咖啡',gaming:'打游戏',workout:'健身',music:'听音乐',phone:'看手机'};

// Pure visual choreography. It never writes task state or sends execution actions.
export function createOfficeLife(scene){
  const people=new Map(),occupied=new Map(),visits=new Map();let last=0;
  function person(actor,time){
    if(!people.has(actor.taskId)){
      const seed=Math.round(avatarIdentity(actor.taskId).phase*89);
      people.set(actor.taskId,{id:actor.taskId,index:actor.index,seed,phase:'desk',next:time+4+seed%10,cycle:0,position:homePoint(scene,actor.index),facing:1});
    }return people.get(actor.taskId);
  }
  function walk(p,route,time,returning){p.route=route;p.distance=routeLength(route);p.progress=0;p.walkTime=time;p.phase=returning?'return':'out';p.started=time;p.blockedFor=0;}
  function release(p){if(p.facility&&occupied.get(p.facility.id)===p.id)occupied.delete(p.facility.id);p.facility=null;}
  function returnHome(p,time){if([...people.values()].some(q=>q!==p&&['out','return','rise','sit'].includes(q.phase))){p.phase='waiting-return';return;}const route=findRoute(scene,p.position,homePoint(scene,p.index));if(route.length>1){release(p);walk(p,route,time,true);}else if(Math.hypot(p.position[0]-homePoint(scene,p.index)[0],p.position[1]-homePoint(scene,p.index)[1])<2){release(p);p.phase='desk';p.next=time+14;}}
  function tick(time,actors,{allowTravel=true}={}){
    const dt=Math.max(0,Math.min(.15,time-last));last=time;const signals=new Map();
    for(const actor of actors.filter(a=>!a.boss))person(actor,time);
    for(const actor of actors.filter(a=>!a.boss)){
      const p=people.get(actor.taskId),idle=canRelax(actor.state)&&!actor.reporting;
      if(!idle&&['out','rise','rest'].includes(p.phase))returnHome(p,time);
      if(p.phase==='waiting-return'&&allowTravel)returnHome(p,time);
      if(p.phase==='desk'){
        p.position=homePoint(scene,p.index);
        if(idle&&allowTravel&&time>=p.next){
          p.cycle++;p.next=time+18+(p.seed+p.cycle*7)%18;
          const travellers=[...people.values()].filter(q=>['out','return','rise','sit'].includes(q.phase)).length;
          if(travellers<1&&![...people.values()].some(q=>q.phase==='waiting-return')&&(p.seed+p.cycle)%4!==0){
            const start=(p.seed+p.cycle)%scene.facilities.length;
            const choices=scene.facilities.map((_,i)=>scene.facilities[(start+i)%scene.facilities.length]).sort((a,b)=>(visits.get(a.id)||0)-(visits.get(b.id)||0));
            for(const facility of choices){if(occupied.has(facility.id))continue;
              const route=leisureRoute(scene,p.index,facility.id);if(route.length<2)continue;
              p.facility=facility;occupied.set(facility.id,p.id);visits.set(facility.id,(visits.get(facility.id)||0)+1);p.route=route;p.phase='rise';p.started=time;break;
            }
          }
        }
      }
      if(p.phase==='rise'&&time-p.started>=.55)walk(p,p.route,time,false);
      if(p.phase==='out'||p.phase==='return'){
        const previous=p.position,next=Math.min(1,p.progress+(allowTravel?dt:0)*walkingSpeed/(p.distance||1)),candidate=pointAlong(p.route,next);
        const nearby=[...people.values()].find(q=>q!==p&&['out','return','rise','sit'].includes(q.phase)&&Math.hypot(candidate[0]-q.position[0],candidate[1]-q.position[1])<34);
        let target=candidate;
        if(nearby){
          p.blockedFor+=dt;
          const dx=candidate[0]-previous[0],dy=candidate[1]-previous[1],d=Math.hypot(dx,dy)||1,side=p.id<nearby.id?1:-1;
          const detour=[candidate[0]-dy/d*27*side,candidate[1]+dx/d*27*side];
          if(p.blockedFor>.5&&!blockedAt(scene,detour,{padding:15})&&Math.hypot(detour[0]-nearby.position[0],detour[1]-nearby.position[1])>35)target=detour;else target=previous;
        }else p.blockedFor=0;
        if(target!==previous){p.progress=next;p.position=target;const stepLength=Math.hypot(target[0]-previous[0],target[1]-previous[1])||1;p.heading=[(target[0]-previous[0])/stepLength,(target[1]-previous[1])/stepLength];const dx=target[0]-previous[0];if(Math.abs(dx)>.15)p.facing=dx>0?-1:1;}
        p.moving=target!==previous;
        if(p.progress>=1){
          p.position=p.route.at(-1);
          if(p.phase==='return'){p.phase='sit';p.started=time;}
          else{p.phase='rest';p.started=time;p.until=time+16+(p.seed+p.cycle*11)%19;p.facing=1;}
        }
      }
      if(p.phase==='rest'&&time>=p.until&&allowTravel)returnHome(p,time);
      if(p.phase==='sit'&&time-p.started>=.55){p.phase='desk';p.next=time+16+p.seed%18;}
      const mobile=p.phase!=='desk',rest=p.phase==='rest',f=p.facility;
      const stance=p.phase==='rise'?smooth(Math.min(1,(time-p.started)/.55)):p.phase==='sit'?1-smooth(Math.min(1,(time-p.started)/.55)):rest?(f?.standing?1:1-smooth(Math.min(1,(time-p.started)/.55))):1;
      const mode=p.phase==='waiting-return'?'standing':['rise','sit'].includes(p.phase)?'neutral':rest?(f?.id==='sofa'?((p.seed+p.cycle)%2?'phone':'music'):f?.mode):mobile?(p.moving===false&&['out','return'].includes(p.phase)?'standing':'strolling'):null;
      const label=rest?activityLabels[mode]||'休息':['return','sit','waiting-return'].includes(p.phase)?'回工位':mobile?'去休闲区':null;
      signals.set(p.id,{phase:p.phase,mobile,position:[...p.position],stance,facing:rest?1:p.facing,mode,label,facility:f?.id,atHome:p.phase==='desk',moving:p.moving!==false,distance:(p.progress||0)*(p.distance||0),heading:p.heading||[-1,0]});
    }
    return signals;
  }
  return{tick,isHome:id=>!people.has(id)||people.get(id).phase==='desk',occupied:()=>Object.fromEntries(occupied),dispose(){people.clear();occupied.clear();visits.clear();}};
}
