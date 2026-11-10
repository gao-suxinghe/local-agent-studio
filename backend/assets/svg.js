export const NS='http://www.w3.org/2000/svg';
export function svg(tag,attributes={},...children){const node=document.createElementNS(NS,tag);for(const[key,value]of Object.entries(attributes))if(value!=null)node.setAttribute(key,String(value));for(const child of children.flat())if(child!=null)node.append(typeof child==='string'?document.createTextNode(child):child);return node;}
export const path=(d,fill='none',attrs={})=>svg('path',{d,fill,...attrs});
export const ellipse=(cx,cy,rx,ry,fill,attrs={})=>svg('ellipse',{cx,cy,rx,ry,fill,...attrs});
export const line=(x1,y1,x2,y2,stroke,width=1,attrs={})=>svg('line',{x1,y1,x2,y2,stroke,'stroke-width':width,'stroke-linecap':'round',...attrs});
export const text=(x,y,value,attrs={})=>svg('text',{x,y,...attrs},String(value??''));
export const short=(value,max=18)=>{const chars=Array.from(String(value||'').replace(/\s+/g,' '));return chars.length>max?chars.slice(0,max).join('')+'…':chars.join('');};
export function shade(color,factor){return '#'+color.slice(1).match(/../g).map(part=>Math.max(0,Math.min(255,Math.round(parseInt(part,16)*factor))).toString(16).padStart(2,'0')).join('');}
