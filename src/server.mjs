import {createInterface} from 'node:readline';
import {PaymentStore} from './core.mjs';
import {createMcpHandler} from './mcp.mjs';
import {createHttp} from './http.mjs';

const port=Number(process.env.BELAGENT_PORT||7417);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('BELAGENT_PORT must be an unprivileged TCP port');
const allowlist=(process.env.BELAGENT_ALLOWLIST||'').split(',').map(x=>x.trim()).filter(Boolean);
const store=new PaymentStore({mode:process.env.BELAGENT_MODE||'demo',allowlist,
  maxPerPayment:process.env.BELAGENT_MAX_PAYMENT_BDX||'2',
  maxDaily:process.env.BELAGENT_MAX_DAILY_BDX||'5'});
const server=createHttp(store,port);
server.listen(port,'127.0.0.1',()=>console.error(`[BelAgent] local approval UI http://127.0.0.1:${port} | mode=${store.mode}`));
const handle=createMcpHandler(store,`http://127.0.0.1:${port}`);
const input=createInterface({input:process.stdin,terminal:false,crlfDelay:Infinity});
input.on('line',async line=>{
  try {
    const msg=JSON.parse(line);
    const reply=await handle(msg);
    if(reply)process.stdout.write(JSON.stringify(reply)+'\n');
  } catch(e){console.error('[BelAgent] invalid input',e.message);}
});
input.on('close',()=>server.close());
