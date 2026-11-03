import { createInterface } from 'node:readline';
import { PaymentStore } from './core.mjs';
import { createMcpHandler } from './mcp.mjs';
import { createHttp } from './http.mjs';

const port = Number(process.env.BELAGENT_PORT || 7417);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('BELAGENT_PORT must be an unprivileged TCP port (1024-65535)');
}

const allowlist = (process.env.BELAGENT_ALLOWLIST || '').split(',').map(x => x.trim()).filter(Boolean);
const storePath = process.env.BELAGENT_STORE_PATH || null;

const store = new PaymentStore({
  mode: process.env.BELAGENT_MODE || 'demo',
  allowlist,
  storePath,
  maxPerPayment: process.env.BELAGENT_MAX_PAYMENT_BDX || '2',
  maxDaily: process.env.BELAGENT_MAX_DAILY_BDX || '5'
});

const server = createHttp(store, port);
server.listen(port, '127.0.0.1', () => {
  console.error(`[BelAgent] local approval UI http://127.0.0.1:${port} | mode=${store.mode}${storePath ? ` | storage=${storePath}` : ''}`);
});

// Periodic cleanup of stale terminal records (every hour)
const pruneTimer = setInterval(() => {
  try {
    store.prune();
  } catch (e) {
    console.error('[BelAgent] Prune error:', e.message);
  }
}, 60 * 60 * 1000);
pruneTimer.unref();

const handle = createMcpHandler(store, `http://127.0.0.1:${port}`);
const input = createInterface({ input: process.stdin, terminal: false, crlfDelay: Infinity });

input.on('line', async line => {
  try {
    const msg = JSON.parse(line);
    const reply = await handle(msg);
    if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
  } catch (e) {
    console.error('[BelAgent] invalid input', e.message);
  }
});

input.on('close', () => {
  clearInterval(pruneTimer);
  server.close();
});
