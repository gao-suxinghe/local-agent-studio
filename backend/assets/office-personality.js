const idle=['tea','phone','music','stretch','doodle','sleep'];
const working=['typing-storm','screen-dive','idea-spark','coffee-rush'];
const lines={
  cafe:['今天的咖啡，负责灵感续航。','歇一小会儿，有活马上回。'],
  gaming:['这局结束，就回工位。','放松一下，思路更顺。'],
  workout:['脖子松一松，思路也通了。','敲键盘，也要练练手臂。'],
  sleep:['眯一下，灵感马上上线。','我在后台整理思路。'],
  tea:['茶要慢慢喝，灵感慢慢来。','先给脑袋续一杯。'],
  phone:['这条看完就收手机。','摸鱼片刻，灵感充电。'],
  music:['耳机一戴，世界安静。','这首听完，刚好有灵感。'],
  stretch:['伸个懒腰，思路也松一松。','我先活动一下脖子。'],
  doodle:['伟大的点子，也可以从涂鸦开始。','看起来在发呆，其实在酝酿。'],
  'typing-storm':['今天的键盘，有点烫手。','手速跟上，思路别掉队。'],
  'screen-dive':['我和需求，总得先理顺一个。','让我再靠近一点这个问题。'],
  'idea-spark':['办法总比问题多。','先把眼前这一小步做好。'],
  'coffee-rush':['专注加载中，咖啡别停。','忙归忙，思路要稳。']
};
export function ambientProfile(runState,choice=0){
  const modes=['idle','draft','todo'].includes(runState)?idle:['active','recent','starting'].includes(runState)?working:[];
  if(!modes.length)return null;
  const n=Math.abs(Math.floor(choice)),mode=modes[n%modes.length];
  return {mode,speech:lines[mode][Math.floor(n/modes.length)%lines[mode].length],kind:modes===idle?'idle':'working'};
}

export function profileForMode(mode,choice=0){const list=lines[mode];return list?{mode,speech:list[Math.abs(choice|0)%list.length],kind:['typing-storm','screen-dive','idea-spark','coffee-rush'].includes(mode)?'working':'idle'}:null;}
