import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { h, render, act, useState, navigate, setQuery, useLocation, useParams, matchPath, Routes, Route, Link, NavLink } from '../src/index.js';

let root, window;
beforeEach(() => {
  ({ window } = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/', virtualConsole: new VirtualConsole() }));
  globalThis.window = window;
  root = window.document.getElementById('app');
});

test('matchPath', () => {
  assert.deepEqual(matchPath('/', '/'), {});
  assert.deepEqual(matchPath('/users/:id', '/users/42'), { id: '42' });
  assert.deepEqual(matchPath('/users/:id', '/users/42/'), { id: '42' });
  assert.deepEqual(matchPath('/users/:id', '/users/a%20b'), { id: 'a b' });
  assert.equal(matchPath('/users/:id', '/users'), null);
  assert.equal(matchPath('/users/:id', '/users/42/posts'), null);
  assert.equal(matchPath('/about', '/'), null);
  assert.deepEqual(matchPath('/files/*', '/files/a/b'), { '*': 'a/b' });
  assert.deepEqual(matchPath('*', '/anything'), { '*': 'anything' });
});

test('useLocation re-renders on navigate and back/forward', async () => {
  const Where = () => {
    const loc = useLocation();
    return `${loc.pathname}|${loc.query.tab ?? ''}|${loc.hash}`;
  };
  render(h(Where), root);
  await act();
  assert.equal(root.textContent, '/||');

  await act(() => navigate('/settings?tab=profile#top'));
  assert.equal(root.textContent, '/settings|profile|#top');
  assert.equal(window.location.pathname, '/settings');
  assert.equal(window.history.length, 2);

  await act(() => navigate('/settings?tab=profile#top')); // same URL: no new entry
  assert.equal(window.history.length, 2);

  await act(() => navigate('/other', { replace: true }));
  assert.equal(window.history.length, 2);
  assert.equal(root.textContent, '/other||');

  window.history.replaceState(null, '', '/back'); // simulate the browser going back
  await act(() => window.dispatchEvent(new window.PopStateEvent('popstate')));
  assert.equal(root.textContent, '/back||');
});

test('setQuery merges and removes keys', async () => {
  window.history.replaceState(null, '', '/list?page=1&q=x');
  const Q = () => JSON.stringify(useLocation().query);
  render(h(Q), root);
  await act();

  await act(() => setQuery({ page: 2, q: null, sort: 'name' }));
  assert.equal(window.location.search, '?page=2&sort=name');
  assert.equal(root.textContent, '{"page":"2","sort":"name"}');
  assert.equal(window.history.length, 1); // replaces by default
});

test('Routes renders the first match, with params', async () => {
  const Home = () => 'home';
  const User = ({ params }) => {
    const p = useParams();
    return `user ${params.id} ${p.id}`;
  };
  render(
    h(Routes, null,
      h(Route, { path: '/', component: Home }),
      h(Route, { path: '/users/:id', component: User }),
      h(Route, { path: '*' }, h('b', null, 'not found')),
    ),
    root,
  );
  await act();
  assert.equal(root.textContent, 'home');

  await act(() => navigate('/users/7'));
  assert.equal(root.textContent, 'user 7 7');

  await act(() => navigate('/nope'));
  assert.equal(root.innerHTML, '<b>not found</b>');
});

test('a route keeps its state when only params change', async () => {
  let renders = 0;
  const User = ({ params }) => {
    const [n] = useState(() => ++renders);
    return `${params.id}:${n}`;
  };
  render(h(Routes, null, h(Route, { path: '/users/:id', component: User })), root);
  await act(() => navigate('/users/1'));
  await act(() => navigate('/users/2'));
  assert.equal(root.textContent, '2:1');
});

test('Link navigates without reloading; modified clicks and other sites are left alone', async () => {
  const App = () => h('div', null,
    h(Link, { href: '/about', id: 'in' }, 'About'),
    h(Link, { href: 'https://example.com/', id: 'out' }, 'Out'),
    h(Link, { href: '/new-tab', target: '_blank', id: 'blank' }, 'Tab'),
    h('p', null, useLocation().pathname),
  );
  render(h(App), root);
  await act();

  const click = (id, init = {}) => {
    const e = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    root.querySelector('#' + id).dispatchEvent(e);
    return e.defaultPrevented;
  };

  assert.equal(root.querySelector('#in').getAttribute('href'), '/about');
  await act(() => assert.equal(click('in'), true));
  assert.equal(root.querySelector('p').textContent, '/about');

  assert.equal(click('in', { ctrlKey: true }), false);
  assert.equal(click('out'), false);
  assert.equal(click('blank'), false);
});

test('NavLink marks the current section active', async () => {
  const Nav = () => h('nav', null,
    h(NavLink, { href: '/' }, 'Home'),
    h(NavLink, { href: '/users', className: 'x' }, 'Users'),
    h(NavLink, { href: '/users', end: true }, 'All users'),
  );
  render(h(Nav), root);
  await act();
  const cls = () => [...root.querySelectorAll('a')].map(a => a.className + (a.getAttribute('aria-current') ? '*' : ''));

  assert.deepEqual(cls(), ['nav-link active*', 'nav-link x', 'nav-link']);
  await act(() => navigate('/users'));
  assert.deepEqual(cls(), ['nav-link', 'nav-link x active*', 'nav-link active*']);
  await act(() => navigate('/users/7'));
  assert.deepEqual(cls(), ['nav-link', 'nav-link x active', 'nav-link']);
});
