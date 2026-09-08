const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { buildSnapshot, WINDOW_MINUTES } = require('../services/systemCObservatory.service');

const router = express.Router();
const INTERVAL = Math.max(1500, Number(process.env.VEXA_SYSTEM_C_INTERVAL_MS || 3000));

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
      write('observatory-error', {
        success: false,
        message: 'Observatory snapshot failed',
      });
    } finally {
      busy = false;
    }
  };

  req.on('close', close);
  req.on('aborted', close);
  heartbeatTimer = setInterval(() => {
    if (!closed) { res.write(': heartbeat\n\n'); res.flush?.(); }
  }, 15000);

  await send();
  if (!closed) timer = setInterval(send, INTERVAL);
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, message: error.message || 'Observatory error' });
});

module.exports = router;
