require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { buildSnapshot } = require('../services/systemCObservatory.service');

const app = express();
const PORT = Number(process.env.VEXA_SYSTEM_C_PORT || 5051);
const INTERVAL = Math.max(1500, Number(process.env.VEXA_SYSTEM_C_INTERVAL_MS || 3000));
const origins = String(process.env.VEXA_SYSTEM_C_ALLOWED_ORIGINS || process.env.FRONTEND_ADMIN_URL || '')
  .split(',').map((value) => value.trim()).filter(Boolean);

app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => !origin || !origins.length || origins.includes(origin)
    ? callback(null, true)
    : callback(new Error('Origin not allowed')),
  credentials: true,
}));
app.use(requireSuperAdmin);

app.get('/health', async (req, res) => {
  try {
    const snapshot = await buildSnapshot();
    res.json({
      success: true,
      service: 'VexaAccount System C Observatory',
      database: snapshot.database,
      timestamp: snapshot.generatedAt,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'VexaAccount System C Observatory',
      database: false,
      message: 'Runtime health check failed',
    });
  }
});

app.get('/api/system-c/snapshot', async (req, res, next) => {
  try {
    res.json(await buildSnapshot());
  } catch (error) {
    next(error);
  }
});

app.get('/api/system-c/stream', async (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  // Prime the stream immediately so reverse proxies recognize this as an active SSE response.
  res.write('retry: 3000\n\n');
  res.flush?.();

  let timer = null;
  let heartbeatTimer = null;
  let closed = false;
  let busy = false;

  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) clearInterval(timer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  };
  const write = (event, data) => {
    if (!closed) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); res.flush?.(); }
  };
  const send = async () => {
    if (closed || busy) return;
    busy = true;
    try {
      write('snapshot', await buildSnapshot());
    } catch (error) {
      write('observatory-error', { success: false, message: 'Observatory snapshot failed' });
    } finally {
      busy = false;
    }
  };

  req.on('close', close);
  req.on('aborted', close);
  heartbeatTimer = setInterval(() => { if (!closed) { res.write(': heartbeat\n\n'); res.flush?.(); } }, 15000);
  await send();
  if (!closed) timer = setInterval(send, INTERVAL);
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, message: error.message || 'Observatory error' });
});

app.listen(PORT, () => console.log(`📡 VexaAccount System C Observatory listening on ${PORT}`));
