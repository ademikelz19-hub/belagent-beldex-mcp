import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const PUB=join(dirname(fileURLToPath(import.meta.url)),'..','public');
const MAX_BODY=2048;
const headers={
  'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};
function json(res,status,obj) { res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj)); }
function fail(res,status,message){json(res,status,{error:message});}
async function parse(req) {
  let text=''; for await (const chunk of req) {text+=chunk.toString();if(text.length>MAX_BODY) throw new Error('Body too large');}
  try {return text ? JSON.parse(text):{};} catch {throw new Error('Invalid JSON');}
}
function sameOrigin(req,port) {
  const origin=req.headers.origin;
  return origin===`http://127.0.0.1:${port}`;
}
export function createHttp(store,port) {
  return http.createServer(async (req,res)=>{
    // DNS rebinding hardening: only literal loopback host.
    if(req.headers.host!==`127.0.0.1:${port}`) return fail(res,403,'Invalid host');
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    try {
      if(req.method==='GET' && (url.pathname==='/' || url.pathname.startsWith('/review/'))) {
        const s=await readFile(join(PUB,'index.html'));
        res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'});return res.end(s);
      }
      if(req.method==='GET' && (url.pathname==='/app.js'||url.pathname==='/wallet-bridge.js'||url.pathname==='/style.css')) {
        const type=url.pathname.endsWith('js')?'application/javascript':'text/css';
        const s=await readFile(join(PUB,url.pathname.slice(1)));
        res.writeHead(200,{...headers,'Content-Type':type+'; charset=utf-8'});return res.end(s);
      }
      if(req.method==='GET' && url.pathname==='/api/meta') return json(res,200,store.info());
      const m=url.pathname.match(/^\/api\/request\/([a-f0-9]{48})\/([a-f0-9]{48})(?:\/(start|decline|complete))?$/);
      if(m){
        const [,id,capability,action]=m;
        if(req.method==='GET'&&!action) return json(res,200,store.getBrowser(id,capability));
        if(req.method==='POST'&&action) {
          if(!sameOrigin(req,port))return fail(res,403,'Cross-origin actions blocked');
          if(req.headers['content-type']?.split(';')[0]!=='application/json')return fail(res,415,'Expected JSON');
          return json(res,200,store.advance(id,capability,action,await parse(req)));
        }
      }
      fail(res,404,'Not found');
    } catch(e) {fail(res,400,e.message);}
  });
}
