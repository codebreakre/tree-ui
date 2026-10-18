import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { h, render, act, useState, createHttp, HttpError, useRequest } from '../src/index.js';

// A fake fetch that records calls and answers with `reply(url, init)`.
function fakeFetch(reply) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, ...init, headers: Object.fromEntries(init.headers) });
    const r = await reply(url, init);
    if (r instanceof Response) return r;
    const { status = 200, body = r, headers = { 'content-type': 'application/json' } } = r && 'status' in r ? r : {};
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
  };
  return { fetch, calls };
}

// A fetch that only settles when its signal aborts, like a slow server.
const hangingFetch = (url, init) =>
  new Promise((_, reject) => {
    const fail = () => reject(new DOMException('aborted', 'AbortError'));
    if (init.signal.aborted) fail();
    init.signal.addEventListener('abort', fail);
  });

test('get: baseURL, params and JSON response', async () => {
  const { fetch, calls } = fakeFetch(() => [{ id: 1 }]);
  const api = createHttp({ baseURL: 'https://api.test/v1/', fetch });

  const res = await api.get('/users', { params: { page: 2, q: 'a b', skip: null, tag: ['x', 'y'] } });
  assert.deepEqual(res.data, [{ id: 1 }]);
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'application/json');
  assert.equal(calls[0].url, 'https://api.test/v1/users?page=2&q=a+b&tag=x&tag=y');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].headers.accept, 'application/json, text/plain, */*');
});

test('post sends JSON; FormData and strings are sent as they are', async () => {
  const { fetch, calls } = fakeFetch(() => ({ status: 201, body: { ok: true } }));
  const api = createHttp({ fetch });

  const res = await api.post('/users', { name: 'Ann' });
  assert.equal(res.status, 201);
  assert.equal(calls[0].body, '{"name":"Ann"}');
  assert.equal(calls[0].headers['content-type'], 'application/json');

  const form = new FormData();
  await api.put('/upload', form);
  assert.equal(calls[1].body, form);
  assert.equal(calls[1].headers['content-type'], undefined);

  await api.patch('/raw', 'hello', { headers: { 'Content-Type': 'text/plain' } });
  assert.equal(calls[2].body, 'hello');
  assert.equal(calls[2].headers['content-type'], 'text/plain');
});

test('non-2xx responses throw HttpError with the response', async () => {
  const { fetch } = fakeFetch(() => ({ status: 404, body: { message: 'Not found' } }));
  const api = createHttp({ fetch });
  await assert.rejects(api.get('/missing'), e => {
    assert.ok(e instanceof HttpError);
    assert.equal(e.code, 'ERR_STATUS');
    assert.equal(e.status, 404);
    assert.deepEqual(e.response.data, { message: 'Not found' });
    return true;
  });

  const lenient = createHttp({ fetch, validateStatus: () => true });
  assert.equal((await lenient.get('/missing')).status, 404);
});

test('text responses, empty bodies and responseType', async () => {
  const { fetch } = fakeFetch(url =>
    url.endsWith('/text') ? new Response('plain', { headers: { 'content-type': 'text/plain' } }) : new Response(null, { status: 204 }),
  );
  const api = createHttp({ fetch });
  assert.equal((await api.get('/text')).data, 'plain');
  assert.equal((await api.delete('/item')).data, '');
  assert.ok((await api.get('/text', { responseType: 'blob' })).data instanceof Blob);
});

test('timeout, cancel and network errors', async () => {
  const api = createHttp({ fetch: hangingFetch });
  await assert.rejects(api.get('/slow', { timeout: 10 }), { code: 'ERR_TIMEOUT' });

  const ctrl = new AbortController();
  const p = api.get('/slow', { signal: ctrl.signal });
  ctrl.abort();
  await assert.rejects(p, { code: 'ERR_CANCELED' });

  const down = createHttp({ fetch: () => Promise.reject(new TypeError('fetch failed')) });
  await assert.rejects(down.get('/x'), { code: 'ERR_NETWORK', message: 'fetch failed' });
});

test('defaults, headers and create()', async () => {
  const { fetch, calls } = fakeFetch(() => ({}));
  const api = createHttp({ fetch, headers: { Authorization: 'Bearer a', 'X-App': '1' } });
  api.defaults.headers.Authorization = 'Bearer b'; // changing defaults affects later requests

  await api.get('/a', { headers: { 'x-app': '2' } });
  assert.equal(calls[0].headers.authorization, 'Bearer b');
  assert.equal(calls[0].headers['x-app'], '2');

  const child = api.create({ baseURL: '/v2', headers: { authorization: null } }); // null removes a header
  await child('/b'); // callable like axios(url)
  assert.equal(calls[1].url, '/v2/b');
  assert.equal(calls[1].headers.authorization, undefined);
  assert.equal(calls[1].headers['x-app'], '1');
});

test('interceptors can change requests, responses and errors', async () => {
  const { fetch, calls } = fakeFetch(url => (url.includes('fail') ? { status: 401, body: {} } : { n: 1 }));
  const api = createHttp({ fetch });

  api.interceptors.request.use(config => ({ ...config, headers: { ...config.headers, authorization: 'Bearer t' } }));
  const id = api.interceptors.response.use(res => ({ ...res, data: { ...res.data, seen: true } }));
  api.interceptors.response.use(undefined, e => (e.status === 401 ? { data: 'logged out' } : Promise.reject(e)));

  assert.deepEqual((await api.get('/ok')).data, { n: 1, seen: true });
  assert.equal(calls[0].headers.authorization, 'Bearer t');
  assert.equal((await api.get('/fail')).data, 'logged out');

  api.interceptors.response.eject(id);
  assert.deepEqual((await api.get('/ok')).data, { n: 1 });
});

test('useRequest loads, reloads on deps change, and cancels the old request', async () => {
  const root = new JSDOM('<!doctype html><div id="app"></div>').window.document.getElementById('app');
  const { fetch, calls } = fakeFetch(url => ({ id: Number(url.split('/').pop()) }));
  const api = createHttp({ fetch });
  const settle = async () => {
    for (let i = 0; i < 5; i++) await act(() => new Promise(r => setTimeout(r)));
  };

  let setId, reload;
  const User = () => {
    const [id, set] = useState(1);
    setId = set;
    const r = useRequest(signal => api.get(`/users/${id}`, { signal }), [id]);
    reload = r.reload;
    return r.loading && !r.data ? 'loading' : r.error ? 'error' : `user ${r.data.id}${r.loading ? '…' : ''}`;
  };
  render(h(User), root);
  assert.equal(root.textContent, 'loading');
  await settle();
  assert.equal(root.textContent, 'user 1');

  await act(() => setId(2));
  assert.equal(root.textContent, 'user 1…'); // keeps old data while loading
  await settle();
  assert.equal(root.textContent, 'user 2');
  assert.equal(calls[1].signal.aborted, false);

  await act(() => reload());
  await settle();
  assert.equal(calls.length, 3);

  // Changing deps while a request is in flight aborts it.
  const slow = createHttp({ fetch: hangingFetch });
  let signals = [];
  let setN;
  const Slow = () => {
    const [n, set] = useState(0);
    setN = set;
    useRequest(signal => (signals.push(signal), slow.get('/x', { signal })), [n]);
    return null;
  };
  render(h(Slow), root);
  await settle();
  await act(() => setN(1));
  await settle();
  assert.deepEqual(signals.map(s => s.aborted), [true, false]);
  render(null, root); // unmount cancels too
  assert.equal(signals[1].aborted, true);

  // Errors land in `error`.
  const failing = createHttp({ fetch: () => Promise.resolve(new Response('{}', { status: 500 })) });
  let result;
  const Fail = () => ((result = useRequest(signal => failing.get('/x', { signal }))), null);
  render(h(Fail), root);
  await settle();
  assert.equal(result.loading, false);
  assert.equal(result.error.status, 500);
});
