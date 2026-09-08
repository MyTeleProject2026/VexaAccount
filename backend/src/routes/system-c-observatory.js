const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { buildSnapshot, WINDOW_MINUTES } = require('../services/systemCObservatory.service');

const router = express.Router();
const INTERVAL = Math.max(3000, Number(process.env.VEXA_SYSTEM_C_INTERVAL_MS || 5000));
const HEARTBEAT_INTERVAL = Math.max(5000, Number(process.env.VEXA_SYSTEM_C_HEARTBEAT_MS || 10000));
const SSE_RETRY_MS = Math.max(1000, Number(process.env.VEXA_SYSTEM_C_SSE_RETRY_MS || 5000));

router.use(requireSuperAdmin);

router.get('/health', async (req, res) => {
  try {
    const snapshot = await buildSnapshot();
    res.json({
      success: true,
      service: 'VexaAccount System C Observatory',
      database: snapshot.database,
      windowMinutes: WINDOW_MINUTES,
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

router.get('/snapshot', async (req, res, next) => {
  try {
    res.json(await buildSnapshot());
  } catch (error) {
    next(error);
  }
});

router.get('/stream', async (req, res) => {
  // This endpoint is intentionally long-lived. Keep it independent from normal
  // request deadlines and send bytes immediately so hosting proxies do not treat
  // an authenticated-but-idle connection as a stalled HTTP request.
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
    try {
      write('snapshot', await buildSnapshot());
    } catch (error) {
      write('observatory-error', {
        success: false,
        message: 'Observatory snapshot failed',
        timestamp: new Date().toISOString(),
      });
    } finally {
      busy = false;
    }
  };

  req.once('close', close);
  req.once('aborted', close);
  res.once('close', close);
  res.once('error', close);

  heartbeatTimer = setInterval(() => {
    if (closed || res.writableEnded || res.destroyed) return close();
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
      res.flush?.();
    } catch {
      close();
    }
  }, HEARTBEAT_INTERVAL);

  // Send one real payload immediately, then refresh at a bounded cadence.
  send();
  timer = setInterval(send, INTERVAL);
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, message: error.message || 'Observatory error' });
});

module.exports = router;
