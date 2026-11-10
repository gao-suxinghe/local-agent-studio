import {poseAt,modeForState,blendPose,directionForState} from './motion-model.js';
import {ambientProfile,profileForMode} from './office-personality.js';

export function createMotionLoop(container,actors,getOptions,onTick=()=>{},onSpeech=()=>{},beforeFrame=()=>{}){
  let frame=0,last=0,elapsed=0,paint=0,disposed=false,frames=0,painted=false,nextSpeech=4;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function options(){return getOptions()||{};}
  function live(){const o=options();return!disposed&&container.isConnected&&!container.closest('[hidden]')&&!document.hidden&&!reduced.matches&&o.motion!=='off'&&!o.stale&&!o.suspended;}
  function draw(force=false){
    const o=options(),intensity=reduced.matches||o.motion==='off'||o.stale?0:o.motion==='calm'?.35:1;
    beforeFrame(elapsed,intensity);
    const speakers=[];
    for(const actor of actors){
      if(!Number.isFinite(actor.moodUntil)||elapsed>=actor.moodUntil||actor.profileState!==actor.state){actor.profile=ambientProfile(actor.state,Math.floor(Math.random()*100));actor.profileState=actor.state;actor.moodUntil=elapsed+15+Math.random()*14;}
      const mode=actor.boss?'waiting':actor.visual?.mode||modeForState(actor.state,actor.profile?.mode);
      actor.speechProfile=actor.visual?.mobile?profileForMode(mode,actor.index||0):actor.profile;
      if(actor.effectiveMode!==mode){actor.transitionPose=actor.lastPose;actor.effectiveMode=mode;actor.modeAt=elapsed;}
      const poseTime=['walking','strolling'].includes(mode)?(actor.visual?.distance||0)/76:elapsed-(actor.modeAt||0),desired=poseAt(mode,poseTime,{intensity}),pose=intensity?blendPose(actor.transitionPose,desired,(elapsed-(actor.modeAt||0))/.65):desired;actor.lastPose=pose;
      actor.rig.apply(pose,mode,elapsed,{...actor.visual,intensity,direction:actor.visual?.direction||directionForState(actor.state,actor.visual)});
      actor.node.dataset.mood=mode;actor.node.dataset.motionIntensity=String(intensity);
      if(actor.speechProfile&&!actor.reporting&&!['out','return','rise','sit'].includes(actor.visual?.phase))speakers.push(actor);

    }
    if(force||intensity){onTick(elapsed,intensity);painted=true;if(!force&&intensity&&!o.suspended)frames++;container.dataset.motionFrame=String(frames);}
    if(intensity&&!o.suspended&&o.bubbles!==false&&elapsed>=nextSpeech&&speakers.length){onSpeech(speakers[Math.floor(Math.random()*speakers.length)],elapsed);nextSpeech=elapsed+13+Math.random()*9;}
  }
  function tick(timestamp){frame=0;if(!live()){last=0;container.dataset.motionLoop=reduced.matches?'reduced':'paused';return;}
    if(last)elapsed+=Math.min(.1,(timestamp-last)/1000);last=timestamp;
    const interval=options().motion==='calm'?50:1000/30;
    if(timestamp-paint>=interval){paint=timestamp;draw();}
    container.dataset.motionLoop='running';frame=requestAnimationFrame(tick);
  }
  function sync(){
    container.classList.toggle('scene-suspended',!!options().suspended);
    if(!live()){if(frame)cancelAnimationFrame(frame);frame=0;last=0;container.dataset.motionLoop=reduced.matches?'reduced':'paused';if(!painted)draw(true);}
    else if(!frame){last=0;frame=requestAnimationFrame(tick);}
  }
  const visibility=()=>sync();document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',visibility);
  const dialogs=new MutationObserver(visibility);for(const dialog of document.querySelectorAll('dialog'))dialogs.observe(dialog,{attributes:true,attributeFilter:['open']});
  draw(true);sync();
  return{sync,draw:()=>draw(true),time:()=>elapsed,dispose(){disposed=true;if(frame)cancelAnimationFrame(frame);dialogs.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',visibility);container.dataset.motionLoop='disposed';}};
}
