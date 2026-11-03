import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
const port=19000+Math.floor(Math.random()*20000);
const p=spawn(process.execPath,['src/server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,BELAGENT_PORT:String(port),BELAGENT_MODE:'demo'},stdio:['pipe','pipe','pipe']});
const rl=createInterface({input:p.stdout});
const lines=[];rl.on('line',line=>lines.push(JSON.parse(line)));
async function rpc(id,method,params={}){
 p.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
 for(let i=0;i<150;i++){const index=lines.findIndex(x=>x.id===id);if(index>=0)return lines.splice(index,1)[0];await new Promise(r=>setTimeout(r,20));}
 throw new Error('MCP response timed out');
}
const addr='9'+'A'.repeat(94); // synthetic shape-only testnet address: never use for REAL sends
try{
 const init=await rpc(1,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'POC test',version:'1'}});
 const list=await rpc(2,'tools/list');
 const result=await rpc(3,'tools/call',{name:'belagent_request_payment',arguments:{to:addr,amount_bdx:'0.25',reason:'Demonstration subscription',requester:'Demo MCP client'}});
 const item=JSON.parse(result.result.content[0].text);
 const u=new URL(item.approval_url);
 const path=`/api/request/${item.id}/${u.pathname.split('/').at(-1)}`;
 const post=async (action)=>{
  const r=await fetch(`http://127.0.0.1:${port}${path}/${action}`,{method:'POST',headers:{origin:`http://127.0.0.1:${port}`,'content-type':'application/json'},body:'{}'});
  if(!r.ok)throw new Error(JSON.stringify(await r.json())); return r.json();
 };
 const review=await (await fetch(`http://127.0.0.1:${port}${path}`)).json();
 await post('start');
 const complete=await (await fetch(`http://127.0.0.1:${port}${path}/complete`,{method:'POST',headers:{origin:`http://127.0.0.1:${port}`,'content-type':'application/json'},body:JSON.stringify({status:'demo_approved'})})).json();
 const status=await rpc(4,'tools/call',{name:'belagent_payment_status',arguments:{request_id:item.id}});
 console.log(JSON.stringify({mcp_handshake:init.result.serverInfo,tools:list.result.tools.map(t=>t.name),original_status:review.status,final_status:complete.status,
   receipt_kind:complete.receipt_kind,chain_transaction_created:false,status_tool:JSON.parse(status.result.content[0].text).status,approval_url:item.approval_url},null,2));
}finally{p.stdin.end();p.kill('SIGTERM');}
