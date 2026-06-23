// In-memory per-user rate limiter (resets on server restart; use Redis for multi-instance prod).
const store = new Map();

export function checkRateLimit(userId, maxRequests = 10, windowMs = 60_000) {
  const now = Date.now();
  const timestamps = (store.get(userId) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) return false;
  timestamps.push(now);
  store.set(userId, timestamps);
  return true;
}
