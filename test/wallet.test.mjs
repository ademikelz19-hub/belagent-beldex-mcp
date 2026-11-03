import test from 'node:test';
import assert from 'node:assert/strict';
import {requestWalletTestnetSend} from '../public/wallet-bridge.js';
const address='9'+'A'.repeat(94);
const base={to:address,amount_atomic:'250000000',id:'idempotent-test-42'};
function fakeWallet(network='testnet',hasHash=true){
 const calls=[];
 const provider={request:async cmd=>{
   calls.push(cmd);
   if(cmd.method==='bdx_connect')return {address,network};
   if(cmd.method==='bdx_getNetwork')return {network};
   if(cmd.method==='bdx_sendTransaction')return hasHash?{txHash:'b'.repeat(64)}:{};
   throw new Error('unexpected wallet API');
 }};
 return {calls,provider};
}
test('extension adapter requires connect -> correct network -> local policy before wallet send',async()=>{
 const {calls,provider}=fakeWallet();let permitted=false;
 const r=await requestWalletTestnetSend({...base,provider,onBeforeSend:async()=>{
   assert.equal(calls.length,2);permitted=true;
 }});
 assert.equal(permitted,true);
 assert.deepEqual(calls.map(c=>c.method),['bdx_connect','bdx_getNetwork','bdx_sendTransaction']);
 assert.deepEqual(calls[2].params,{to:address,amount:'250000000',priority:1,idempotencyKey:'idempotent-test-42'});
 assert.equal(r.status,'submitted_unverified');
 assert.equal(r.tx_hash,'b'.repeat(64));
});
test('wrong wallet network blocks send and guard',async()=>{
 const {calls,provider}=fakeWallet('mainnet');let guard=false;
 await assert.rejects(requestWalletTestnetSend({...base,provider,onBeforeSend:()=>{guard=true;}}),/not on Beldex testnet/);
 assert.equal(guard,false);assert.deepEqual(calls.map(c=>c.method),['bdx_connect','bdx_getNetwork']);
});
test('guard rejection prevents wallet broadcast',async()=>{
 const {calls,provider}=fakeWallet();
 await assert.rejects(requestWalletTestnetSend({...base,provider,onBeforeSend:()=>{throw new Error('Rejected by policy');}}),/Rejected by policy/);
 assert.equal(calls.some(c=>c.method==='bdx_sendTransaction'),false);
});
test('missing tx hash is uncertain, not fabricated confirmation',async()=>{
 const {provider}=fakeWallet('testnet',false);
 const r=await requestWalletTestnetSend({...base,provider,onBeforeSend:async()=>{}});
 assert.equal(r.status,'outcome_unknown');assert.equal(r.tx_hash,undefined);
});
test('invalid atomic amount cannot reach wallet',async()=>{
 const {calls,provider}=fakeWallet();
 await assert.rejects(requestWalletTestnetSend({...base,provider,amount_atomic:'0.1',onBeforeSend:async()=>{}}),/Invalid atomic/);
 assert.equal(calls.length,0);
});
