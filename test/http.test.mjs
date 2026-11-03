import test from 'node:test';
import assert from 'node:assert/strict';
import {PaymentStore} from '../src/core.mjs';
import {createHttp} from '../src/http.mjs';
const address='9'+'A'.repeat(94);

test('local web approval route, same-origin enforcement, one-time action',async()=>{
 const port=39000+Math.floor(Math.random()*1000);
 const p=new PaymentStore(); const {request,capability}=p.create({to:address,amount_bdx:'0.5',reason:'POC test'});
 const s=createHttp(p,port);await new Promise(resolve=>s.listen(port,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${port}`,path=`/api/request/${request.id}/${capability}`;
 try {
   const page=await fetch(base+`/review/${request.id}/${capability}`);
   assert.equal(page.status,200); assert.match(await page.text(),/Review payment intent/);
   const detail=await (await fetch(base+path)).json();assert.equal(detail.status,'pending');
   const forbidden=await fetch(base+path+'/start',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://malicious.example'},body:'{}'});
   assert.equal(forbidden.status,403);
   assert.equal((await (await fetch(base+path)).json()).status,'pending');
   const approved=await fetch(base+path+'/start',{method:'POST',headers:{'Content-Type':'application/json','Origin':base},body:'{}'});
   assert.equal(approved.status,200);
   const repeat=await fetch(base+path+'/start',{method:'POST',headers:{'Content-Type':'application/json','Origin':base},body:'{}'});
   assert.equal(repeat.status,400);
   const complete=await fetch(base+path+'/complete',{method:'POST',headers:{'Content-Type':'application/json','Origin':base},body:JSON.stringify({status:'demo_approved'})});
   assert.equal(complete.status,200);
   assert.equal((await complete.json()).receipt_kind,'SIMULATED_ONLY');
 }finally{await new Promise(resolve=>s.close(resolve));}
});
