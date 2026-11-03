import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const ATOMIC = 1_000_000_000n;
const MAX_REASON = 160;
const RESERVED = new Set(['pending','wallet_prompt','submitted_unverified','outcome_unknown','demo_approved']);

export function toAtomic(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,9})?$/.test(value)) {
    throw new Error('Amount must be a positive decimal string with up to 9 fractional digits');
  }
  const [whole, fraction=''] = value.split('.');
  const amount = BigInt(whole) * ATOMIC + BigInt((fraction+'000000000').slice(0,9));
  if (amount <= 0n) throw new Error('Amount must be greater than zero');
  return amount;
}

export function fromAtomic(value) {
  const b = BigInt(value);
  const whole = (b/ATOMIC).toString();
  const frac = (b%ATOMIC).toString().padStart(9,'0').replace(/0+$/,'');
  return frac ? `${whole}.${frac}` : whole;
}

export function validateTestnetAddress(value) {
  // Deliberately a SHAPE pre-screen, not a checksum validator.
  // Beldex wallet / SDK must validate the address before signing.
  return typeof value === 'string' && /^[9AB][1-9A-HJ-NP-Za-km-z]{89,119}$/.test(value);
}

function textSafe(value, max=MAX_REASON) {
  return typeof value === 'string' && value.length>0 && value.length<=max &&
    !/[\u0000-\u001f\u007f]/.test(value);
}
function token() { return randomBytes(24).toString('hex'); }
function hashIntent(r) {
  return createHash('sha256').update(JSON.stringify({
    id: r.id, network:r.network,to:r.to,amount_atomic:r.amount_atomic,
    reason:r.reason, created_at:r.created_at
  })).digest('hex');
}
function safeCompare(a,b) {
  if (typeof a!=='string' || typeof b!=='string') return false;
  const x=Buffer.from(a); const y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}

export class PaymentStore {
  constructor({ mode='demo', maxPerPayment='2', maxDaily='5', ttlMs=10*60_000, allowlist=[] , now=()=>Date.now()}={}) {
    if (!['demo','testnet'].includes(mode)) throw new Error('BELAGENT_MODE must be demo or testnet');
    this.mode=mode; this.maxPerPayment=toAtomic(maxPerPayment); this.maxDaily=toAtomic(maxDaily);
    this.ttlMs=ttlMs; this.allowlist=new Set(allowlist); this.now=now; this.map=new Map();
    // In real-wallet mode, an explicit recipient allowlist prevents accidentally approving an arbitrary agent target.
    if (mode==='testnet' && this.allowlist.size===0) throw new Error('Set BELAGENT_ALLOWLIST for testnet mode');
  }
  _expire(r) {
    if ((r.status==='pending' || r.status==='wallet_prompt') && this.now()>=r.expires_ms) {
      r.status = r.status==='wallet_prompt' ? 'outcome_unknown' : 'expired';
      r.updated_ms=this.now();
    }
    return r;
  }
  _private(r) {
    this._expire(r);
    const { capability, ...rest }=r;
    return {...rest};
  }
  get(id) {
    const r=this.map.get(id); if(!r) throw new Error('Unknown request');
    return this._private(r);
  }
  _getByCapability(id,capability) {
    const r=this.map.get(id);
    if (!r || !safeCompare(r.capability,capability)) throw new Error('Invalid request capability');
    this._expire(r); return r;
  }
  create({to, amount_bdx, reason, requester='AI assistant'}={}) {
    if(!validateTestnetAddress(to)) throw new Error('Expected a Beldex testnet address (shape check only)');
    if(!textSafe(reason)) throw new Error('Reason required (1–160 printable characters)');
    if(!textSafe(requester,60)) throw new Error('Requester required (1–60 printable characters)');
    if(this.mode==='testnet' && !this.allowlist.has(to)) throw new Error('Recipient not on local testnet allowlist');
    const amount=toAtomic(amount_bdx);
    if(amount>this.maxPerPayment) throw new Error('Exceeds per-payment limit');
    const today=new Date(this.now()).toISOString().slice(0,10);
    let reserved=0n;
    for (const r of this.map.values()) {
      this._expire(r);
      if(r.day===today && RESERVED.has(r.status)) reserved+=BigInt(r.amount_atomic);
    }
    if(reserved+amount>this.maxDaily) throw new Error('Exceeds daily aggregate limit (includes pending requests)');
    const id=token(); const capability=token();
    const r={id, capability, network:'testnet', mode:this.mode, to, amount_bdx:fromAtomic(amount),
      amount_atomic:amount.toString(), reason, requester, day:today, status:'pending',
      created_at:new Date(this.now()).toISOString(), expires_ms:this.now()+this.ttlMs,
      updated_ms:this.now(), tx_hash:null, receipt_kind:null, error:null};
    r.intent_sha256=hashIntent(r); this.map.set(id,r);
    return {request:this._private(r), capability};
  }
  getBrowser(id,capability){ return this._private(this._getByCapability(id,capability)); }
  advance(id,capability,action, data={}) {
    const r=this._getByCapability(id,capability);
    if(action==='decline') {
      if(r.status!=='pending') throw new Error('Cannot decline a non-pending request');
      r.status='declined';
    } else if(action==='start') {
      if(r.status!=='pending') throw new Error('Payment already started or closed');
      if(r.mode==='testnet' && !this.allowlist.has(r.to)) throw new Error('Recipient no longer allowed');
      r.status='wallet_prompt';
    } else if(action==='complete') {
      if(r.status!=='wallet_prompt') throw new Error('Payment not awaiting wallet');
      const status=data.status;
      if(status==='demo_approved') {
        if(r.mode!=='demo') throw new Error('Demo approval forbidden in testnet mode');
        r.status='demo_approved'; r.receipt_kind='SIMULATED_ONLY';
      } else if(status==='submitted_unverified') {
        if(r.mode!=='testnet') throw new Error('A mock cannot create a live transaction status');
        if(typeof data.tx_hash!=='string' || !/^[a-f\d]{64}$/i.test(data.tx_hash)) throw new Error('Invalid transaction hash');
        r.status='submitted_unverified'; r.tx_hash=data.tx_hash; r.receipt_kind='CLIENT_REPORTED_UNVERIFIED';
      } else if(status==='declined') {
        r.status='declined';
      } else if(status==='outcome_unknown') {
        r.status='outcome_unknown';
      } else throw new Error('Unsupported completion status');
      r.error=typeof data.error==='string' ? data.error.slice(0,160) : null;
    } else throw new Error('Unsupported action');
    r.updated_ms=this.now();
    return this._private(r);
  }
  info() {
    return {product:'BelAgent POC', mode:this.mode, chain:'Beldex testnet',
      non_custodial:true, max_per_payment_bdx:fromAtomic(this.maxPerPayment),
      daily_cap_bdx:fromAtomic(this.maxDaily), recipient_allowlist_enforced:this.mode==='testnet',
      claim:'Testable payment-request, policy and approval flow; not a mainnet production wallet.'};
  }
}
