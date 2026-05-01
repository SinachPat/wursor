// ── Universal DOM Inspector Script ───────────────────────────────────────────
// Generates a self-contained IIFE that can be injected into ANY HTML page
// (React, Vue, static HTML — anything) via the CLI proxy or the live-sdk.
//
// What it does:
//  • Intercepts clicks → sends COMPONENT_SELECTED + ELEMENT_STYLES
//  • Responds to PATCH_ELEMENT_STYLE / REMOVE_ELEMENT / REQUEST_ELEMENT_STYLES
//  • Discovers routes from <a> links → sends ROUTES_DISCOVERED
//  • Applies SET_DESIGN_TOKENS as CSS custom properties on :root
//  • Sends READY once the DOM is interactive
//
// No React dependency. Works for any HTML page loaded in an Originmain iframe.

import { RENDERER_SOURCE, HOST_SOURCE } from './protocol.js';

/** Returns the injectable DOM inspector script as a string (IIFE). */
export function buildDomInspectorScript(): string {
  return `(function(){
/* ── Guard ─────────────────────────────────── */
var PREFIX='om:',SRC=${JSON.stringify(RENDERER_SOURCE)},HOST=${JSON.stringify(HOST_SOURCE)};
if(window.parent===window)return;
var aid='';
try{var n=window.name;if(typeof n==='string'&&n.indexOf(PREFIX)===0)aid=n.slice(PREFIX.length);}catch(_){}
if(!aid)return;

/* ── postMessage ────────────────────────────── */
function post(m){try{window.parent.postMessage({source:SRC,artboardId:aid,message:m},'*');}catch(_){}}

/* ── Element IDs ────────────────────────────── */
var seq=0;
function assignId(el){var cur=el.getAttribute('data-om');if(cur)return cur;var id=(++seq).toString(36);try{el.setAttribute('data-om',id);}catch(_){}return id;}
function byId(id){return document.querySelector('[data-om="'+id+'"]');}

/* ── Component name (React-aware) ───────────── */
function nameOf(el){
  var ks=Object.keys(el);
  for(var i=0;i<ks.length;i++){
    if(ks[i].indexOf('__reactFiber')!==0)continue;
    var f=el[ks[i]];
    while(f){var t=f.type;if(typeof t==='function'){var nm=t.displayName||t.name;if(nm&&!/^[a-z]/.test(nm))return nm;}f=f.return;}
  }
  var tag=(el.tagName||'el').toLowerCase();
  var id2=el.id?'#'+el.id:'';
  var cls='';
  if(el.className&&typeof el.className==='string'){var fc=el.className.trim().split(/\\s+/)[0];if(fc)cls='.'+fc;}
  return tag+(id2||cls);
}

/* ── CSS capture ────────────────────────────── */
var PROPS=['width','height','display','position','top','left','right','bottom',
  'padding-top','padding-right','padding-bottom','padding-left',
  'margin-top','margin-right','margin-bottom','margin-left',
  'background-color','color','font-size','font-weight','font-family',
  'line-height','letter-spacing','text-align','border-radius',
  'border-width','border-color','border-style','box-shadow','opacity',
  'flex-direction','align-items','justify-content','gap','overflow','z-index'];
function capStyles(el){var cs=window.getComputedStyle(el),out={};for(var i=0;i<PROPS.length;i++){var v=cs.getPropertyValue(PROPS[i]);if(v)out[PROPS[i]]=v;}return out;}
function capRect(el){var r=el.getBoundingClientRect();return{x:r.left,y:r.top,width:r.width,height:r.height};}

/* ── Selection highlight ────────────────────── */
var selEl=null;
function ensureCss(){
  if(document.getElementById('om-css'))return;
  var s=document.createElement('style');s.id='om-css';
  s.textContent='[data-om-s]{outline:2px solid rgba(51,133,255,0.85)!important;outline-offset:1px!important;}';
  (document.head||document.documentElement).appendChild(s);
}
function selectEl(el){if(selEl)selEl.removeAttribute('data-om-s');selEl=el;if(el)el.setAttribute('data-om-s','');}

/* ── Click handler ──────────────────────────── */
document.addEventListener('click',function(e){
  e.preventDefault();e.stopPropagation();
  var el=e.target;
  if(!el||el===document.documentElement||el===document.body){selectEl(null);post({type:'COMPONENT_DESELECTED'});return;}
  var id=assignId(el);
  selectEl(el);
  post({type:'COMPONENT_SELECTED',nodeId:id,nodeName:nameOf(el),rect:capRect(el)});
  post({type:'ELEMENT_STYLES',nodeId:id,styles:capStyles(el)});
},true);

/* ── Host messages ──────────────────────────── */
window.addEventListener('message',function(e){
  var d=e.data;
  if(!d||d.source!==HOST||d.artboardId!==aid)return;
  var m=d.message||{};var el;
  if(m.type==='PATCH_ELEMENT_STYLE'){el=byId(m.nodeId);if(el)el.style.setProperty(m.property,m.value);}
  else if(m.type==='REMOVE_ELEMENT'){el=byId(m.nodeId);if(el)el.style.display='none';}
  else if(m.type==='REQUEST_ELEMENT_STYLES'){el=byId(m.nodeId);if(el)post({type:'ELEMENT_STYLES',nodeId:m.nodeId,styles:capStyles(el)});}
  else if(m.type==='SELECT_COMPONENT'){el=byId(m.nodeId);selectEl(el||null);}
  else if(m.type==='DESELECT'){selectEl(null);}
  else if(m.type==='SET_DESIGN_TOKENS'){var tks=m.tokens||{},ks=Object.keys(tks);for(var i=0;i<ks.length;i++)document.documentElement.style.setProperty(ks[i],tks[ks[i]]);}
  else if(m.type==='NAVIGATE'){if(m.path)window.location.pathname=m.path;}
});

/* ── Route discovery ────────────────────────── */
function discoverRoutes(){
  var seen=Object.create(null),out=[];
  var as=document.querySelectorAll('a[href]');
  for(var i=0;i<as.length;i++){
    try{
      var url=new URL(as[i].href,window.location.href);
      if(url.origin!==window.location.origin)continue;
      var p=url.pathname;if(seen[p])continue;seen[p]=true;
      var label=(as[i].textContent||'').trim().slice(0,40)||p;
      out.push({path:p,label:label});
    }catch(_){}
  }
  if(out.length)post({type:'ROUTES_DISCOVERED',routes:out});
}

/* ── Init ───────────────────────────────────── */
function init(){ensureCss();post({type:'READY'});discoverRoutes();}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();`;
}

/**
 * @deprecated Use buildDomInspectorScript() instead.
 * Kept for backward compatibility — now returns the DOM inspector, not the fiber hook.
 */
export function buildProxyFiberHookScript(): string {
  return buildDomInspectorScript();
}
