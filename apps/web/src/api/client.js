const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";
const API_CACHE_PREFIX = "api_cache_v1:";
const memoryCache = new Map();

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }
  return response.json();
}

export function postJson(path, body) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handleResponse);
}

export function getJson(path) {
  return fetch(`${API_BASE_URL}${path}`).then(handleResponse);
}

function buildCacheKey(cacheKey) {
  return `${API_CACHE_PREFIX}${cacheKey}`;
}

function readCachedValue(cacheKey, ttlMs) {
  const now = Date.now();
  const mem = memoryCache.get(cacheKey);
  if (mem && now - mem.ts < ttlMs) {
    return mem.value;
  }

  try {
    const raw = sessionStorage.getItem(buildCacheKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || now - parsed.ts >= ttlMs) {
      sessionStorage.removeItem(buildCacheKey(cacheKey));
      return null;
    }
    memoryCache.set(cacheKey, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCachedValue(cacheKey, value) {
  const payload = { value, ts: Date.now() };
  memoryCache.set(cacheKey, payload);
  try {
    sessionStorage.setItem(buildCacheKey(cacheKey), JSON.stringify(payload));
  } catch {
    // Ignore cache write failures.
  }
}

export function getCachedJson(path, { cacheKey = path, ttlMs = 60_000 } = {}) {
  const cached = readCachedValue(cacheKey, ttlMs);
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  return getJson(path).then((value) => {
    writeCachedValue(cacheKey, value);
    return value;
  });
}

export function invalidateCachedJson(matchers = []) {
  const tests = Array.isArray(matchers) ? matchers : [matchers];
  for (const key of [...memoryCache.keys()]) {
    if (tests.some((matcher) => key === matcher || key.startsWith(matcher))) {
      memoryCache.delete(key);
      try {
        sessionStorage.removeItem(buildCacheKey(key));
      } catch {
        // Ignore cache clear failures.
      }
    }
  }
}

export function patchJson(path, body) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handleResponse);
}
