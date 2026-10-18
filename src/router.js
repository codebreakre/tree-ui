// URL manager: read the current URL, change it without reloading, and pick a view by path.
import { h, createContext, useContext, useState, useEffect, useMemo } from './core/index.js';
import { cx } from './components.js';

// Looked up on every call so the router follows whichever window is current (handy in tests).
const win = () => globalThis.window;

/**
 * Go to `to` (a path, `?query`, `#hash` or full URL) without reloading the page.
 * Every component using useLocation() re-renders. Other origins load normally.
 */
export function navigate(to, { replace = false, state = null } = {}) {
  const w = win();
  const url = new URL(to, w.location.href);
  if (url.origin !== w.location.origin) {
    w.location.assign(url.href);
    return;
  }
  // Going to the URL we're already on shouldn't add a history entry.
  const method = replace || url.href === w.location.href ? 'replaceState' : 'pushState';
  w.history[method](state, '', url.href);
  // Same event the browser fires for back/forward, so there is only one thing to listen to.
  w.dispatchEvent(new w.PopStateEvent('popstate', { state }));
}

/**
 * Merge `changes` into the query string: setQuery({ page: 2, q: null }).
 * `null`/`undefined` removes a key. Replaces the history entry unless `replace: false`.
 */
export function setQuery(changes, { replace = true, state = null } = {}) {
  const url = new URL(win().location.href);
  for (const k in changes) {
    if (changes[k] == null) url.searchParams.delete(k);
    else url.searchParams.set(k, changes[k]);
  }
  navigate(url.href, { replace, state });
}

/** The current URL as { href, pathname, search, hash, query, state }; re-renders when it changes. */
export function useLocation() {
  const [href, setHref] = useState(() => win().location.href);
  useEffect(() => {
    const w = win();
    const update = () => setHref(w.location.href);
    w.addEventListener('popstate', update);
    update(); // in case the URL changed between render and now
    return () => w.removeEventListener('popstate', update);
  }, []);
  return useMemo(() => {
    const u = new URL(href);
    const query = Object.fromEntries(u.searchParams);
    return { href, pathname: u.pathname, search: u.search, hash: u.hash, query, state: win().history.state };
  }, [href]);
}

/**
 * Match a pathname against a pattern. Returns the params, or null when it doesn't match.
 * matchPath('/users/:id', '/users/42') -> { id: '42' }
 * matchPath('/files/*', '/files/a/b')  -> { '*': 'a/b' }
 */
export function matchPath(pattern, pathname) {
  const p = pattern.split('/').filter(Boolean);
  const s = pathname.split('/').filter(Boolean);
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '*') {
      params['*'] = s.slice(i).map(decodeURIComponent).join('/');
      return params;
    }
    if (i >= s.length) return null;
    if (p[i][0] === ':') params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return p.length === s.length ? params : null;
}

const ParamsContext = createContext({});

/** Params of the closest matching <Route>: { id: '42' } for path="/users/:id". */
export const useParams = () => useContext(ParamsContext);

/** Configuration only; <Routes> reads its `path` and `component` (or children). */
export const Route = () => null;

/**
 * Renders the first child <Route> whose `path` matches the URL.
 * <Routes>
 *   <Route path="/" component={Home} />
 *   <Route path="/users/:id" component={User} />   // User gets props.params
 *   <Route path="*"><NotFound /></Route>
 * </Routes>
 */
export function Routes({ children }) {
  const { pathname } = useLocation();
  const routes = [children].flat(Infinity);
  for (const r of routes) {
    if (!r || !r.props) continue;
    const params = matchPath(r.props.path ?? '*', pathname);
    if (!params) continue;
    const { component, children: content } = r.props;
    return h(ParamsContext.Provider, { value: params }, component ? h(component, { params }) : content);
  }
  return null;
}

/**
 * An <a> that navigates without reloading. Ctrl/Cmd-click, target="_blank"
 * and links to other sites behave like a normal link.
 */
export function Link({ href, replace, state, onClick, ...props }) {
  const click = e => {
    if (onClick) onClick(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (props.target && props.target !== '_self') return;
    const w = win();
    const url = new URL(href, w.location.href);
    if (url.origin !== w.location.origin) return;
    e.preventDefault();
    navigate(url.href, { replace, state });
  };
  return h('a', { ...props, href, onClick: click });
}

/**
 * A Link that gets class "active" when the URL is at or below its href
 * (aria-current="page" on an exact match). `end` makes it exact-only. "/" is always exact.
 */
export function NavLink({ href, end, className, ...props }) {
  const { pathname } = useLocation();
  const target = new URL(href, win().location.href).pathname.replace(/\/+$/, '');
  const here = pathname.replace(/\/+$/, '');
  const exact = here === target;
  const active = exact || (!end && target !== '' && here.startsWith(target + '/'));
  return h(Link, {
    ...props,
    href,
    className: cx('nav-link', className, active && 'active'),
    'aria-current': exact ? 'page' : undefined,
  });
}
