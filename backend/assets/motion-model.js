export const ARM={upper:20,lower:19,left:[-14,-30],right:[12,-29]};
export const CUP_LIP=[-11,-6],PENCIL_TIP=[-15,-11],DESK_PAPER=[[-55,-9],[-34,3],[-47,8],[-65,-2]];
const radians=value=>value*Math.PI/180,degrees=value=>value*180/Math.PI;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
const wave=(t,rate=1)=>Math.sin(t*rate*Math.PI*2);
function turned(point,angle){const a=radians(angle);return[point[0]*Math.cos(a)-point[1]*Math.sin(a),point[0]*Math.sin(a)+point[1]*Math.cos(a)];}
export function mouthAt(pose){const point=turned([-16,0],pose.head);return[point[0],point[1]-42];}
export function cupLipAt(pose){const point=turned(CUP_LIP,pose.propTilt);return[pose.left[0]+point[0],pose.left[1]+point[1]];}
export function pencilPaperPoint(pose){return[pose.left[0]+PENCIL_TIP[0]-6,pose.left[1]+PENCIL_TIP[1]+58+pose.bodyY];}
export function phoneScreenAt(pose){return[pose.left[0]+.5,pose.left[1]-8.5];}
export function armAngles(shoulder,target,bend=1){
  const dx=target[0]-shoulder[0],dy=target[1]-shoulder[1],distance=clamp(Math.hypot(dx,dy),1.001,ARM.upper+ARM.lower-.001);
  const elbow=bend*Math.acos(clamp((distance*distance-ARM.upper*ARM.upper-ARM.lower*ARM.lower)/(2*ARM.upper*ARM.lower),-1,1));
  const upper=Math.atan2(dy,dx)-Math.atan2(ARM.lower*Math.sin(elbow),ARM.upper+ARM.lower*Math.cos(elbow));
  return {upper:degrees(upper)-90,lower:degrees(elbow),wrist:-degrees(upper+elbow)+90};
}
export function armEndpoint(shoulder,angles){
  const a=radians(angles.upper+90),b=radians(angles.upper+90+angles.lower);
  return [shoulder[0]+ARM.upper*Math.cos(a)+ARM.lower*Math.cos(b),shoulder[1]+ARM.upper*Math.sin(a)+ARM.lower*Math.sin(b)];
}
export function poseAt(mode,time=0,{intensity=1,phase=0}={}){
  const t=time+phase,s=wave(t),m=intensity;
  let left=[-22,-48],right=[5,-42],bodyY=s*.6*m,lean=0,head=0,prop='none',propTilt=0,eyes='screen',blink=(t%5.7)>5.5;
  if(mode==='tea'||mode==='coffee-rush'||mode==='cafe'){
    const cycle=(t%5)/5,sip=cycle<.18?cycle/.18:cycle<.6?1:cycle<.8?1-(cycle-.6)/.2:0;
    const eased=sip*sip*(3-2*sip);prop='cup';propTilt=12*eased;head=-3*eased;
    const mouth=mouthAt({head}),lip=turned(CUP_LIP,propTilt);left=[mix(-22,mouth[0]-lip[0],eased),mix(-15,mouth[1]-lip[1],eased)];
    right=mode==='coffee-rush'?[5+wave(t,3)*2*m,-42+wave(t,3.7)*2*m]:[19,1];eyes=mode==='coffee-rush'?'screen':'relaxed';
  }else if(mode==='phone'){
    left=[-29,-28+wave(t,.2)*.7];right=[-25+wave(t,1.7)*.8,-34+wave(t,1.7)*1.3];prop='phone';head=-12;eyes='phone';
  }else if(mode==='music'){
    left=[-21,1];right=[19,3];prop='headphones';lean=wave(t,.6)*3*m;head=wave(t,.9)*6*m;eyes='relaxed';
  }else if(mode==='stretch'){
    const stretch=(1-Math.cos(t*Math.PI*.5))/2;left=[mix(-23,-30,stretch),mix(-8,-64,stretch)];right=[mix(20,31,stretch),mix(-6,-63,stretch)];lean=-4*stretch*m;head=-5*stretch;eyes='closed';
  }else if(mode==='doodle'){
    left=[-30+wave(t,1.2)*2*m,-48+wave(t,1.8)*1.5*m];right=[10,-37];prop='pencil';head=-6;eyes='paper';
  }else if(mode==='typing-storm'){
    left=[-22+wave(t,3.8)*2*m,-48+wave(t,4.1)*3.1*m];right=[5+wave(t,4.3)*2*m,-42+wave(t,4.7)*3.3*m];bodyY=wave(t,1.8)*1.2*m;lean=wave(t,.8)*2*m;head=wave(t,1.2)*2*m;
  }else if(mode==='screen-dive'){
    lean=-5*(.5+.5*wave(t,.25))*m;head=-3;left=[-24,-48+wave(t,2.8)*1.5*m];right=[3,-43+wave(t,3.2)*1.3*m];
  }else if(mode==='idea-spark'){
    left=[-22,-48];right=[-5,-45];head=5+wave(t,.2)*3;prop='idea';eyes='up';
  }else if(mode==='waiting'){
    left=[-11,-3];right=[9,-2];bodyY=s*.3*m;eyes='forward';head=wave(t,.15)*1.2;
  }else if(mode==='question'){
    left=[-24,-48];right=[31,-63];head=3;eyes='forward';
  }else if(mode==='error'||mode==='neutral'||mode==='stopping'){
    left=[-20,0];right=[19,1];bodyY=s*.2*m;head=mode==='error'?-4:0;eyes='forward';
  }else if(mode==='starting'){
    left=[-22,-46];right=[14,-22];head=wave(t,.4)*3;eyes='screen';
  }else if(mode==='sleep'){
    left=[-25,-39];right=[-2,-34];bodyY=5+wave(t,.13)*.6*m;lean=-7;head=9;eyes='closed';prop='sleep';
  }else if(mode==='gaming'){
    left=[-13,-23+wave(t,.65)*.65*m];right=[8,-21+wave(t,.65)*.65*m];head=-3;prop='controller';eyes='screen';
  }else if(mode==='workout'){
    const curl=(1-Math.cos(t*Math.PI*.8))/2;
    left=[-26,-9-27*curl];right=[26,-8-26*curl];bodyY=3+(1-Math.cos(t*Math.PI*.4))*3*m;prop='dumbbell';head=2;eyes='forward';
  }else if(mode==='standing'){
    left=[-20,0];right=[19,1];bodyY=0;eyes='forward';
  }else if(mode==='strolling'){
    const stride=wave(t,1.47)*8*m;left=[-21+stride,-2];right=[18-stride,-1];head=-1;bodyY=7+Math.abs(wave(t,2))*.6*m;eyes='forward';
  }else if(mode==='walking'){
    left=[-21+wave(t,1.47)*7,-2];right=[16,-21];head=-2;bodyY=7+Math.abs(wave(t,1.47))*.7*m;eyes='forward';prop='folder';
  }
  if(!m){bodyY=0;lean=0;head=0;blink=false;
    if(prop==='cup'){const mouth=mouthAt({head}),lip=turned(CUP_LIP,propTilt);const cycle=(t%5)/5;if(cycle>=.18&&cycle<.6)left=[mouth[0]-lip[0],mouth[1]-lip[1]];}
  }
  return {left,right,arms:{left:armAngles(ARM.left,left,-1),right:armAngles(ARM.right,right,1)},bodyY,lean,head,prop,propTilt,eyes,blink};
}
export function modeForState(state,mood){
  if(state==='waiting_approval')return'waiting';if(state==='waiting_input')return'question';
  if(state==='unknown'||state==='interrupted')return'neutral';if(state==='error')return'error';if(state==='stopping')return'stopping';if(state==='starting')return'starting';
  return mood||(['active','recent'].includes(state)?'typing-storm':'tea');
}
export function avatarIdentity(id){let hash=2166136261;for(const char of String(id))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;return {style:hash%8,color:Math.floor(hash/8)%8,phase:(hash%997)/89};}

// Legs are solved separately from the torso. Contact feet do not bob with breathing.
export function legPose(mode,time=0,{stance=0,intensity=1,bodyY=0,lean=0,distance=0,heading=[-1,0],facing=1,moving=true}={}){
  const isWalk=['walking','strolling'].includes(mode)&&moving&&intensity>0;
  if(['workout','standing','walking','strolling'].includes(mode))stance=Math.max(stance,1);
  const phase=((distance/(32/.62))%1+1)%1,hipX=-8*Math.sin(radians(lean));
  return [0,1].map(side=>{
    const hip=[(side?-1:1)*-7+hipX,bodyY+(side?1:0)],seat=side?[-10,33]:[-26,37],stand=side?[8,44]:[-7,44];
    let ankle=[mix(seat[0],stand[0],stance),mix(seat[1],stand[1],stance)],contact=true;
    if(isWalk){const q=(phase+side*.5)%1;let travel,lift;if(q<.62){travel=16-32*q/.62;lift=0;}else{const u=(q-.62)/.38;travel=-16+32*(u*u*(3-2*u));lift=Math.sin(u*Math.PI)*9;}ankle=[stand[0]+heading[0]*facing*travel,stand[1]+heading[1]*travel-lift];contact=lift<.01;}
    const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],d=clamp(Math.hypot(dx,dy),.1,53.99),base=Math.atan2(dy,dx),bend=Math.acos(clamp((26*26+d*d-28*28)/(52*d),-1,1)),angle=base+bend;
    const knee=[hip[0]+26*Math.cos(angle),hip[1]+26*Math.sin(angle)];
    return{hip,knee,ankle,contact};
  });
}

export function blendPose(from,to,amount){
  if(!from||amount>=1)return to;const t=clamp(amount,0,1),k=t*t*(3-2*t),out={...to};
  for(const name of['bodyY','lean','head','propTilt'])out[name]=mix(from[name],to[name],k);
  for(const side of['left','right'])out[side]=from[side].map((n,i)=>mix(n,to[side][i],k));
  out.arms={left:armAngles(ARM.left,out.left,-1),right:armAngles(ARM.right,out.right,1)};return out;
}

export function directionForState(state,visual={}){
  if(visual.mobile)return ['out','return','rise','sit','waiting-return'].includes(visual.phase)?'travel':'free';
  return ['active','recent','starting','stopping'].includes(state)?'screen':'free';
}
