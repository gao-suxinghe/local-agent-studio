import {BOSS_DESK_SCALE} from './scene-config.js';
import {zoneFloors,zoneSigns,glassPartitions,loungeFurniture,bossWallDisplay} from './zone-art.js';
import {svg,path,ellipse,line,text,shade} from './svg.js';
export {svg,path,ellipse,line,text} from './svg.js';
let sequence=0;
const polygon=points=>points.map(p=>p.join(' ')).join(' ');
export function plant(x,y,scale=1,night=false){
  const g=svg('g',{transform:`translate(${x} ${y}) scale(${scale})`,class:'room-plant'}),anchor=svg('g',{transform:'translate(0 -29)'}),leaves=svg('g',{class:'plant-leaves'});
  g.append(ellipse(0,3,24,9,night?'#152e3c':'#82999d',{opacity:.12}),path('M-15-31H15L11-4Q0 5-11-4Z',night?'#65808e':'#cedbd6'),ellipse(0,-31,15,6,night?'#a4bcb9':'#e8eee7'),ellipse(0,-30,11,4,'#8e9c83'));
  leaves.append(path('M0 0Q-32-20-24-48Q-5-42 0 0',night?'#7caaa0':'#7da48a'),path('M0 0Q34-24 26-61Q5-53 0 0',night?'#91bcb2':'#6b977c'),path('M0-2Q-12-49 2-72Q22-49 0-2',night?'#a6d0b9':'#9db899'),line(0,0,0,-53,night?'#91b9a8':'#64866a',1.5));
  anchor.append(leaves);g.append(anchor);return g;
}
export function chair(scene,x=0,y=61,scale=1){
  const c=scene.palette,g=svg('g',{transform:`translate(${x} ${y}) scale(${scale})`});
  g.append(ellipse(0,22,22,8,scene.id==='orbital'?'#142b39':'#8aa0a7',{opacity:.12}),path('M-18-16Q0-28 18-16L14 4Q0 13-14 4Z',c.chair),ellipse(0,-16,18,7,shade(c.chair,1.12)),ellipse(0,5,18,8,shade(c.chair,.93)),line(0,11,0,26,shade(c.chair,.8),4),path('M0 25-17 31m17-6 16 5m-16-5 0 12','none',{stroke:shade(c.chair,.78),'stroke-width':3,'stroke-linecap':'round'}),ellipse(-17,32,3,2,'#78909b'),ellipse(16,31,3,2,'#78909b'));return g;
}
export function executiveChair(scene,x=-5,y=70){
  const night=scene.id==='orbital',garden=scene.id==='garden',leather=night?'#425c70':garden?'#756650':'#425960',metal=night?'#9bb4be':'#b6c2bd',trim=garden?'#c7b18b':'#c2b18b',g=svg('g',{class:'executive-chair',transform:`translate(${x} ${y})`});
  g.append(ellipse(0,33,38,13,night?'#142a37':'#59766e',{opacity:.16}),line(0,9,0,29,metal,6),path('M0 28-29 39m29-11 28 10m-28-10-3 21m3-21-19-7m19 7 20-7','none',{stroke:metal,'stroke-width':4,'stroke-linecap':'round'}));
  for(const[a,b]of[[-29,39],[28,38],[-3,49],[-19,21],[20,21]])g.append(ellipse(a,b+1,5,3,night?'#233c4b':'#52696c'));
  g.append(path('M-26-61Q-28-83-7-86Q16-90 27-66L24-7Q0 8-25-8Z',shade(leather,.85)),path('M-21-59Q-19-78-4-80Q16-81 22-62L19-13Q-1-1-20-13Z',leather),path('M-17-55Q0-63 18-54M-18-34Q0-42 19-32M-17-16Q0-23 16-15','none',{stroke:shade(leather,1.22),'stroke-width':1.2}),svg('rect',{x:-18,y:-77,width:37,height:20,rx:8,fill:shade(leather,1.12),stroke:trim,'stroke-width':.8}),ellipse(0,-4,29,13,shade(leather,1.12)),path('M-28-5Q0 9 29-5L27 4Q0 19-27 4Z',leather),path('M-25 0Q0 12 25 0','none',{stroke:trim,'stroke-width':1.1}));
  g.append(path('M-31-22-31 0m62-24V0','none',{stroke:metal,'stroke-width':4}),path('M-35-26q10-5 18 3l1 8q-11-4-21 0Zm53-2q10-4 18 3l1 10q-10-5-20-1Z',leather),path('M-34-23q8-3 16 2m2-3q8-2 15 1','none',{stroke:trim,'stroke-width':1.1}));
  return g;
}
export function bossNameplate(scene){
  const night=scene.id==='orbital',garden=scene.id==='garden',node=svg('g',{class:'boss-nameplate',transform:'matrix(1 -.379 0 1 68 38)','aria-label':'老板桌面名牌'});
  node.append(path('M0 0H80L86 6H6Z',night?'#7896a2':garden?'#a58b62':'#9daea3'),path('M0-25H80V0H0Z',night?'#c5d6d5':'#f6f0dc',{stroke:night?'#90aeb3':'#c1b186','stroke-width':1.1}),path('M4-21H76','none',{stroke:night?'#e7efea':'#fffaf0','stroke-width':1.2}),text(40,-8,'你',{'text-anchor':'middle','data-boss':'name',fill:night?'#385361':'#5a624e','font-size':12.5,'font-weight':650}),svg('title',{'data-boss':'name-title'},'你的桌面名牌'));
  return node;
}

function windows(scene,uid){
  const c=scene.palette,g=svg('g',{transform:'matrix(1.33 .726 0 1 1250 -142)'});
  const clip=svg('clipPath',{id:uid+'-window'},svg('rect',{x:0,y:0,width:650,height:140,rx:scene.id==='orbital'?28:2}));
  g.append(svg('defs',{},clip));
  const view=svg('g',{'clip-path':'url(#'+uid+'-window)'});
  view.append(svg('rect',{x:0,y:0,width:650,height:140,fill:c.window}));
  if(scene.id==='city'){
    view.append(ellipse(120,26,60,13,'#f5f9f8',{opacity:.65,class:'window-cloud'}),ellipse(380,40,90,15,'#edf4f4',{opacity:.65,class:'window-cloud second-cloud'}));
    for(let i=0;i<12;i++){const x=i*58-5,h=30+(i*37)%75;view.append(svg('rect',{x,y:140-h,width:45,height:h,fill:i%2?'#adcad4':'#b7ced7'}));for(let row=0;row<Math.floor(h/15)-1;row++)for(let column=0;column<3;column++)view.append(svg('rect',{x:x+7+column*11,y:140-h+9+row*14,width:5,height:6,fill:'#dbe8e9',opacity:.8}));}
  }else if(scene.id==='garden'){
    view.append(path('M0 103Q120 40 240 98Q400 30 650 91V140H0Z','#a8c4a0'),path('M0 123Q150 88 300 127Q480 71 650 119V140H0Z','#91b58a'));
    for(const[x,h]of[[65,75],[180,61],[350,83],[520,65],[615,89]])view.append(line(x,140,x,140-h,'#8d9b7b',6),ellipse(x,115-h,25,37,'#87ac80'),ellipse(x-12,122-h,18,26,'#9bbb8e'));
    view.append(svg('g',{class:'garden-bird'},path('M250 30q8-10 16 0q7-10 15 0','none',{stroke:'#647f6d','stroke-width':2,'stroke-linecap':'round'})));
  }else{
    for(let i=0;i<42;i++)view.append(ellipse(12+(i*83)%630,7+(i*37)%124,i%4===0?1.8:1.1,i%4===0?1.8:1.1,'#cde8eb',{opacity:.35+(i%5)*.11,class:i%3===0?'orbit-star':''}));
    view.append(ellipse(347,66,48,48,'#7ea6b6'),path('M308 53Q344 21 385 49Q343 45 309 81Z','#a4c5cf',{opacity:.6}),svg('ellipse',{cx:347,cy:68,rx:78,ry:12,fill:'none',stroke:'#b4c9c7','stroke-width':5,transform:'rotate(-19 347 68)',opacity:.7}),path('M42 110 93 94 121 101 72 117Z','#607e94'),path('M90 94 102 68 113 74 111 101Z','#8ba4b4'));
  }
  g.append(view,svg('rect',{x:0,y:0,width:650,height:140,rx:scene.id==='orbital'?28:2,fill:'none',stroke:scene.id==='garden'?'#b6ad8e':scene.id==='orbital'?'#7995a6':'#f3f7f7','stroke-width':scene.id==='garden'?8:7}));
  if(scene.id==='garden')for(const x of[214,432])g.append(line(x,0,x,140,'#b6ad8e',8));
  else if(scene.id==='city')for(let i=1;i<8;i++)g.append(line(i*81,0,i*81,140,'#f0f6f6',5));
  else g.append(line(23,13,626,13,'#65899e',2),line(22,127,627,127,'#65899e',2));
  return g;
}
function meeting(scene){
  const c=scene.palette,g=svg('g',{transform:'translate(1195 627)'});
  g.append(ellipse(0,21,62,21,scene.id==='orbital'?'#19303d':'#9aa99f',{opacity:.12}),chair(scene,-49,11,.6),chair(scene,39,5,.6),path('M-24 0-22 31-17 34-16-1M23 0 23 27 29 24 30-1',c.deskSide),ellipse(0,-1,50,19,c.desk),ellipse(-18,-4,6,3,shade(c.deskSide,.9)),path('M2-13 26-3 14 3-10-7Z',scene.id==='garden'?'#b9c4a1':'#c4cdd0'));
  if(scene.id==='orbital')g.append(svg('ellipse',{cx:0,cy:-1,rx:42,ry:13,fill:'none',stroke:'#9bbfbd','stroke-width':1.2,opacity:.7}));return g;
}
function bookshelf(scene){
  const c=scene.palette,g=svg('g');g.append(path('M113 344 248 293 248 333 113 384Z',c.deskSide),path('M113 344 135 356 270 305 248 293Z',c.desk),path('M248 293 270 305V346L248 333Z',shade(c.deskSide,.9)));
  for(let i=0;i<8;i++)g.append(path(`M${135+i*13} ${353-i*4.9}v22l7-3v-22Z`,['#8ba7b2','#acb99c','#c4ac84','#9d9ab1'][i%4]));return g;
}
function gardenBed(){return svg('g',{},path('M900 375 975 348 1080 405 1005 433V451L900 393Z','#9caa86'),path('M900 375 975 348 1080 405 1005 433Z','#ced9b8'),path('M912 375 974 353 1069 405 1005 428Z','#8aa16f'),plant(963,386,.56),plant(1026,412,.48),ellipse(927,375,8,4,'#b2b89b'),ellipse(1047,417,8,4,'#bec3a2'));}
export function buildRoom(scene){
  const uid='room-'+(++sequence),c=scene.palette,backdrop=svg('g',{class:'room-backdrop','aria-hidden':'true'}),props=[];
  const defs=svg('defs',{},svg('pattern',{id:uid+'-tiles',width:100,height:50,patternUnits:'userSpaceOnUse',patternTransform:'skewY(-21)'},line(0,0,100,0,shade(c.floor,.94),.8),line(0,0,0,100,shade(c.floor,.95),.7)));
  backdrop.append(defs,ellipse(1130,805,870,240,scene.id==='orbital'?'#607f93':'#a3b8b0',{opacity:.13}));
  for(let i=1;i<scene.floor.length;i++){const a=scene.floor[i],b=scene.floor[(i+1)%scene.floor.length];backdrop.append(svg('polygon',{points:polygon([a,b,[b[0],b[1]+21],[a[0],a[1]+21]]),fill:shade(c.edge,i%2?1.04:.96)}));}
  backdrop.append(svg('polygon',{points:polygon(scene.floor),fill:c.floor}),svg('polygon',{points:polygon(scene.floor),fill:'url(#'+uid+'-tiles)'}),zoneFloors(scene));
  const a=scene.floor[0],b=scene.floor[1],d=scene.floor[2],height=190;
  backdrop.append(svg('polygon',{points:polygon([a,[a[0],a[1]-height],[b[0],b[1]-height],b]),fill:c.wall}),svg('polygon',{points:polygon([b,[b[0],b[1]-height],[d[0],d[1]-height],d]),fill:c.wallSide}),path(`M${a[0]} ${a[1]-height} ${b[0]} ${b[1]-height} ${d[0]} ${d[1]-height}`,'none',{stroke:shade(c.wall,1.06),'stroke-width':9,'stroke-linejoin':'round'}),path(`M${a[0]+5} ${a[1]-4} ${b[0]} ${b[1]-4} ${d[0]-8} ${d[1]-5}`,'none',{stroke:shade(c.edge,.98),'stroke-width':5,'stroke-linejoin':'round'}),windows(scene,uid));
  const clock=svg('g',{transform:'matrix(1 -.379 0 1 630 168)',class:'office-clock'},ellipse(0,0,23,23,scene.id==='orbital'?'#4c697a':'#fafcf9',{stroke:shade(c.edge,.95),'stroke-width':3}),svg('path',{d:'M0 0V-11',stroke:c.ink,'stroke-width':3,'stroke-linecap':'round','data-clock':'hour'}),svg('path',{d:'M0 0V-17',stroke:c.ink,'stroke-width':1.8,'stroke-linecap':'round','data-clock':'minute'}),ellipse(0,0,2,2,c.ink));backdrop.append(clock);
  props.push(...glassPartitions(scene),...loungeFurniture(scene),...zoneSigns(scene));
  for(const[x,y,scale]of scene.plants)props.push({y,node:plant(x,y,scale,scene.id==='orbital')});
  return{backdrop,props,uid,bossDisplay:bossWallDisplay(scene)};
}
export function deskArt(scene,{boss=false,monitor=true}={}){
  const c=scene.palette,s=boss?BOSS_DESK_SCALE:1,node=svg('g',{class:'desk-geometry',transform:`scale(${s})`});
  node.append(ellipse(9,56,86,26,scene.id==='orbital'?'#122936':'#7f979e',{opacity:.13,class:'station-shadow'}),path('M-77-5V43L-70 47V0M92 8V52L99 49V5M0 40V76L7 80V38',c.deskSide),path('M-86-10 12-47 104 6 6 44Z',c.desk,{class:'desk-top'}),path('M-86-10V-3L6 51V44Z',shade(c.deskSide,1.02)),path('M6 44V51L104 13V6Z',shade(c.deskSide,.94)),path('M-86-10 12-47 104 6','none',{stroke:shade(c.desk,1.03),'stroke-width':2}),path('M-39 0 1-14 30 2-10 17Z',shade(c.screen,.94)),path('M-31 2-5-7m-19 13 26-9m-17 12 28-10','none',{stroke:shade(c.monitor,1.2),'stroke-width':1.2,opacity:.55}),ellipse(boss?35:48,boss?-4:10,7,4,c.deskSide),ellipse(-56,0,10,4,scene.id==='garden'?'#c7b28e':'#d3dfdf',{class:'desk-coaster'}));
  if(scene.id==='garden')node.append(path('M-72-9 12-41m-59 46 83-31m-59 45 83-32','none',{stroke:'#cdbb9c','stroke-width':.8,opacity:.55}));
  node.append(svg('g',{class:'doodle-paper'},path('M-55-9-34 3-47 8-65-2Z','#f2e6ca',{stroke:'#c8b791','stroke-width':.6}),path('M-55-4q4-2 7 1t5 1m-9-5 4 3m-9 2 6 3','none',{stroke:'#a88e60','stroke-width':.9,class:'doodle-mark'})));
  if(scene.id==='orbital')node.append(path('M-78-7 7 42 96 9','none',{stroke:'#93c5c9','stroke-width':1.4,opacity:.75}));
  if(monitor){node.append(path('M-22-13V0L-33 5-11 16 3 11-13 3V-17Z',c.deskSide),path('M-47-40 6-60 6-25-47-5Z',c.monitor,{class:'monitor-frame'}),path('M-43-37 2-54 2-28-43-11Z',c.screen,{class:'monitor-screen'}));
  const content=svg('g',{transform:'matrix(1 -.378 0 1 -40 -34)',class:'monitor-content'},path('M0 0h30m-30 6h21m-21 6h28m-28 6h17','none',{stroke:shade(c.monitor,1.14),'stroke-width':1.6,class:'screen-code'}),path('M5 8 10 12 23 1','none',{stroke:scene.id==='orbital'?'#557a68':'#5f8f78','stroke-width':2.3,'stroke-linecap':'round',class:'screen-check'}),svg('rect',{x:30,y:15,width:2,height:5,fill:c.monitor,class:'screen-cursor'}));
  node.append(content);}return node;
}
export function wallDisplay(scene){
  const[x,y]=scene.display,night=scene.id==='orbital',node=svg('g',{class:'wall-display',transform:`matrix(1 -.379 0 1 ${x} ${y})`,role:'group','aria-label':'任务大屏'});
  node.append(svg('rect',{x:-6,y:-6,width:426,height:159,rx:7,fill:night?'#7595a7':'#7f979f'}),svg('rect',{width:414,height:147,rx:3,fill:night?'#172c3d':'#2d4650'}),text(15,25,'任务大屏',{fill:'#f0f6f3','font-size':18,'font-weight':650}),text(398,24,'本机同步',{'text-anchor':'end',fill:'#aac8ba','font-size':12}),text(15,49,'',{'data-screen':'states-main',fill:'#deebe7','font-size':14}),text(15,70,'',{'data-screen':'states-more',fill:'#b2c8cb','font-size':12.5}),line(15,80,398,80,'#69828b',.8,{opacity:.7}),svg('g',{'data-screen':'drafts'}));return node;
}
export function bossMonitor(scene){
  const c=scene.palette,node=svg('g',{class:'boss-computer',transform:'matrix(.72 -.272 0 .72 -65 -71)'});
  node.append(svg('rect',{x:-5,y:-5,width:176,height:116,rx:5,fill:c.monitor}),svg('rect',{width:166,height:106,rx:2,fill:scene.id==='orbital'?'#d1e6e1':'#f1f4e9'}),text(11,24,'你的审核台',{'data-screen':'boss-heading',fill:'#526956','font-size':15,'font-weight':650}),line(11,34,154,34,'#cbd9c8',1),svg('g',{'data-screen':'reviews'}));return node;
}
