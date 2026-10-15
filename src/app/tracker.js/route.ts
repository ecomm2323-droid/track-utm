// Served at /tracker.js. Plain ES5 so it runs on any landing/checkout page.
const SCRIPT = `(function(){
var s=document.currentScript;if(!s)return;
var key=s.getAttribute('data-key');if(!key)return;
var base=new URL(s.src).origin;
var deco=(s.getAttribute('data-decorate')||'').split(',').map(function(x){return x.trim()}).filter(Boolean);
var P=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ca_id','as_id','ad_id','placement','fbclid'];
var LS='_ut_p',SS='_ut_last';
function ok(){return window.utConsent!==false}
function rd(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null}
function wr(n,v,d){try{document.cookie=n+'='+encodeURIComponent(v)+';max-age='+d*86400+';path=/;SameSite=Lax'+(location.protocol==='https:'?';Secure':'')}catch(e){}}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c=='x'?r:r&3|8).toString(16)})}
function vid(){var v=rd('_ut_vid');try{v=v||localStorage.getItem('_ut_vid')}catch(e){}if(!v)v=uuid();wr('_ut_vid',v,180);try{localStorage.setItem('_ut_vid',v)}catch(e){}return v}
function send(path,b){b.key=key;var d=JSON.stringify(b);try{if(navigator.sendBeacon&&navigator.sendBeacon(base+path,new Blob([d],{type:'text/plain'})))return}catch(e){}try{fetch(base+path,{method:'POST',body:d,headers:{'Content-Type':'text/plain'},keepalive:true,mode:'cors'})}catch(e){}}
function params(){var q=new URLSearchParams(location.search),o={},any=false;P.forEach(function(k){var v=q.get(k);if(v){o[k]=v;any=true}});return any?o:null}
function fbc(p){var c=rd('_fbc');if(!c&&p&&p.fbclid){c='fb.1.'+Date.now()+'.'+p.fbclid;wr('_fbc',c,90)}return c}
function touch(){
if(!ok())return;
var p=params(),ref='';
try{if(document.referrer&&new URL(document.referrer).host!==location.host)ref=document.referrer}catch(e){}
if(p){try{localStorage.setItem(LS,JSON.stringify(p))}catch(e){}}
if(!p&&!ref)return;
var sig=JSON.stringify([p,ref]);
try{if(sessionStorage.getItem(SS)===sig)return;sessionStorage.setItem(SS,sig)}catch(e){}
var b=p||{};b.vid=vid();b.referrer=ref;b.url=location.href;b.fbc=fbc(p);b.fbp=rd('_fbp');
send('/api/collect',b)}
function decorate(e){
if(!ok())return;
var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a||!deco.length)return;
var u;try{u=new URL(a.href,location.href)}catch(x){return}
if(u.host===location.host)return;
if(deco.indexOf('*')<0&&!deco.some(function(h){return u.host===h||u.host.endsWith('.'+h)}))return;
var st={};try{st=JSON.parse(localStorage.getItem(LS)||'{}')}catch(x){}
Object.keys(st).forEach(function(k){if(!u.searchParams.has(k))u.searchParams.set(k,st[k])});
var v=vid();u.searchParams.set('ut_vid',v);if(!u.searchParams.has('sck'))u.searchParams.set('sck','ut_'+v);
a.href=u.toString()}
if(ok())vid();
touch();
document.addEventListener('click',decorate,true);
var ps=history.pushState;history.pushState=function(){var r=ps.apply(this,arguments);setTimeout(touch,0);return r};
window.addEventListener('popstate',function(){setTimeout(touch,0)});
window.utmify={
vid:function(){return vid()},
lastEventId:null,
consent:function(v){window.utConsent=!!v;if(v){vid();touch()}},
track:function(name,o){if(!ok())return null;o=o||{};var id=o.event_id||uuid();
send('/api/events',{vid:vid(),event:name,value:o.value,currency:o.currency,order_id:o.order_id,event_id:id,url:location.href,fbc:fbc(null),fbp:rd('_fbp'),email:o.email});
this.lastEventId=id;return id}};
})();`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
