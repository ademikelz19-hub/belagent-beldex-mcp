/**
 * Injectable adapter for the Beldex extension provider wire API.
 * No secret keys are handled by this adapter. Wallet signing must stay in the extension.
 * This file is browser + Node testable and uses no runtime dependencies.
 */
export async function requestWalletTestnetSend({provider,to,amount_atomic,id,onBeforeSend}) {
  if (!provider || typeof provider.request!=='function') throw new Error('Beldex extension provider not available');
  if (typeof to!=='string'||!to || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(to)) throw new Error('Missing or malformed destination');
  if(typeof amount_atomic!=='string'||!/^[1-9]\d*$/.test(amount_atomic)) throw new Error('Invalid atomic amount');
  if(typeof id!=='string'||!id) throw new Error('Missing payment idempotency key');
  if(typeof onBeforeSend!=='function') throw new Error('Missing local policy/authorization guard');
  await provider.request({method:'bdx_connect'});
  const reply=await provider.request({method:'bdx_getNetwork'});
  const network=typeof reply==='string'?reply:(reply?.network||reply?.name||'');
  if(network.toLowerCase()!=='testnet')throw new Error('Wallet is not on Beldex testnet');
  await onBeforeSend(); // single-use local transition, only AFTER network guard
  const result=await provider.request({method:'bdx_sendTransaction',params:{to,amount:amount_atomic,priority:1,idempotencyKey:id}});
  const txHash=typeof result==='object'?(result?.txHash||result?.tx_hash):null;
  return (typeof txHash==='string' && /^[a-f0-9]{64}$/i.test(txHash)) ? {status:'submitted_unverified',tx_hash:txHash} : {status:'outcome_unknown',error:'No valid wallet tx hash; do not blindly retry'};
}
