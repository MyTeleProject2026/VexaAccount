const crypto = require('crypto');

const jobs = new Map();
const subscribers = new Map();
const MAX_EVENTS = 500;
const RETAIN_MS = 6 * 60 * 60 * 1000;
const HEARTBEAT_MS = 5000;
const STALL_MS = 90 * 1000;
const MAX_RUNTIME_MS = 30 * 60 * 1000;

function id() { return crypto.randomUUID(); }
function clean(value, fallback = '') { return String(value ?? fallback).slice(0, 500); }
function terminal(status) { return ['completed', 'failed', 'cancelled', 'stalled'].includes(status); }

function create({ type, label = type, run }) {
  if (typeof run !== 'function') throw new TypeError('Owner operation requires a run function');
  const controller = new AbortController();
  const operation = {
    id: id(), type: clean(type, 'owner-operation'), label: clean(label, type), status: 'queued', phase: 'QUEUED',
    progress: 0, detail: 'Queued', events: [], result: null, error: null,
    createdAt: new Date().toISOString(), startedAt: null, completedAt: null,
    lastHeartbeatAt: null, cancelRequested: false, controller
  };
  jobs.set(operation.id, operation);
  setImmediate(() => execute(operation, run));
  return snapshot(operation);
}

function snapshot(operation) {
  const copy = { ...operation };
  delete copy.controller;
  return JSON.parse(JSON.stringify(copy));
}
function get(operationId) {
  const operation = jobs.get(String(operationId || ''));
  return operation ? snapshot(operation) : null;
}

function emit(operation, phase, detail, progress = operation.progress, kind = 'event') {
  const event = {
    at: new Date().toISOString(),
    phase: clean(phase, operation.phase || 'RUNNING').toUpperCase(),
    detail: clean(detail, 'Working…'),
    progress: Number.isFinite(Number(progress)) ? Math.max(0, Math.min(100, Number(progress))) : operation.progress,
    kind
  };
  operation.events.push(event);
  if (operation.events.length > MAX_EVENTS) operation.events.splice(0, operation.events.length - MAX_EVENTS);
  const listeners = subscribers.get(operation.id);
  if (listeners) for (const listener of [...listeners]) {
    try { listener(snapshot(operation), event); } catch (_) {}
  }
}

function heartbeat(operation, detail, emitEvent = false) {
  operation.lastHeartbeatAt = new Date().toISOString();
  if (emitEvent) emit(operation, operation.phase || 'HEARTBEAT', detail || 'Server worker is alive.', operation.progress, 'heartbeat');
}

function context(operation) {
  return {
    id: operation.id,
    signal: operation.controller.signal,
    progress(phase, detail, progress) {
      if (operation.cancelRequested || operation.controller.signal.aborted) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
      operation.status = 'running';
      operation.phase = clean(phase, operation.phase || 'RUNNING').toUpperCase();
      operation.detail = clean(detail, 'Working…');
      if (Number.isFinite(Number(progress))) operation.progress = Math.max(0, Math.min(100, Number(progress)));
      heartbeat(operation);
      emit(operation, operation.phase, operation.detail, operation.progress);
    },
    event(phase, detail, progress) {
      if (operation.cancelRequested || operation.controller.signal.aborted) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
      if (Number.isFinite(Number(progress))) operation.progress = Math.max(0, Math.min(100, Number(progress)));
      heartbeat(operation);
      emit(operation, phase, detail, operation.progress);
    },
    heartbeat(detail) {
      if (operation.cancelRequested || operation.controller.signal.aborted) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
      heartbeat(operation, detail, Boolean(detail));
    },
    isCancelled() { return operation.cancelRequested || operation.controller.signal.aborted; }
  };
}

function cancel(operationId) {
  const operation = jobs.get(String(operationId || ''));
  if (!operation) return null;
  if (terminal(operation.status)) return snapshot(operation);
  operation.cancelRequested = true;
  operation.controller.abort(new Error('Owner operation cancelled'));
  if (operation.status === 'queued') {
    operation.status = 'cancelled';
    operation.phase = 'CANCELLED';
    operation.detail = 'Cancelled before execution started';
    operation.completedAt = new Date().toISOString();
    emit(operation, 'CANCELLED', operation.detail, operation.progress);
  } else {
    emit(operation, 'CANCELLATION REQUESTED', 'Cancellation requested; aborting the active server task.', operation.progress);
  }
  return snapshot(operation);
}

function subscribe(operationId, listener) {
  const operation = jobs.get(String(operationId || ''));
  if (!operation || typeof listener !== 'function') return () => {};
  const key = operation.id;
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(listener);
  try { listener(snapshot(operation), null); } catch (_) {}
  return () => {
    const set = subscribers.get(key);
    if (!set) return;
    set.delete(listener);
    if (!set.size) subscribers.delete(key);
  };
}

async function execute(operation, run) {
  if (operation.status === 'cancelled') return;
  operation.status = 'running';
  operation.startedAt = new Date().toISOString();
  operation.lastHeartbeatAt = operation.startedAt;
  operation.phase = 'STARTING';
  operation.detail = `${operation.label} started`;
  emit(operation, operation.phase, operation.detail, 0);

  const watchdog = setInterval(() => {
    if (terminal(operation.status)) return;
    const now = Date.now();
    const heartbeatAge = now - Date.parse(operation.lastHeartbeatAt || operation.startedAt || operation.createdAt);
    const runtimeAge = now - Date.parse(operation.startedAt || operation.createdAt);

    // IMPORTANT: the watchdog must NEVER refresh lastHeartbeatAt itself.
    // Only the actual worker may heartbeat. Otherwise a dead worker can look alive forever.
    if (heartbeatAge > STALL_MS) {
      operation.status = 'stalled';
      operation.phase = 'STALLED';
      operation.detail = `No worker heartbeat received for ${Math.round(heartbeatAge / 1000)}s`;
      operation.error = { message: operation.detail, status: 504, code: 'OWNER_OPERATION_STALLED' };
      operation.completedAt = new Date().toISOString();
      operation.controller.abort(new Error(operation.detail));
      emit(operation, 'STALLED', operation.detail, operation.progress, 'terminal');
      return;
    }
    if (runtimeAge > MAX_RUNTIME_MS) {
      operation.status = 'failed';
      operation.phase = 'TIMEOUT';
      operation.detail = `Owner operation exceeded the ${Math.round(MAX_RUNTIME_MS / 60000)} minute runtime limit`;
      operation.error = { message: operation.detail, status: 504, code: 'OWNER_OPERATION_TIMEOUT' };
      operation.completedAt = new Date().toISOString();
      operation.controller.abort(new Error(operation.detail));
      emit(operation, 'TIMEOUT', operation.detail, operation.progress, 'terminal');
    }
  }, HEARTBEAT_MS);
  watchdog.unref?.();

  try {
    const result = await run(context(operation));
    if (terminal(operation.status)) return;
    if (operation.cancelRequested || operation.controller.signal.aborted) {
      operation.status = 'cancelled';
      operation.phase = 'CANCELLED';
      operation.detail = 'Operation cancelled at a safe server checkpoint';
      operation.completedAt = new Date().toISOString();
      emit(operation, operation.phase, operation.detail, operation.progress, 'terminal');
      return;
    }
    operation.status = 'completed';
    operation.phase = 'COMPLETE';
    operation.progress = 100;
    operation.detail = `${operation.label} completed successfully`;
    operation.result = result ?? null;
    operation.completedAt = new Date().toISOString();
    operation.lastHeartbeatAt = operation.completedAt;
    emit(operation, operation.phase, operation.detail, 100, 'terminal');
  } catch (error) {
    if (operation.status === 'stalled' || operation.status === 'failed') return;
    if (error?.code === 'OWNER_OPERATION_CANCELLED' || operation.cancelRequested || operation.controller.signal.aborted) {
      operation.status = 'cancelled';
      operation.phase = 'CANCELLED';
      operation.detail = 'Operation cancelled by Owner';
    } else {
      operation.status = 'failed';
      operation.phase = 'ERROR';
      operation.detail = clean(error?.message || 'Owner operation failed');
      operation.error = {
        message: clean(error?.message || 'Owner operation failed'),
        status: Number(error?.status) || 500,
        code: clean(error?.code || 'OWNER_OPERATION_FAILED', 'OWNER_OPERATION_FAILED')
      };
    }
    operation.completedAt = new Date().toISOString();
    emit(operation, operation.phase, operation.detail, operation.progress, 'terminal');
  } finally {
    clearInterval(watchdog);
  }
}

setInterval(() => {
  const cutoff = Date.now() - RETAIN_MS;
  for (const [key, operation] of jobs) {
    const timestamp = Date.parse(operation.completedAt || operation.createdAt);
    if (timestamp < cutoff && terminal(operation.status)) {
      jobs.delete(key);
      subscribers.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

module.exports = { create, get, cancel, subscribe };