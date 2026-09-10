const crypto = require('crypto');

const jobs = new Map();
const MAX_EVENTS = 500;
const RETAIN_MS = 6 * 60 * 60 * 1000;

function id() { return crypto.randomUUID(); }
function clean(value, fallback = '') { return String(value ?? fallback).slice(0, 500); }

function create({ type, label = type, run }) {
  if (typeof run !== 'function') throw new TypeError('Owner operation requires a run function');
  const operation = {
    id: id(), type: clean(type, 'owner-operation'), label: clean(label, type), status: 'queued', phase: 'QUEUED',
    progress: 0, detail: 'Queued', events: [], result: null, error: null,
    createdAt: new Date().toISOString(), startedAt: null, completedAt: null, cancelRequested: false
  };
  jobs.set(operation.id, operation);
  setImmediate(() => execute(operation, run));
  return snapshot(operation);
}

function snapshot(operation) {
  return JSON.parse(JSON.stringify(operation));
}

function get(operationId) {
  const operation = jobs.get(String(operationId || ''));
  return operation ? snapshot(operation) : null;
}

function cancel(operationId) {
  const operation = jobs.get(String(operationId || ''));
  if (!operation) return null;
  if (['completed', 'failed', 'cancelled'].includes(operation.status)) return snapshot(operation);
  operation.cancelRequested = true;
  if (operation.status === 'queued') {
    operation.status = 'cancelled';
    operation.phase = 'CANCELLED';
    operation.detail = 'Cancelled before execution started';
    operation.completedAt = new Date().toISOString();
    emit(operation, 'CANCELLED', operation.detail, operation.progress);
  } else {
    emit(operation, 'CANCELLATION REQUESTED', 'Cancellation requested; current server operation will stop at its next safe checkpoint.', operation.progress);
  }
  return snapshot(operation);
}

function context(operation) {
  return {
    id: operation.id,
    progress(phase, detail, progress) {
      if (operation.cancelRequested) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
      operation.status = 'running';
      operation.phase = clean(phase, operation.phase || 'RUNNING').toUpperCase();
      operation.detail = clean(detail, 'Working…');
      if (Number.isFinite(Number(progress))) operation.progress = Math.max(0, Math.min(100, Number(progress)));
      emit(operation, operation.phase, operation.detail, operation.progress);
    },
    event(phase, detail, progress) {
      if (Number.isFinite(Number(progress))) operation.progress = Math.max(0, Math.min(100, Number(progress)));
      emit(operation, clean(phase, operation.phase || 'RUNNING').toUpperCase(), clean(detail, 'Working…'), operation.progress);
    },
    isCancelled() { return operation.cancelRequested; }
  };
}

function emit(operation, phase, detail, progress = operation.progress) {
  operation.events.push({ at: new Date().toISOString(), phase, detail, progress });
  if (operation.events.length > MAX_EVENTS) operation.events.splice(0, operation.events.length - MAX_EVENTS);
}

async function execute(operation, run) {
  if (operation.status === 'cancelled') return;
  operation.status = 'running';
  operation.startedAt = new Date().toISOString();
  operation.phase = 'STARTING';
  operation.detail = `${operation.label} started`;
  emit(operation, operation.phase, operation.detail, 0);
  try {
    const result = await run(context(operation));
    if (operation.cancelRequested) {
      operation.status = 'cancelled'; operation.phase = 'CANCELLED'; operation.detail = 'Operation cancelled at a safe checkpoint';
      operation.completedAt = new Date().toISOString(); emit(operation, operation.phase, operation.detail, operation.progress); return;
    }
    operation.status = 'completed'; operation.phase = 'COMPLETE'; operation.progress = 100;
    operation.detail = `${operation.label} completed successfully`; operation.result = result ?? null;
    operation.completedAt = new Date().toISOString(); emit(operation, operation.phase, operation.detail, 100);
  } catch (error) {
    if (error?.code === 'OWNER_OPERATION_CANCELLED' || operation.cancelRequested) {
      operation.status = 'cancelled'; operation.phase = 'CANCELLED'; operation.detail = 'Operation cancelled at a safe checkpoint';
    } else {
      operation.status = 'failed'; operation.phase = 'ERROR'; operation.detail = clean(error?.message || 'Owner operation failed');
      operation.error = { message: clean(error?.message || 'Owner operation failed'), status: Number(error?.status) || 500, code: clean(error?.code || 'OWNER_OPERATION_FAILED', 'OWNER_OPERATION_FAILED') };
    }
    operation.completedAt = new Date().toISOString(); emit(operation, operation.phase, operation.detail, operation.progress);
  }
}

setInterval(() => {
  const cutoff = Date.now() - RETAIN_MS;
  for (const [key, operation] of jobs) {
    const timestamp = Date.parse(operation.completedAt || operation.createdAt);
    if (timestamp < cutoff && ['completed', 'failed', 'cancelled'].includes(operation.status)) jobs.delete(key);
  }
}, 15 * 60 * 1000).unref();

module.exports = { create, get, cancel };
