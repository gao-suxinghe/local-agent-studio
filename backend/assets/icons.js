import {svg,path} from './svg.js';
const strokes={
  office:['M4 4h16v16H4z','M10 4v16M4 10h6M14 8h2m-2 4h2m-2 4h2'],
  note:['M6 3h9l4 4v14H6z','M14 3v5h5M9 12h7m-7 4h5'],
  board:['M4 4h16v16H4z','M9 4v16m6-16v16M6 8h1m4 0h2m4 0h1M6 12h1m4 0h2'],
  chat:['M5 4h14v12H9l-5 4V5z','M8 8h8m-8 4h5'],
  plus:['M12 5v14M5 12h14'],minus:['M5 12h14'],close:['m6 6 12 12M6 18 18 6'],
  search:['M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13','m16 16 5 5'],
  arrow:['M5 12h14m-6-6 6 6-6 6'],left:['m14 5-7 7 7 7'],right:['m9 5 7 7-7 7'],
  refresh:['M19 8a8 8 0 1 0 0 9','M19 3v6h-6'],
  settings:['M5 7h14M5 17h14','M9 4v6m6 4v6'],
  motion:['M4 12c2-8 6-8 8 0s6 8 8 0','M4 18h4m8-12h4'],
  bubble:['M4 4h16v12h-9l-6 5v-5H4z','M8 9h1m3 0h1m3 0h1'],
  expand:['M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5'],
  fit:['M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5','M8 8h8v8H8z'],
  hand:['M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9q-1 5-6 5h-1q-3 0-5-3l-3-5q-1-3 2-2l3 3'],
  city:['M4 20V9h7v11m0-16h9v16M2 20h20','M7 12v1m0 3v1m8-10h1m-1 4h1m-1 4h1'],
  leaf:['M20 4Q5 2 4 13q-1 7 6 7Q22 18 20 4Z','M5 20 16 9M9 16v-5m4 1h4'],
  orbit:['M8 6a6 6 0 1 1-3 5','M4 4q7-3 15 6t0 11q-5 2-13-7T4 4Z'],
  info:['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18','M12 11v6m0-10v1'],
  folder:['M3 7h7l2 2h9v11H3z','M3 7V4h7l2 3'],
  check:['m5 12 4 4L19 6'],inbox:['M4 5h16l2 14H2z','M3 14h5l2 3h4l2-3h5'],
  queue:['M7 6h13M7 12h13M7 18h13M3 6h.1M3 12h.1M3 18h.1'],
  keyboard:['M3 6h18v13H3z','M6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M7 16h10'],
  people:['M8 4a3 3 0 1 0 0 6a3 3 0 0 0 0-6','M2 20v-3q0-5 6-5t6 5v3M17 5a3 3 0 0 1 0 6m1 2q4 1 4 5v2'],
  clock:['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18','M12 7v6l4 2']
};
export function icon(name,size=20){return svg('svg',{viewBox:'0 0 24 24',width:size,height:size,fill:'none',stroke:'currentColor','stroke-width':1.55,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:'ui-icon'},...(strokes[name]||strokes.info).map(d=>path(d)));}
export function mountIcons(root=document){for(const node of root.querySelectorAll('[data-icon]'))if(node.dataset.iconMounted!==node.dataset.icon){node.replaceChildren(icon(node.dataset.icon));node.dataset.iconMounted=node.dataset.icon;}}
