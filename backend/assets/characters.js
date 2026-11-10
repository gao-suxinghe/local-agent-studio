import {svg,path,ellipse,line,shade,text} from './svg.js';
import {ARM,avatarIdentity,mouthAt,cupLipAt,legPose} from './motion-model.js';
const coats=['#648b9a','#b7836f','#82966c','#8d82a8','#bb9c69','#739a96','#a67c91','#7389ae'];
const skins=['#d6ad90','#ae7858','#e1b79c','#a77554','#c99879','#d4a387','#e3c0a8','#bd8d6c'];
const hairs=['#394852','#413e43','#69523f','#293d44','#59453e','#3f454e','#71604d','#34424a'];
function head(identity,boss=false){
  const style=identity.style,skin=skins[style],hair=boss?'#43505a':hairs[style],g=svg('g',{class:'character-head'});
  if(style===2)g.append(ellipse(7,-33,9,9,hair),ellipse(8,-35,5,4,shade(hair,1.15)));
  if(style===4||style===6)g.append(path('M-22-21Q-23-39-4-35Q15-33 14-12L12 7 2 10-18 1Z',hair));
  g.append(ellipse(-4,-15,16.5,18.5,skin),ellipse(11,-12,4,6,shade(skin,.96)),path('M-19-11-26-8-20-5Z',skin),
    path('M-21-20Q-27-37-7-37Q11-40 14-22L11-10 5-14 3-26Q-5-19-15-23L-18-11Z',hair),path('M-19-28Q-12-36-3-33','none',{stroke:shade(hair,1.22),'stroke-width':2.5,'stroke-linecap':'round'}));
  if(style===1)for(const[x,y]of[[-19,-27],[-12,-33],[-4,-34],[5,-30],[10,-23]])g.append(ellipse(x,y,6,6,hair));
  if(style===0)g.append(path('M-21-24-23-31-14-30-10-37-2-33 6-36 8-28Z',hair));
  if(style===7)g.append(path('M-20-4Q-8 9 4-4L1 4Q-9 10-17 3Z',hair));
  const open=svg('g',{'data-eyes':'open'},ellipse(-16,-13,2,2.3,'#39444b'),ellipse(-7,-14,2.1,2.4,'#39444b'),ellipse(-16.5,-13.5,.65,.7,'#f6f4eb'),ellipse(-7.5,-14.5,.7,.7,'#f6f4eb'));
  const closed=svg('g',{'data-eyes':'closed',visibility:'hidden'},path('M-19-12q3 3 6-1m3 0q3 3 6-1','none',{stroke:'#4a4c4b','stroke-width':1.5,'stroke-linecap':'round'}));
  g.append(open,closed,path('M-19-19q3-2 6-1m2-1q4-2 7 0','none',{stroke:hair,'stroke-width':1.3,'stroke-linecap':'round','data-face':'brows'}),ellipse(-16,-3,4,2,shade(skin,.93),{opacity:.6}),path('M-16 0q3 2 5-1','none',{stroke:'#9f745d','stroke-width':1.15,'stroke-linecap':'round'}));
  if(style===3||boss)g.append(svg('rect',{x:-21,y:-18,width:10,height:8,rx:3,fill:'none',stroke:'#596974','stroke-width':1.5}),svg('rect',{x:-9,y:-19,width:11,height:8,rx:3,fill:'none',stroke:'#596974','stroke-width':1.5}),line(-11,-14,-9,-14,'#596974',1.3));
  if(style===5)g.append(path('M12-15 16-9 9-3','none',{stroke:'#667f8d','stroke-width':2.3,'stroke-linecap':'round'}),ellipse(12,-14,4,5,'#718795'));
  const headphones=svg('g',{'data-prop':'headphones',visibility:'hidden'},path('M-23-13V-24Q-10-44 9-29L15-16','none',{stroke:'#d1ae6e','stroke-width':4,'stroke-linecap':'round'}),ellipse(-23,-12,4,7,'#546c7b'),ellipse(14,-13,4,7,'#546c7b'));
  g.append(headphones);return{node:g,open,closed,headphones};
}
function backHead(identity,boss=false){
  const style=identity.style,hair=boss?'#43505a':hairs[style],skin=skins[style],g=svg('g',{class:'character-head-back',display:'none'});
  if(style===2)g.append(ellipse(9,-31,10,11,hair));
  if(style===4||style===6)g.append(path('M-21-21Q-19-37-3-35Q15-32 14-12L12 7Q-3 16-20 3Z',hair));
  g.append(ellipse(-4,-16,17,19,hair),ellipse(-20,-10,4,6,skin),path('M-20-21Q-17-34-3-33Q11-32 12-20','none',{stroke:shade(hair,1.16),'stroke-width':3.1,'stroke-linecap':'round'}),path('M-15-2Q-4 4 9-3','none',{stroke:shade(hair,.86),'stroke-width':1.4}));
  if(style===1)for(const[x,y]of[[-18,-28],[-9,-34],[1,-32],[9,-25]])g.append(ellipse(x,y,6,6,hair));
  if(style===0)g.append(path('M-20-24-22-31-13-29-7-37 0-32 7-35 10-24Z',hair));
  if(style===5)g.append(path('M-22-13-25-8-21-3','none',{stroke:'#7d929b','stroke-width':2.5}));
  return g;
}
function arm(side,skin,coat){
  const shoulder=ARM[side],anchor=svg('g',{transform:`translate(${shoulder[0]} ${shoulder[1]})`}),upper=svg('g',{'data-joint':side+'-upper'});
  const elbowAnchor=svg('g',{transform:`translate(0 ${ARM.upper})`}),elbow=svg('g',{'data-joint':side+'-elbow'}),wristAnchor=svg('g',{transform:`translate(0 ${ARM.lower})`}),wrist=svg('g',{'data-joint':side+'-wrist'});
  upper.append(line(0,0,0,ARM.upper,coat,9),ellipse(0,0,4.5,4.5,coat));
  elbow.append(line(0,0,0,ARM.lower,skin,7),ellipse(0,0,3.5,3.5,skin));
  wrist.append(ellipse(0,0,4,4.4,skin),path('M-2 1q-3-3-1-5','none',{stroke:shade(skin,.88),'stroke-width':1.2,'stroke-linecap':'round'}));
  const cup=svg('g',{'data-prop':'cup',visibility:'hidden',transform:'translate(-10 4)'},path('M-7-10H5L4-2Q-1 3-6-2Z','#f5e8ca',{stroke:'#c9b796','stroke-width':.8}),ellipse(-1,-10,6,2,'#9f8262'),path('M5-8q8-2 6 4L5-2','none',{stroke:'#d1c19f','stroke-width':2}),path('M-4-14q-3-4 0-7m6 7q-2-4 1-8','none',{stroke:'#a9b9bd','stroke-width':1.1,opacity:.7,class:'cup-steam'}));
  const phone=svg('g',{'data-prop':'phone',visibility:'hidden'},svg('rect',{x:-6,y:-19,width:13,height:22,rx:3,fill:'#405664',stroke:'#2f4655','stroke-width':.8}),svg('rect',{x:-4,y:-16,width:9,height:15,rx:1.3,fill:'#bcdedb'}),line(-2,-12,3,-12,'#f4faf5',1.5),line(-2,-8,2,-8,'#e9f4ec',1.5),ellipse(.5,.4,1,1,'#91a3ab'));
  const pencil=svg('g',{'data-prop':'pencil',visibility:'hidden'},path('M-11-10 6 3 4 6-13-7Z','#c69e56'),path('M-11-10-15-11-13-7Z','#67553f'));
  const folder=svg('g',{'data-prop':'folder',visibility:'hidden'},path('M-3-18 11-23 17-17 20 3 3 9Z','#d6c59c',{stroke:'#b4a581','stroke-width':1}),path('M1-11 12-15M2-6 13-10','none',{stroke:'#f3ecd7','stroke-width':1.6}));
  const controller=svg('g',{'data-prop':'controller',visibility:'hidden'},path('M-3-7Q6-12 14-6l8 7q3 9-4 8l-7-5H2l-6 5q-8 2-6-6Z','#435d6a',{stroke:'#bccbc7','stroke-width':.8}),path('M-1-3v7m-4-3h8','none',{stroke:'#b8d3ca','stroke-width':1.7}),ellipse(12,-1,1.7,1.7,'#dfb97c'),ellipse(16,3,1.7,1.7,'#9ec0b4'));
  const dumbbell=svg('g',{'data-prop':'dumbbell',visibility:'hidden'},line(-12,0,12,0,'#a9b7b9',3.8),svg('rect',{x:-16,y:-8,width:7,height:16,rx:2,fill:'#4b626c'}),svg('rect',{x:9,y:-8,width:7,height:16,rx:2,fill:'#4b626c'}),line(-18,-4,-18,4,'#849aa1',3),line(18,-4,18,4,'#849aa1',3));
  wrist.append(cup,phone,pencil,folder,controller,dumbbell);wristAnchor.append(wrist);elbow.append(wristAnchor);elbowAnchor.append(elbow);upper.append(elbowAnchor);anchor.append(upper);
  return{node:anchor,upper,elbow,wrist,cup,phone,pencil,folder,controller,dumbbell};
}
const rotate=(node,value)=>node.setAttribute('transform','rotate('+Number(value.toFixed(3))+')');
export function createCharacter(id,{boss=false,standing=false,look=null}={}){
  const identity=look?{style:Math.max(0,Math.min(7,look.style|0)),color:Math.max(0,Math.min(7,look.color|0)),phase:0}:avatarIdentity(id),skin=skins[identity.style],coat=boss?'#4d6070':coats[identity.color],root=svg('g',{class:'character'+(boss?' character-boss':''),'data-character-style':identity.style,'data-character-color':identity.color}),body=svg('g',{'data-joint':'body'});
  const legs=svg('g',{class:'character-legs'}),headAnchor=svg('g',{transform:'translate(0 -42)'}),headJoint=svg('g',{'data-joint':'head'}),face=head(identity,boss),rearHead=backHead(identity,boss);
  const left=arm('left',skin,coat),right=arm('right',skin,shade(coat,.9));
  const legNodes=[0,1].map(side=>{const node=svg('g',{'data-leg':side}),bone=path('','none',{stroke:side?'#455a65':'#566c77','stroke-width':8,'stroke-linecap':'round'}),shoe=path('',side?'#344b58':'#405663');node.append(bone,shoe);legs.append(node);return{node,bone,shoe};});
  body.append(right.node,path('M-16-31Q-7-38 5-33L16-27 15-1Q0 6-16-1Z',coat),path('M7-31 16-27 15-1 8 2Z',shade(coat,.88)));
  const frontDetails=svg('g',{'data-facing-detail':'front'},path('M-8-35 2-36 6-27-2-24-10-28Z','#e7eee9'),path('M-5-38 2-38 3-31-4-29Z',skin));
  if(boss)frontDetails.append(path('M-3-29 1-30 4-16 1-9-3-16Z','#c6ab70'));else frontDetails.append(path('M-11-26-8-8','none',{stroke:shade(coat,1.14),'stroke-width':1.6,'stroke-linecap':'round'}));
  const backDetails=svg('g',{'data-facing-detail':'back',display:'none'},path('M-7-37 1-38 3-33-5-31Z',skin),path('M-12-32Q-3-26 8-31M-2-26V0','none',{stroke:shade(coat,.85),'stroke-width':1.4}));body.append(frontDetails,backDetails);
  headJoint.append(face.node,rearHead);headAnchor.append(headJoint);body.append(headAnchor,left.node);
  const idea=svg('g',{'data-prop':'idea',visibility:'hidden'},ellipse(-5,-90,7,9,'#e6c979',{stroke:'#d2b363','stroke-width':1}),path('M-8-80h6m-5 3h4','none',{stroke:'#a89262','stroke-width':1.6}),path('M-20-90h-5m34-1h5M-5-107v-5','none',{stroke:'#dbc07c','stroke-width':1.4,'stroke-linecap':'round'}));
  const sleep=svg('g',{'data-prop':'sleep',visibility:'hidden'},text(15,-73,'z',{fill:'#7b9498','font-size':13,'font-weight':600}),text(27,-87,'z',{fill:'#91a8a5','font-size':17,'font-weight':600}),text(42,-102,'z',{fill:'#a6b9b1','font-size':21,'font-weight':600}));
  body.append(idea,sleep);root.append(legs,body);let previousProp='',previousContact=null,previousDirection=null;
  function apply(pose,mode,time=0,visual={}){
    const direction=visual.direction||'free',back=direction==='screen';if(direction!==previousDirection){face.node.setAttribute('display',back?'none':'inline');rearHead.setAttribute('display',back?'inline':'none');frontDetails.setAttribute('display',back?'none':'inline');backDetails.setAttribute('display',back?'inline':'none');root.dataset.direction=direction;previousDirection=direction;}
    body.setAttribute('transform',`translate(0 ${pose.bodyY.toFixed(3)}) rotate(${pose.lean.toFixed(3)} 0 -8)`);rotate(headJoint,pose.head);
    for(const[side,rig]of[['left',left],['right',right]]){const angle=pose.arms[side];rotate(rig.upper,angle.upper);rotate(rig.elbow,angle.lower);rotate(rig.wrist,angle.wrist+(side==='left'?pose.propTilt:0));}
    const prop=mode==='walking'?'folder':pose.prop;
    const mouth=mouthAt(pose),lip=cupLipAt(pose),contact=prop==='cup'&&Math.hypot(mouth[0]-lip[0],mouth[1]-lip[1])<1;
    if(contact!==previousContact){root.dataset.cupContact=String(contact);previousContact=contact;}
    if(previousProp!==prop){for(const rig of[left,right])for(const name of['cup','phone','pencil','folder','controller','dumbbell'])rig[name].setAttribute('visibility','hidden');face.headphones.setAttribute('visibility','hidden');idea.setAttribute('visibility','hidden');sleep.setAttribute('visibility','hidden');
      if(['cup','phone','pencil'].includes(prop))left[prop].setAttribute('visibility','visible');if(prop==='folder')right.folder.setAttribute('visibility','visible');if(prop==='controller')left.controller.setAttribute('visibility','visible');if(prop==='dumbbell'){left.dumbbell.setAttribute('visibility','visible');right.dumbbell.setAttribute('visibility','visible');}if(prop==='sleep')sleep.setAttribute('visibility','visible');if(prop==='headphones')face.headphones.setAttribute('visibility','visible');if(prop==='idea')idea.setAttribute('visibility','visible');previousProp=prop;root.dataset.prop=prop;
    }
    const closed=pose.blink||pose.eyes==='closed';face.open.setAttribute('visibility',closed?'hidden':'visible');face.closed.setAttribute('visibility',closed?'visible':'hidden');
    const gaze=pose.eyes==='phone'?[-1,1.4]:pose.eyes==='paper'?[-1.4,-.6]:pose.eyes==='up'?[0,-1.8]:pose.eyes==='screen'?[-.7,-.7]:[0,0];face.open.setAttribute('transform',`translate(${gaze[0]} ${gaze[1]})`);
    const joints=legPose(mode,time,{stance:visual.stance??(standing?1:0),intensity:visual.intensity??1,bodyY:pose.bodyY,lean:pose.lean,distance:visual.distance??time*110,heading:visual.heading||[-1,0],facing:visual.facing||1,moving:visual.moving!==false});
    for(let i=0;i<2;i++){const leg=joints[i],node=legNodes[i],a=leg.ankle;node.bone.setAttribute('d',`M${leg.hip.join(' ')}L${leg.knee.join(' ')}L${a.join(' ')}`);node.shoe.setAttribute('d',`M${a[0]+3} ${a[1]-3}q-6-2-10 1l-8 3q-4 5 6 5l14-2Z`);node.node.dataset.contact=String(leg.contact);}
    root.dataset.pose=mode;
  }
  return{node:root,identity,apply};
}
export function avatarIcon(id,{boss=false,look=null}={}){
  const identity=look?{style:Math.max(0,Math.min(7,look.style|0)),color:Math.max(0,Math.min(7,look.color|0))}:avatarIdentity(id),g=svg('svg',{viewBox:'0 0 48 48',class:'avatar-icon','aria-hidden':'true',focusable:'false'}),face=head(identity,boss);
  g.append(svg('rect',{width:48,height:48,rx:15,fill:shade(coats[identity.color],1.4)}),path('M6 49Q6 33 24 32Q42 33 43 49Z',boss?'#4d6070':coats[identity.color]),svg('g',{transform:'translate(29 39) scale(.77)'},face.node));return g;
}
