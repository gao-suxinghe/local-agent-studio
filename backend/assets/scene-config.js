// All rooms and furniture use the same ground-plane projection.
export const ground=(x,z)=>[40+x+z,460-.379*x+.546*z];
export const groundPoint=([x,y])=>{const sum=x-40,z=(y-460+.379*sum)/.925;return[sum-z,z];};
const rect=(x,z,w,d)=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]].map(p=>ground(...p));
const floor=rect(0,0,1180,940);
export const ZONES=Object.freeze({
  all:{id:'all',name:'空间总览',view:[0,-185,2220,1200]},
  work:{id:'work',name:'主办公区',floor:rect(0,0,690,940),view:[25,30,1440,1030]},
  boss:{id:'boss',name:'老板办公室',floor:rect(690,0,490,430),view:[690,-185,1080,760]},
  leisure:{id:'leisure',name:'休闲区',floor:rect(690,430,490,510),view:[1120,155,1100,670]}
});
const partition=(a,b)=>({a:ground(...a),b:ground(...b)});
const partitions=[partition([690,0],[690,250]),partition([690,390],[690,650]),partition([690,820],[690,940]),partition([690,430],[735,430]),partition([895,430],[1180,430])];
const facilities=[
  {id:'coffee',name:'咖啡吧',mode:'cafe',point:ground(1025,615),at:ground(1050,475),standing:false},
  {id:'game',name:'游戏角',mode:'gaming',point:ground(910,835),at:ground(900,720),standing:false},
  {id:'gym',name:'健身垫',mode:'workout',point:ground(1110,760),at:ground(1110,760),standing:true},
  {id:'sofa',name:'休息沙发',mode:'music',point:ground(825,590),at:ground(825,520),standing:false}
];
const shared={floor,boss:ground(945,175),display:[100,238],partitions,facilities,zones:ZONES,
  view:ZONES.all.view,obstacles:[],plants:[[50,65,.82],[1130,55,.82],[1140,465,.7],[1150,915,.85],[40,850,.85]].map(([x,z,s])=>[...ground(x,z),s])};
const layout=(dx=0,dz=0)=>[160,365,570,775].flatMap((z,i)=>[185,490].map((x,j)=>ground(x+(j?dx:-dx),z+(i%2?dz:-dz))));
export const SCENES=Object.freeze({
  city:{...shared,id:'city',name:'城市工作室',subtitle:'落地窗、玻璃办公室和有生活气息的休闲角',symbol:'city',points:layout(),environment:'skyline',
    palette:{floor:'#e9efed',edge:'#a5b7b8',wall:'#dae5e8',wallSide:'#e4ecec',desk:'#fcfdfb',deskSide:'#bfced0',monitor:'#4c6470',screen:'#d6e8e5',ink:'#48615e',chair:'#839fac',accent:'#638e7b',window:'#c9dfe9'}},
  garden:{...shared,id:'garden',name:'花园工坊',subtitle:'木作工位、独立会客室与庭院休闲区',symbol:'leaf',points:layout(10,8),environment:'courtyard',
    palette:{floor:'#e7ebdb',edge:'#a8b396',wall:'#dfe8d8',wallSide:'#e5ecdc',desk:'#e2caa3',deskSide:'#b59b78',monitor:'#5f725d',screen:'#dceacc',ink:'#4e674d',chair:'#87a180',accent:'#6b9162',window:'#b8d4aa'}},
  orbital:{...shared,id:'orbital',name:'星际夜班',subtitle:'指挥工位、舰长办公室与太空休息舱',symbol:'orbit',points:layout(-10,-6),environment:'starfield',
    palette:{floor:'#334b59',edge:'#233b4b',wall:'#263f51',wallSide:'#2d4758',desk:'#54717f',deskSide:'#354e60',monitor:'#9bbdc7',screen:'#b8dcd9',ink:'#d4e6e6',chair:'#708f9e',accent:'#9bc7b4',window:'#132b3e'}}
});
export const SCENE_IDS=Object.freeze(Object.keys(SCENES));
export const DEFAULT_APPEARANCE=Object.freeze({scene:'city',motion:'lively',bubbles:true,bossName:'你',officeName:'办公室',revision:0});
export const CAPACITY=8;
export const BOSS_DESK_SCALE=1.55;
export function normalizeAppearance(value={}){
  return {scene:SCENE_IDS.includes(value?.scene)?value.scene:'city',motion:['calm','lively','off'].includes(value?.motion)?value.motion:'lively',
    officeName:String(value?.officeName||'办公室').trim().slice(0,32)||'办公室',bubbles:typeof value?.bubbles==='boolean'?value.bubbles:true,bossName:String(value?.bossName||'你').trim().slice(0,18)||'你',revision:Number.isInteger(value?.revision)&&value.revision>=0?value.revision:0};
}
export function insideFloor(point,polygon){
  let inside=false;const[x,y]=point;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const[a,b]=polygon[i],[c,d]=polygon[j];if(((b>y)!==(d>y))&&(x<(c-a)*(y-b)/(d-b)+a))inside=!inside;
  }return inside;
}
const rank=t=>['waiting_input','waiting_approval'].includes(t.runState)?0:['starting','active','recent','stopping'].includes(t.runState)?1:t.runState==='error'?2:t.runState==='todo'?3:t.runState==='draft'?4:t.runState==='idle'?5:6;
export function seatPage(tasks,{page=0,mode='all',previous=[]}={}){
  const eligible=tasks.filter(t=>t.kind!=='idea'&&(mode!=='focus'||['processing','attention','todo','draft'].includes(t.boardLane)));
  const sorted=[...eligible].sort((a,b)=>rank(a)-rank(b)||(b.priority||0)-(a.priority||0)||(b.createdAt||0)-(a.createdAt||0)||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(sorted.length/CAPACITY)),current=Math.max(0,Math.min(pages-1,Math.floor(page)||0));
  const wanted=new Map(sorted.slice(current*CAPACITY,(current+1)*CAPACITY).map(t=>[t.id,t]));
  const slots=Array.from({length:CAPACITY},(_,i)=>wanted.has(previous[i])?previous[i]:null);
  for(const t of wanted.values())if(!slots.includes(t.id))slots[slots.indexOf(null)]=t.id;
  return {tasks:slots.map(id=>wanted.get(id)||null),slots,page:current,pages,total:eligible.length,start:eligible.length?current*CAPACITY+1:0,end:Math.min((current+1)*CAPACITY,eligible.length)};
}
