function createDeadlineError(label) {
  const error = new Error(label || 'Database operation timed out');
  error.code = 'VEXA_REQUEST_TIMEOUT';
  error.status = 503;
  return error;
}

function withDeadline(promise, timeoutMs, label) {
  const ms = Math.max(1, Number(timeoutMs) || 8000);
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(createDeadlineError(label)), ms);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

module.exports = { withDeadline, createDeadlineError };
