import {svg,path,ellipse,line,text,shade} from './svg.js';
import {ground} from './scene-config.js';
const points=p=>p.map(v=>v.join(' ')).join(' ');
const poly=(p,fill,extra={})=>svg('polygon',{points:points(p),fill,...extra});

export function zoneFloors(scene){
  const night=scene.id==='orbital',garden=scene.id==='garden';
  const node=svg('g',{class:'zone-floors'});
  node.append(poly(scene.zones.boss.floor,night?'#3c5260':garden?'#ddd4b9':'#e7e1d4'),poly(scene.zones.leisure.floor,night?'#34545a':garden?'#d3e1ca':'#dce9df'));
  for(let z=30;z<430;z+=32)node.append(line(...ground(690,z),...ground(1180,z),night?'#526b78':'#c9bfaa',.8,{opacity:.45}));
  return node;
}


export function zoneSigns(scene){
  const night=scene.id==='orbital',garden=scene.id==='garden',face=night?'#415e6d':garden?'#efe4cd':'#f8faf4',ink=night?'#e0eee7':garden?'#685f47':'#456454',edge=night?'#8db0b5':garden?'#bba985':'#a5bdb0';
  const specs=[{id:'work',label:'主办公区',mount:'hanging',at:[552,108],slope:-.379,width:136,depth:0},
    {id:'boss',label:'老板办公室',mount:'entrance',at:ground(690,105),slope:.546,width:144,depth:Math.max(scene.partitions[0].a[1],scene.partitions[0].b[1])+2},
    {id:'leisure',label:'休闲区',mount:'entrance',at:ground(690,505),slope:.546,width:144,depth:Math.max(scene.partitions[1].a[1],scene.partitions[1].b[1])+2}];
  return specs.map(spec=>{
    const[x,y]=spec.at,node=svg('g',{class:'zone-sign zone-sign-'+spec.id,transform:`matrix(1 ${spec.slope} 0 1 ${x} ${spec.mount==='hanging'?y:y-100})`,'data-zone-sign':spec.id,'data-mount':spec.mount,role:'img','aria-label':spec.label+(spec.mount==='hanging'?'悬挂牌':'入口标牌'),'pointer-events':'none'});
    const hang=spec.mount==='hanging';
    for(const x of[18,spec.width-18])node.append(line(x,hang?-26:-8,x,0,edge,hang?2:2.8));
    node.append(svg('rect',{x:2,y:3,width:spec.width,height:38,rx:5,fill:night?'#152f3f':'#7d9788','fill-opacity':.14}),svg('rect',{width:spec.width,height:38,rx:5,fill:face,stroke:edge,'stroke-width':1.5}));
    if(hang){node.append(text(spec.width/2,26,spec.label,{'text-anchor':'middle',fill:ink,'font-size':17,'font-weight':650}));}
    else{node.append(svg('rect',{x:7,y:8,width:3,height:22,rx:1,fill:scene.palette.accent}),text(20,25,spec.label,{fill:ink,'font-size':15.5,'font-weight':600}),path(`M${spec.width-24} 19h12m-5-5 5 5-5 5`,'none',{stroke:ink,'stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round'}));}
    return{y:spec.depth,node};
  });
}

export function glassPartitions(scene){
  return scene.partitions.map(({a,b},i)=>{
    const h=106,c=scene.palette,night=scene.id==='orbital';
    const node=svg('g',{class:'glass-partition','aria-hidden':'true','data-partition':i});
    node.append(poly([a,[a[0],a[1]-h],[b[0],b[1]-h],b],night?'#9ac5d0':'#c9e1de',{'fill-opacity':night?.10:.16,stroke:night?'#7395a1':'#a8c3c2','stroke-width':1.6}),line(a[0],a[1]-h,b[0],b[1]-h,night?'#9ab7ba':'#d9e9e5',4),line(...a,...b,shade(c.edge,.9),4));
    for(const p of[a,b])node.append(line(p[0],p[1]-h,p[0],p[1],night?'#799ca7':'#bfd1ce',3));
    node.append(line(a[0]+8,a[1]-h+15,b[0]-8,b[1]-h+15,'#f0faf4',1,{opacity:.4}));
    return{y:Math.max(a[1],b[1])+1,node};
  });
}

export function loungeFurniture(scene){
  const p=scene.palette,night=scene.id==='orbital',props=[];
  for(const facility of scene.facilities){
    const[x,y]=facility.point,[ax,ay]=facility.at,node=svg('g',{class:'leisure-facility facility-'+facility.id,'data-facility':facility.id});
    if(facility.id==='coffee'){
      node.append(ellipse(ax+7,ay+33,99,26,'#466b64',{opacity:.12}),path(`M${ax-77} ${ay-14}l135-9 22 23-135 22Z`,night?'#64818a':'#d5b88b'),path(`M${ax-77} ${ay-14}v59l135 34v-59Z`,night?'#435e6a':'#c3a37b'),path(`M${ax-77} ${ay+45}l135 34 22-24v-55L${ax+58} ${ay+22}`,night?'#344f5d':'#af956f'));
      const machine=svg('g',{transform:`translate(${ax-22} ${ay-18})`});
      machine.append(svg('rect',{x:-25,y:-55,width:53,height:52,rx:5,fill:p.monitor}),svg('rect',{x:-19,y:-48,width:40,height:22,rx:2,fill:p.screen}),line(-13,-16,13,-16,'#b8c8c6',3),path('M-5-13v9m10-9v9','none',{stroke:'#e4ece4','stroke-width':2}),ellipse(2,-3,12,4,'#d2be9d'));
      node.append(machine,svg('g',{transform:`translate(${ax+52} ${ay-8})`},ellipse(0,0,12,4,'#eae4d5'),path('M-7-13H6L5-2Q0 3-6-2Z','#f8edd6'),path('M6-11q9-2 7 5L5-3','none',{stroke:'#e2d1af','stroke-width':2})),text(ax-38,ay+44,'咖啡吧',{fill:night?'#dae7da':'#6e674f','font-size':14,'font-weight':600}));
      node.append(stool(scene,x,y));
    }else if(facility.id==='game'){
      node.append(ellipse(ax,ay+9,99,20,'#3d5a66',{opacity:.10}),path(`M${ax-84} ${ay-8}l143-6 18 18-143 8Z`,p.deskSide),path(`M${ax-84} ${ay-8}v27l143 20v-27Z`,shade(p.deskSide,.88)));
      const tv=svg('g',{transform:`translate(${ax-32} ${ay-12})`});
      tv.append(svg('rect',{x:-71,y:-90,width:147,height:88,rx:6,fill:'#3b5260'}),svg('rect',{x:-64,y:-83,width:133,height:73,rx:2,fill:night?'#1f3d51':'#294c59'}),path('M-64-32-33-60-5-31 28-66 69-35V-10H-64Z','#487d73'),path('M-64-15-25-37 2-14 31-36 69-16V-10H-64Z','#86a879'),ellipse(40,-65,9,9,'#e8d6a1'),path('M-25-38h16v14h-16Z','#cdb485'),line(-30,-1,35,-1,p.monitor,5));
      node.append(tv,armchair(scene,x,y,'#849caf'),text(ax-35,ay+33,'游戏角',{fill:p.ink,'font-size':13}));
    }else if(facility.id==='gym'){
      node.append(poly([[x-86,y-8],[x-10,y-37],[x+91,y+17],[x+15,y+47]],night?'#627d89':'#a7c3b2',{stroke:night?'#a4bab8':'#d4e1d6','stroke-width':3}),path(`M${x-67} ${y-3}l70-26m-50 39 70-26m-49 39 70-26`,'none',{stroke:night?'#8faeac':'#c8d9ca','stroke-width':1.2,opacity:.8}),text(x-38,y+61,'动一动',{fill:p.ink,'font-size':13}));
      const rack=svg('g',{transform:`translate(${x+62} ${y-55})`});
      rack.append(path('M-15-10v32m30-23v32M-18 0l36 12','none',{stroke:p.monitor,'stroke-width':4}),path('M-14-12 19 0M-12-8 16 3','none',{stroke:'#5d707c','stroke-width':7,'stroke-linecap':'round'}));node.append(rack);
    }else{
      node.append(ellipse(x,y+3,93,27,'#547568',{opacity:.12}),path(`M${x-66} ${y-50}q65-35 130-4l-1 50q-65 26-130-4Z`,night?'#728f93':'#a2bbaa'),path(`M${x-65} ${y-25}q65-24 128 3l-2 24q-65 22-127-5Z`,night?'#8ba8a9':'#bed0bc'),path(`M${x-70} ${y-43}q-11 5-4 38l15 8 5-37m121-2q13 5 11 32l-18 7-1-38`,night?'#77999b':'#9ab6a2'),line(x-49,y+8,x-49,y+21,p.monitor,4),line(x+49,y+8,x+49,y+18,p.monitor,4));
    }
    props.push({y:y-1,node});
  }
  // The private office has a visitor table and a low book cabinet.
  const[a,b]=ground(1075,345),visitor=svg('g',{class:'boss-visitor-table'});
  visitor.append(ellipse(a,b+16,54,20,p.deskSide,{opacity:.13}),path(`M${a-3} ${b}v27m0-3-21 8m21-8 23 6`,'none',{stroke:p.deskSide,'stroke-width':4}),ellipse(a,b,51,21,p.desk),ellipse(a-13,b-3,8,4,'#b4c4ae'),path(`M${a+3} ${b-9}l22 10-12 5-22-10Z`,night?'#8da5ad':'#c9d6c2'));
  props.push({y:b+28,node:visitor});
  const[c,d]=ground(1050,30),cabinet=svg('g',{},path(`M${c-85} ${d-7}l135-51 22 12v49l-135 51-22-12Z`,p.deskSide),path(`M${c-85} ${d-7}l135-51 22 12-135 51Z`,p.desk));
  for(let i=0;i<9;i++)cabinet.append(path(`M${c-68+i*13} ${d+5-i*4.93}v22l7-3v-22Z`,['#8c9d9e','#adba9c','#cbb88b','#95a4b9'][i%4]));
  props.push({y:d+25,node:cabinet});
  return props;
}

function stool(scene,x,y){return svg('g',{},ellipse(x,y-25,23,10,scene.palette.chair),path(`M${x-15} ${y-24}l-7 25m35-27 6 23m-20-21 0 29`,'none',{stroke:scene.palette.deskSide,'stroke-width':4,'stroke-linecap':'round'}));}
function armchair(scene,x,y,color){return svg('g',{},ellipse(x,y+2,40,15,'#547179',{opacity:.12}),path(`M${x-29} ${y-52}q29-18 56 0v39l-28 13-29-14Z`,shade(color,.9)),ellipse(x,y-21,31,14,color),path(`M${x-34} ${y-32}l7-3 8 22-10 5Zm53 20 7-26 10 5-7 27Z`,shade(color,1.12)),line(x-19,y-5,x-19,y+9,scene.palette.monitor,4),line(x+19,y-8,x+19,y+6,scene.palette.monitor,4));}

export function bossWallDisplay(scene){
  const[x,y]=ground(770,0),node=svg('g',{class:'boss-wall-display',transform:`matrix(1 -.379 0 1 ${x} ${y-180})`,role:'button',tabindex:0,'aria-label':'老板办公室大屏，查看需要你决定的事项'});
  node.append(svg('rect',{x:-5,y:-5,width:362,height:146,rx:5,fill:scene.palette.monitor}),svg('rect',{width:352,height:136,rx:2,fill:scene.id==='orbital'?'#193445':'#304b51'}),text(15,25,'你的办公室',{'data-boss-wall':'name',fill:'#f0f4e7','font-size':17,'font-weight':600}),text(15,50,'',{'data-boss-wall':'summary',fill:'#d7e4d9','font-size':13.5}),line(15,61,335,61,'#8ca8a6',.8,{opacity:.5}),svg('g',{'data-boss-wall':'requests'}));
  return node;
}
