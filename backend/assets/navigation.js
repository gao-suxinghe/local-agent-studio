import {insideFloor,ground,BOSS_DESK_SCALE} from './scene-config.js';
const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const table=([x,y],scale=1)=>[[-88,-12],[8,-48],[101,3],[4,43]].map(([a,b])=>[x+a*scale,y+b*scale]);
const shapes=new WeakMap(),routes=new WeakMap();
function geometry(scene){
  if(shapes.has(scene))return shapes.get(scene);
  const rectangles=[...scene.obstacles];
  for(const f of scene.facilities||[]){const[x,y]=f.point,[ax,ay]=f.at;
    if(f.id==='coffee')rectangles.push({x:ax-80,y:ay+5,w:175,h:55});
    if(f.id==='game')rectangles.push({x:ax-85,y:ay+6,w:163,h:30},{x:x-29,y:y-65,w:58,h:44});
    if(f.id==='sofa')rectangles.push({x:x-72,y:y-59,w:144,h:36});
    if(f.id==='gym')rectangles.push({x:x+45,y:y-67,w:42,h:36});
  }
  const guest=ground(1075,345);rectangles.push({x:guest[0]-50,y:guest[1]-14,w:100,h:44});
  const result={rectangles,polygons:[...scene.points.map(p=>table(p)),table(scene.boss,BOSS_DESK_SCALE)]};shapes.set(scene,result);return result;
}
export function blockedAt(scene,point,{occupied=scene.points,padding=13}={}){
  const[x,y]=point,radius=padding-1;
  if(![[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]].every(p=>insideFloor(p,scene.floor)))return true;
  const data=geometry(scene),polygons=occupied===scene.points?data.polygons:[...occupied.map(p=>table(p)),table(scene.boss,BOSS_DESK_SCALE)];
  for(const p of polygons)if(insideFloor(point,p)||p.some((a,i)=>distance(point,a,p[(i+1)%p.length])<padding))return true;
  if(occupied.some(p=>Math.hypot(x-p[0]+6,y-p[1]-61)<17+padding))return true;
  if(Math.hypot((x-scene.boss[0]+5)/(35+padding),(y-scene.boss[1]-70)/(20+padding))<1)return true;
  if((scene.plants||[]).some(p=>Math.hypot((x-p[0])/(18*p[2]+padding),(y-p[1])/(9*p[2]+padding))<1))return true;
  if((scene.partitions||[]).some(p=>distance(point,p.a,p.b)<padding+3))return true;
  return data.rectangles.some(r=>x>=r.x-radius&&x<=r.x+r.w+radius&&y>=r.y-radius&&y<=r.y+r.h+radius);
}
class Heap{
  values=[];
  push(value){let i=this.values.length;this.values.push(value);while(i){const p=(i-1)>>1;if(this.values[p].f<=value.f)break;this.values[i]=this.values[p];i=p;}this.values[i]=value;}
  pop(){const first=this.values[0],last=this.values.pop();if(this.values.length){let i=0;while(true){let child=i*2+1;if(child>=this.values.length)break;if(child+1<this.values.length&&this.values[child+1].f<this.values[child].f)child++;if(this.values[child].f>=last.f)break;this.values[i]=this.values[child];i=child;}this.values[i]=last;}return first;}
  get length(){return this.values.length;}
}
const key=p=>p.join(',');
export const homePoint=(scene,index)=>[scene.points[index][0]-6,scene.points[index][1]+95];
export const routeLength=route=>route.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-route[i][0],p[1]-route[i][1]),0);
export function findRoute(scene,from,to){
  let cache=routes.get(scene);if(!cache){cache=new Map();routes.set(scene,cache);}
  const cacheKey=key(from)+'>'+key(to);if(cache.has(cacheKey))return cache.get(cacheKey);
  const step=16,padding=14,grid=new Map(),blocked=p=>{const k=key(p);if(!grid.has(k))grid.set(k,blockedAt(scene,p,{padding}));return grid.get(k);};
  const clear=(a,b)=>{const count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/5));for(let i=0;i<=count;i++)if(blocked([a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count]))return false;return true;};
  if(blocked(from)||blocked(to)){cache.set(cacheKey,[]);return[];}
  function near(p){const candidates=[];for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){const q=[Math.round(p[0]/step)*step+dx*step,Math.round(p[1]/step)*step+dy*step];if(!blocked(q)&&clear(p,q))candidates.push(q);}return candidates.sort((a,b)=>Math.hypot(a[0]-p[0],a[1]-p[1])-Math.hypot(b[0]-p[0],b[1]-p[1]))[0];}
  const start=near(from),end=near(to);if(!start||!end){cache.set(cacheKey,[]);return[];}
  const startKey=key(start),endKey=key(end),open=new Heap(),came=new Map(),g=new Map([[startKey,0]]),nodes=new Map([[startKey,start]]),closed=new Set();open.push({p:start,f:Math.hypot(start[0]-end[0],start[1]-end[1])});
  const offsets=[[step,0],[-step,0],[0,step],[0,-step],[step,step],[step,-step],[-step,step],[-step,-step]];
  while(open.length&&closed.size<22000){
    const current=open.pop().p,k=key(current);if(closed.has(k))continue;
    if(k===endKey){let route=[to,end],at=k;while(came.has(at)){at=came.get(at);route.push(nodes.get(at));}route.push(from);route.reverse();route=route.filter((p,i)=>!i||Math.hypot(p[0]-route[i-1][0],p[1]-route[i-1][1])>.1);
      const smooth=[route[0]];let i=0;while(i<route.length-1){let j=route.length-1;while(j>i+1&&!clear(route[i],route[j]))j--;smooth.push(route[j]);i=j;}cache.set(cacheKey,smooth);return smooth;
    }
    closed.add(k);
    for(const[dx,dy]of offsets){const next=[current[0]+dx,current[1]+dy],n=key(next);if(closed.has(n)||blocked(next)||!clear(current,next))continue;const score=g.get(k)+Math.hypot(dx,dy);if(score>=(g.get(n)??Infinity))continue;came.set(n,k);g.set(n,score);nodes.set(n,next);open.push({p:next,f:score+Math.hypot(next[0]-end[0],next[1]-end[1])});}
  }
  cache.set(cacheKey,[]);return[];
}
export function deliveryRoute(scene,index){if(!scene.points[index])return[];return findRoute(scene,homePoint(scene,index),[scene.boss[0]-95,scene.boss[1]+92]);}
export function leisureRoute(scene,index,facilityId){const f=scene.facilities.find(f=>f.id===facilityId);return f?findRoute(scene,homePoint(scene,index),f.point):[];}
export function pointAlong(route,progress){
  if(!route.length)return[0,0];const total=routeLength(route);let remaining=Math.max(0,Math.min(1,progress))*total;
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(remaining<=length){const t=length?remaining/length:0;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}remaining-=length;}return route.at(-1);
}
