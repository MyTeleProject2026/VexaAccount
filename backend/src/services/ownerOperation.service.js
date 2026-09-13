const crypto = require('crypto');
const { pool } = require('../config/database');

const jobs = new Map();
const subscribers = new Map();
const runners = new Map();
const MAX_EVENTS = 500;
const SNAPSHOT_EVENTS = 80;
const RETAIN_MS = 6 * 60 * 60 * 1000;
const HEARTBEAT_MS = 5000;
const STALL_MS = 90 * 1000;
const MAX_RUNTIME_MS = 30 * 60 * 1000;

function id() { return crypto.randomUUID(); }
function clean(value, fallback = '') { return String(value ?? fallback).slice(0, 500); }
function terminal(status) { return ['completed', 'failed', 'cancelled', 'stalled'].includes(status); }
function json(value) { try { return JSON.stringify(value ?? null); } catch (_) { return null; } }
function parse(value, fallback = null) { try { return value == null ? fallback : JSON.parse(value); } catch (_) { return fallback; } }
function sqlDate(value) { return value ? new Date(value) : null; }

function registerRunner(type, runner) {
  if (!type || typeof runner !== 'function') throw new TypeError('Owner operation runner is invalid');
  runners.set(String(type), runner);
}

function persist(operation) {
  const row = operation;
  pool.execute(
    `INSERT INTO owner_operations
      (id,type,label,status,phase,progress,detail,events_json,result_json,error_json,payload_json,created_at,started_at,completed_at,last_heartbeat_at,cancel_requested)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
      type=VALUES(type),label=VALUES(label),status=VALUES(status),phase=VALUES(phase),progress=VALUES(progress),detail=VALUES(detail),
      events_json=VALUES(events_json),result_json=VALUES(result_json),error_json=VALUES(error_json),payload_json=VALUES(payload_json),
      created_at=VALUES(created_at),started_at=VALUES(started_at),completed_at=VALUES(completed_at),last_heartbeat_at=VALUES(last_heartbeat_at),cancel_requested=VALUES(cancel_requested)`,
    [row.id,row.type,row.label,row.status,row.phase,row.progress,row.detail,json(row.events),json(row.result),json(row.error),json(row.payload),sqlDate(row.createdAt),sqlDate(row.startedAt),sqlDate(row.completedAt),sqlDate(row.lastHeartbeatAt),row.cancelRequested ? 1 : 0]
  ).catch(error => console.error('Owner operation persistence failed:', error.message));
}

function fromRow(row) {
  return {
    id: row.id, type: row.type, label: row.label, status: row.status, phase: row.phase,
    progress: Number(row.progress || 0), detail: row.detail || '', events: parse(row.events_json, []),
    result: parse(row.result_json), error: parse(row.error_json), payload: parse(row.payload_json, null),
    createdAt: new Date(row.created_at).toISOString(), startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    lastHeartbeatAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at).toISOString() : null,
    cancelRequested: Boolean(row.cancel_requested), controller: null
  };
}

function snapshot(operation) {
  const copy = { ...operation };
  delete copy.controller;
  copy.events = operation.events.slice(-SNAPSHOT_EVENTS);
  if (!terminal(operation.status)) copy.result = null;
  return JSON.parse(JSON.stringify(copy));
}

function create({ type, label = type, payload = null, run, runnerKey = type }) {
  if (typeof run !== 'function' && !runners.has(String(runnerKey))) throw new TypeError('Owner operation requires a run function or registered runner');
  const controller = new AbortController();
  const operation = {
    id: id(), type: clean(type, 'owner-operation'), label: clean(label, type), status: 'queued', phase: 'QUEUED',
    progress: 0, detail: 'Queued', events: [], result: null, error: null, payload,
    runnerKey: clean(runnerKey, type), createdAt: new Date().toISOString(), startedAt: null, completedAt: null,
    lastHeartbeatAt: null, cancelRequested: false, controller
  };
  jobs.set(operation.id, operation);
  persist(operation);
  setImmediate(() => execute(operation, run || runners.get(operation.runnerKey), true));
  return snapshot(operation);
}

function get(operationId) {
  const operation = jobs.get(String(operationId || ''));
  return operation ? snapshot(operation) : null;
}

function list({ includeTerminal = true, limit = 50 } = {}) {
  const max = Math.max(1, Math.min(100, Number(limit) || 50));
  return [...jobs.values()].filter(operation => includeTerminal || !terminal(operation.status))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, max).map(snapshot);
}

async function listPersistent({ includeTerminal = true, limit = 50 } = {}) {
  const max = Math.max(1, Math.min(100, Number(limit) || 50));
  const where = includeTerminal ? '' : "WHERE status NOT IN ('completed','failed','cancelled','stalled')";
  const [rows] = await pool.query(`SELECT * FROM owner_operations ${where} ORDER BY created_at DESC LIMIT ${max}`);
  return rows.map(fromRow).map(snapshot);
}

async function getPersistent(operationId) {
  const local = get(operationId);
  if (local) return local;
  const [rows] = await pool.query('SELECT * FROM owner_operations WHERE id=? LIMIT 1', [String(operationId || '')]);
  return rows.length ? snapshot(fromRow(rows[0])) : null;
}

function emit(operation, phase, detail, progress = operation.progress, kind = 'event') {
  const event = { at: new Date().toISOString(), phase: clean(phase, operation.phase || 'RUNNING').toUpperCase(), detail: clean(detail, 'Working…'), progress: Number.isFinite(Number(progress)) ? Math.max(0, Math.min(100, Number(progress))) : operation.progress, kind };
  operation.events.push(event);
  if (operation.events.length > MAX_EVENTS) operation.events.splice(0, operation.events.length - MAX_EVENTS);
  persist(operation);
  const listeners = subscribers.get(operation.id);
  if (listeners) for (const listener of [...listeners]) { try { listener(snapshot(operation), event); } catch (_) {} }
}

function heartbeat(operation, detail, emitEvent = false) {
  operation.lastHeartbeatAt = new Date().toISOString();
  persist(operation);
  if (emitEvent) emit(operation, operation.phase || 'HEARTBEAT', detail || 'Server worker is alive.', operation.progress, 'heartbeat');
}

function context(operation) {
  return {
    id: operation.id, signal: operation.controller.signal,
    progress(phase, detail, progress) {
      if (operation.cancelRequested || operation.controller.signal.aborted) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
      operation.status = 'running'; operation.phase = clean(phase, operation.phase || 'RUNNING').toUpperCase(); operation.detail = clean(detail, 'Working…');
      if (Number.isFinite(Number(progress))) operation.progress = Math.max(0, Math.min(100, Number(progress)));
      heartbeat(operation); emit(operation, operation.phase, operation.detail, operation.progress);
    },
    event(phase, detail, progress) {
      if (operation.cancelRequested || operation.controller.signal.aborted) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
      if (Number.isFinite(Number(progress))) operation.progress = Math.max(0, Math.min(100, Number(progress)));
      heartbeat(operation); emit(operation, phase, detail, operation.progress);
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
  operation.cancelRequested = true; operation.controller.abort(new Error('Owner operation cancelled'));
  persist(operation);
  if (operation.status === 'queued') {
    operation.status = 'cancelled'; operation.phase = 'CANCELLED'; operation.detail = 'Cancelled before execution started'; operation.completedAt = new Date().toISOString(); emit(operation, 'CANCELLED', operation.detail, operation.progress);
  } else emit(operation, 'CANCELLATION REQUESTED', 'Cancellation requested; aborting the active server task.', operation.progress);
  return snapshot(operation);
}

async function cancelPersistent(operationId) {
  const local = jobs.get(String(operationId || ''));
  if (local) return cancel(operationId);
  const [rows] = await pool.query('SELECT * FROM owner_operations WHERE id=? LIMIT 1', [String(operationId || '')]);
  if (!rows.length) return null;
  const operation = fromRow(rows[0]);
  if (terminal(operation.status)) return snapshot(operation);
  operation.cancelRequested = true; operation.status = 'cancelled'; operation.phase = 'CANCELLED'; operation.detail = 'Cancellation requested while worker was disconnected'; operation.completedAt = new Date().toISOString();
  persist(operation); return snapshot(operation);
}

function subscribe(operationId, listener) {
  const operation = jobs.get(String(operationId || ''));
  if (!operation || typeof listener !== 'function') return () => {};
  const key = operation.id;
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(listener);
  try { listener(snapshot(operation), null); } catch (_) {}
  return () => { const set = subscribers.get(key); if (!set) return; set.delete(listener); if (!set.size) subscribers.delete(key); };
}

async function execute(operation, run) {
  if (operation.status === 'cancelled') return;
  operation.status = 'running'; operation.startedAt = new Date().toISOString(); operation.lastHeartbeatAt = operation.startedAt; operation.phase = 'STARTING'; operation.detail = `${operation.label} started`; persist(operation); emit(operation, operation.phase, operation.detail, 0);
  const watchdog = setInterval(() => {
    if (terminal(operation.status)) return;
    const now = Date.now(), heartbeatAge = now - Date.parse(operation.lastHeartbeatAt || operation.startedAt || operation.createdAt), runtimeAge = now - Date.parse(operation.startedAt || operation.createdAt);
    if (heartbeatAge > STALL_MS) { operation.status='stalled'; operation.phase='STALLED'; operation.detail=`No worker heartbeat received for ${Math.round(heartbeatAge/1000)}s`; operation.error={message:operation.detail,status:504,code:'OWNER_OPERATION_STALLED'}; operation.completedAt=new Date().toISOString(); operation.controller.abort(new Error(operation.detail)); emit(operation,'STALLED',operation.detail,operation.progress,'terminal'); return; }
    if (runtimeAge > MAX_RUNTIME_MS) { operation.status='failed'; operation.phase='TIMEOUT'; operation.detail=`Owner operation exceeded the ${Math.round(MAX_RUNTIME_MS/60000)} minute runtime limit`; operation.error={message:operation.detail,status:504,code:'OWNER_OPERATION_TIMEOUT'}; operation.completedAt=new Date().toISOString(); operation.controller.abort(new Error(operation.detail)); emit(operation,'TIMEOUT',operation.detail,operation.progress,'terminal'); }
  }, HEARTBEAT_MS);
  watchdog.unref?.();
  try {
    const result = await run(operation.payload, context(operation));
    if (terminal(operation.status)) return;
    if (operation.cancelRequested || operation.controller.signal.aborted) { operation.status='cancelled'; operation.phase='CANCELLED'; operation.detail='Operation cancelled at a safe server checkpoint'; operation.completedAt=new Date().toISOString(); emit(operation,operation.phase,operation.detail,operation.progress,'terminal'); return; }
    operation.status='completed'; operation.phase='COMPLETE'; operation.progress=100; operation.detail=`${operation.label} completed successfully`; operation.result=result ?? null; operation.completedAt=new Date().toISOString(); operation.lastHeartbeatAt=operation.completedAt; emit(operation,operation.phase,operation.detail,100,'terminal');
  } catch (error) {
    if (operation.status === 'stalled' || operation.status === 'failed') return;
    if (error?.code === 'OWNER_OPERATION_CANCELLED' || operation.cancelRequested || operation.controller.signal.aborted) { operation.status='cancelled'; operation.phase='CANCELLED'; operation.detail='Operation cancelled by Owner'; }
    else { operation.status='failed'; operation.phase='ERROR'; operation.detail=clean(error?.message||'Owner operation failed'); operation.error={message:clean(error?.message||'Owner operation failed'),status:Number(error?.status)||500,code:clean(error?.code||'OWNER_OPERATION_FAILED','OWNER_OPERATION_FAILED')}; }
    operation.completedAt=new Date().toISOString(); emit(operation,operation.phase,operation.detail,operation.progress,'terminal');
  } finally { clearInterval(watchdog); }
}

async function initialize() {
  try {
    const [rows] = await pool.query("SELECT * FROM owner_operations WHERE status IN ('queued','running') ORDER BY created_at ASC LIMIT 100");
    for (const row of rows) {
      const operation = fromRow(row);
      if (operation.cancelRequested) { operation.status='cancelled'; operation.phase='CANCELLED'; operation.detail='Cancelled while Owner OS worker was offline'; operation.completedAt=new Date().toISOString(); persist(operation); continue; }
      const runner = runners.get(operation.type);
      if (!runner) { operation.status='failed'; operation.phase='RECOVERY ERROR'; operation.detail=`No registered worker for operation type ${operation.type}`; operation.error={message:operation.detail,status:500,code:'OWNER_OPERATION_RUNNER_MISSING'}; operation.completedAt=new Date().toISOString(); persist(operation); continue; }
      operation.controller = new AbortController(); operation.status='queued'; operation.phase='RECOVERING'; operation.detail='Recovered from durable Owner operation store'; jobs.set(operation.id, operation); persist(operation); setImmediate(() => execute(operation, runner));
    }
    console.log(`Owner operation store initialized (${rows.length} recoverable operations)`);
  } catch (error) { console.error('Owner operation store initialization failed:', error.message); }
}

setInterval(() => {
  const cutoff = Date.now() - RETAIN_MS;
  for (const [key, operation] of jobs) { const timestamp = Date.parse(operation.completedAt || operation.createdAt); if (timestamp < cutoff && terminal(operation.status)) { jobs.delete(key); subscribers.delete(key); } }
  pool.execute('DELETE FROM owner_operations WHERE completed_at IS NOT NULL AND completed_at < ?', [new Date(cutoff)]).catch(() => {});
}, 15 * 60 * 1000).unref();

module.exports = { create, get, list, listPersistent, getPersistent, cancel, cancelPersistent, subscribe, registerRunner, initialize };