import {requestWalletTestnetSend} from './wallet-bridge.js';
const $ = id => document.getElementById(id);
const parts=location.pathname.match(/^\/review\/([a-f0-9]{48})\/([a-f0-9]{48})$/);
const path=parts?`/api/request/${parts[1]}/${parts[2]}`:null;
let request=null, meta=null, busy=false;
function setText(id,value){$(id).textContent=String(value??'');}
function state(text){setText('status',text);}
function alert(text){$('notice').hidden=false;setText('notice',text);}
async function api(action='',method='GET',body){
 const opts={method,cache:'no-store',headers:{}};
 if(method==='POST'){opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body||{});}
 const response=await fetch(path+action,opts); const obj=await response.json();
 if(!response.ok)throw new Error(obj.error||`HTTP ${response.status}`);
 return obj;
}
function render(r){
 request=r; $('payment').hidden=false; $('notice').hidden=true;
 setText('mode',r.mode==='demo'?'SIMULATED · NO CHAIN SEND':'LIVE TESTNET · WALLET REQUIRED');
 setText('state',r.status.replaceAll('_',' '));
 setText('destination',r.to);setText('amount',r.amount_bdx);setText('purpose',r.reason);
 setText('requester',r.requester);setText('hash',r.intent_sha256);
 setText('expiry',new Date(r.expires_ms).toLocaleTimeString());
 $('approve').textContent=r.mode==='demo'?'Simulate user + wallet approval':'Continue to Beldex wallet';
 const actionable=r.status==='pending' && !busy;
 $('approve').disabled=!actionable;$('decline').disabled=!actionable;
 const info={pending:'Nothing has been sent. Human action is required.',
 declined:'The payment was declined. No send was requested.',
 expired:'Approval request expired without sending.',
 wallet_prompt:'Wallet interaction started; do not create another request or retry a potentially unknown send.',
 demo_approved:'SIMULATED APPROVAL ONLY. No blockchain transaction exists.',
 submitted_unverified:'Wallet reported a transaction hash. Blockchain settlement is NOT independently verified.',
 outcome_unknown:'Send outcome is unknown. Do not retry blindly; reconcile within the Beldex wallet.'};
 state(info[r.status]||'Request status updated.');
 if(r.tx_hash) state(`${info[r.status]} Reported tx hash: ${r.tx_hash}`);
}
async function refresh(){if(!path){alert('No payment request in this URL. Start the MCP server and call belagent_request_payment from an MCP client.');state('Open a generated approval link to review a payment.');return;}
 try{render(await api());}catch(e){alert(e.message);state('Unable to retrieve payment request.');}}
async function decline(){if(!request||busy)return;busy=true;try{render(await api('/decline','POST'));}catch(e){alert(e.message);}finally{busy=false;}}
function getInjectedProvider(){return window.beldex||null;}
async function doLive(r){
 const result=await requestWalletTestnetSend({
   provider:getInjectedProvider(),to:r.to,amount_atomic:r.amount_atomic,id:r.id,
   onBeforeSend:()=>api('/start','POST')
 });
 await api('/complete','POST',result);
}

async function approve(){if(!request||busy||request.status!=='pending')return;
 busy=true;$('approve').disabled=true;$('decline').disabled=true;
 try {
   if(request.mode==='demo') {await api('/start','POST');await api('/complete','POST',{status:'demo_approved'});}
   else await doLive(request);
 }catch(e){
   // 4001 is explicit rejection. Other wallet errors may be ambiguous; never encourage blind retry.
   try{
     const latest=await api();
     if(latest.status==='wallet_prompt') await api('/complete','POST',{
       status:e?.code===4001?'declined':'outcome_unknown',error:String(e?.message||e)
     });
   }catch{}
   alert(`${e.message||String(e)}. If the wallet started a send, check its history before attempting anything else.`);
 }finally{busy=false;try{render(await api());}catch{}}
}
async function init(){
 try{meta=await (await fetch('/api/meta')).json();setText('policy',`Local spending policy: ${meta.max_per_payment_bdx} BDX per request, ${meta.daily_cap_bdx} BDX reserved per UTC day. ${meta.recipient_allowlist_enforced?'Recipient allowlist active.':'Recipient allowlist not enforced in demo mode.'}`);}catch{}
 await refresh();
 $('approve').addEventListener('click',approve);$('decline').addEventListener('click',decline);
}
init();
