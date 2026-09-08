require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { buildSnapshot } = require('../services/systemCObservatory.service');

const app = express();
const PORT = Number(process.env.VEXA_SYSTEM_C_PORT || 5051);
const INTERVAL = Math.max(3000, Number(process.env.VEXA_SYSTEM_C_INTERVAL_MS || 5000));
const HEARTBEAT_INTERVAL = Math.max(5000, Number(process.env.VEXA_SYSTEM_C_HEARTBEAT_MS || 10000));
const SSE_RETRY_MS = Math.max(1000, Number(process.env.VEXA_SYSTEM_C_SSE_RETRY_MS || 5000));
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
    'Cache-Control': 'no-cache, no-transform, private',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff',
  });
  res.flushHeaders?.();
  req.socket?.setKeepAlive?.(true, 15000);
  res.write(`retry: ${SSE_RETRY_MS}\n\n`);
  res.write(`event: connected\ndata: ${JSON.stringify({ success: true, connectedAt: new Date().toISOString() })}\n\n`);
  res.flush?.();

  let timer = null, heartbeatTimer = null, closed = false, busy = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) clearInterval(timer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  };
  const write = (event, data) => {
    if (closed || res.writableEnded || res.destroyed) return false;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      res.flush?.();
      return true;
    } catch {
      close();
      return false;
    }
  };
  const send = async () => {
    if (closed || busy) return;
    busy = true;
    try { write('snapshot', await buildSnapshot()); }
    catch { write('observatory-error', { success: false, message: 'Observatory snapshot failed', timestamp: new Date().toISOString() }); }
    finally { busy = false; }
  };

  req.once('close', close);
  req.once('aborted', close);
  res.once('close', close);
  res.once('error', close);
  heartbeatTimer = setInterval(() => {
    if (closed || res.writableEnded || res.destroyed) return close();
    try { res.write(`: heartbeat ${Date.now()}\n\n`); res.flush?.(); } catch { close(); }
  }, HEARTBEAT_INTERVAL);
  send();
  timer = setInterval(send, INTERVAL);
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, message: error.message || 'Observatory error' });
});

app.listen(PORT, () => console.log(`📡 VexaAccount System C Observatory listening on ${PORT}`));
