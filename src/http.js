// HTTP client in the style of axios, built on fetch: instances with defaults,
// JSON in and out, query params, timeouts, interceptors, and errors for bad statuses.
import { useState, useEffect } from './core/index.js';

/**
 * Thrown for every failed request. `code` says why:
 * 'ERR_STATUS' (the server answered, see .response / .status), 'ERR_TIMEOUT', 'ERR_CANCELED', 'ERR_NETWORK'.
 */
export class HttpError extends Error {
  constructor(message, code, config, response, cause) {
    super(message, { cause });
    this.name = 'HttpError';
    this.code = code;
    this.config = config;
    this.response = response;
    this.status = response?.status;
  }
}

const isAbsolute = url => /^[a-z][a-z\d+.-]*:/i.test(url);

function buildURL(baseURL, url = '', params) {
  let full = baseURL && !isAbsolute(url) ? baseURL.replace(/\/+$/, '') + (url ? '/' + url.replace(/^\/+/, '') : '') : url;
  if (params) {
    const qs = new URLSearchParams();
    for (const k in params) {
      if (params[k] == null) continue;
      for (const v of [params[k]].flat()) qs.append(k, v instanceof Date ? v.toISOString() : v);
    }
    const s = qs.toString();
    if (s) full += (full.includes('?') ? '&' : '?') + s;
  }
  return full;
}

// Plain objects and arrays are sent as JSON; FormData, Blob, URLSearchParams and strings as they are.
function isJSONBody(data) {
  if (data == null || typeof data !== 'object') return false;
  const proto = Object.getPrototypeOf(data);
  return Array.isArray(data) || proto === Object.prototype || proto === null;
}

async function readBody(res, responseType) {
  if (responseType === 'blob') return res.blob();
  if (responseType === 'arrayBuffer') return res.arrayBuffer();
  const text = await res.text();
  if (responseType === 'text') return text;
  if (responseType === 'json' || /json/i.test(res.headers.get('content-type') || '')) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

const lowerKeys = obj => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k.toLowerCase(), v]));

function mergeConfig(a, b) {
  return {
    ...a,
    ...b,
    headers: { ...lowerKeys(a.headers), ...lowerKeys(b.headers) },
    params: a.params || b.params ? { ...a.params, ...b.params } : undefined,
  };
}

async function send(config) {
  const { method = 'get', data, timeout = 0, responseType = 'auto' } = config;
  const validateStatus = config.validateStatus || (s => s >= 200 && s < 300);

  const headers = new Headers();
  for (const [k, v] of Object.entries(config.headers || {})) if (v != null) headers.set(k, v);
  let body = data;
  if (isJSONBody(data)) {
    body = JSON.stringify(data);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  if (!headers.has('accept')) headers.set('accept', 'application/json, text/plain, */*');

  // One controller for the caller's signal and the timeout.
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  if (config.signal?.aborted) abort();
  config.signal?.addEventListener('abort', abort);
  let timedOut = false;
  const timer = timeout > 0 && setTimeout(() => ((timedOut = true), abort()), timeout);

  let res, resData;
  try {
    res = await (config.fetch || globalThis.fetch)(buildURL(config.baseURL, config.url, config.params), {
      method: method.toUpperCase(),
      headers,
      body,
      signal: ctrl.signal,
      credentials: config.withCredentials ? 'include' : undefined,
    });
    resData = await readBody(res, responseType);
  } catch (e) {
    if (timedOut) throw new HttpError(`Timeout of ${timeout}ms exceeded`, 'ERR_TIMEOUT', config, undefined, e);
    if (ctrl.signal.aborted) throw new HttpError('Request canceled', 'ERR_CANCELED', config, undefined, e);
    throw new HttpError(e?.message || 'Network error', 'ERR_NETWORK', config, undefined, e);
  } finally {
    clearTimeout(timer);
    config.signal?.removeEventListener('abort', abort);
  }

  const response = {
    data: resData,
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers),
    config,
  };
  if (!validateStatus(res.status)) {
    throw new HttpError(`Request failed with status ${res.status}`, 'ERR_STATUS', config, response);
  }
  return response;
}

function interceptorList() {
  const list = [];
  return {
    list,
    /** Add a handler; returns an id for eject(). */
    use: (onFulfilled, onRejected) => list.push({ onFulfilled, onRejected }) - 1,
    eject: id => {
      list[id] = null;
    },
  };
}

/**
 * Make a client with its own defaults: baseURL, headers, params, timeout, withCredentials,
 * responseType ('auto' | 'json' | 'text' | 'blob' | 'arrayBuffer'), validateStatus, fetch.
 *
 * const api = createHttp({ baseURL: '/api', timeout: 10000 });
 * const { data } = await api.get('/users', { params: { page: 2 } });
 * await api.post('/users', { name: 'Ann' });
 */
export function createHttp(defaults = {}) {
  const interceptors = { request: interceptorList(), response: interceptorList() };

  function request(config) {
    let p = Promise.resolve(mergeConfig(client.defaults, typeof config === 'string' ? { url: config } : config));
    for (const i of interceptors.request.list) if (i) p = p.then(i.onFulfilled, i.onRejected);
    p = p.then(send);
    for (const i of interceptors.response.list) if (i) p = p.then(i.onFulfilled, i.onRejected);
    return p;
  }

  // Callable like axios: client(config) or client(url).
  const client = config => request(config);
  client.request = request;
  for (const m of ['get', 'delete', 'head', 'options']) client[m] = (url, config) => request({ ...config, method: m, url });
  for (const m of ['post', 'put', 'patch']) client[m] = (url, data, config) => request({ ...config, method: m, url, data });
  client.defaults = defaults;
  client.interceptors = interceptors;
  client.create = (more = {}) => createHttp(mergeConfig(client.defaults, more));
  return client;
}

/** Ready-to-use client with no defaults. */
export const http = createHttp();

const isResponse = r => r !== null && typeof r === 'object' && 'data' in r && 'status' in r && 'config' in r;

/**
 * Load data when the component mounts and again whenever `deps` change.
 * The function gets an AbortSignal; the previous request is canceled when deps
 * change or the component goes away.
 *
 * const { data, error, loading, reload } = useRequest(signal => api.get(`/users/${id}`, { signal }), [id]);
 *
 * `data` is the response body (or whatever the function resolves to). It keeps the
 * previous value while a new request loads.
 */
export function useRequest(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState(s => (s.loading ? s : { ...s, loading: true }));
    Promise.resolve()
      .then(() => fn(ctrl.signal))
      .then(
        res => {
          if (!ctrl.signal.aborted) setState({ data: isResponse(res) ? res.data : res, error: null, loading: false });
        },
        error => {
          if (!ctrl.signal.aborted) setState(s => ({ data: s.data, error, loading: false }));
        },
      );
    return () => ctrl.abort();
  }, [...deps, version]);

  return { ...state, reload: () => setVersion(v => v + 1) };
}
