# tree-project-ui

A tiny UI framework with React-style hooks and ready-made components, styled by the [`tree-project`](https://www.npmjs.com/package/tree-project) CSS.

- Virtual DOM with keyed diffing, fragments and SVG
- Hooks: `useState`, `useReducer`, `useEffect`, `useLayoutEffect`, `useRef`, `useMemo`, `useCallback`, `useContext`
- Each component re-renders on its own when its state changes; updates are batched
- URL manager: `Routes`, `Route`, `Link`, `NavLink`, `navigate`, `useLocation`, `useParams`, `setQuery`
- HTTP client in the style of axios (`http`, `createHttp`) and a `useRequest` hook for loading data
- Components: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Field`, `Alert`, `Modal`, `Card`, `Badge`, `Text`, `Stack`, `Row`, `Container`, `List`, `Box`, `Theme`
- Plain JavaScript modules with no runtime dependencies besides the CSS

## Install

```sh
npm install tree-project-ui
```

Import the CSS once in your app, e.g. at the top of `main.jsx`:

```js
import 'tree-project-ui/styles.css';
```

That one file includes everything: the [`tree-project`](https://www.npmjs.com/package/tree-project) base styles (installed automatically as a dependency) and the styles for this library's components. You don't need to install or import `tree-project` yourself.

## Example

```js
import 'tree-project-ui/styles.css';
import { h, render, useState, Card, Button } from 'tree-project-ui';

function Counter() {
  const [count, setCount] = useState(0);
  return h(Card, { title: 'Counter' },
    h(Button, { variant: 'primary', onClick: () => setCount(count + 1) }, 'Clicked ', count),
  );
}

render(h(Counter), document.getElementById('app'));
```

### JSX

With Vite, add this to `vite.config.js`:

```js
export default {
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'tree-project-ui'`,
  },
};
```

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Card title="Counter">
      <Button variant="primary" onClick={() => setCount(count + 1)}>Clicked {count}</Button>
    </Card>
  );
}
```

## Hooks

| Hook | What it does |
| --- | --- |
| `useState(initial)` | `[value, setValue]`. `setValue(v)` or `setValue(prev => next)`. Same value = no re-render. |
| `useReducer(reducer, initial, init?)` | `[state, dispatch]` |
| `useEffect(fn, deps?)` | Runs after the DOM updates. Return a cleanup function. |
| `useLayoutEffect(fn, deps?)` | Like `useEffect`, but runs synchronously right after the DOM update. |
| `useRef(initial)` | `{ current }` that survives re-renders. Pass as `ref` to get a DOM element. |
| `useMemo(fn, deps)` | Caches a computed value until `deps` change. |
| `useCallback(fn, deps)` | Caches a function until `deps` change. |
| `createContext(default)` / `useContext(ctx)` | Pass values down without props: `<Ctx.Provider value={...}>`. |

## URL manager

Change the URL without reloading the page and render a view for it. Uses the History API, so the browser's back and forward buttons work.

```jsx
import { Routes, Route, Link, navigate, useLocation, useParams, setQuery } from 'tree-project-ui';

function App() {
  return (
    <>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/users/42">User 42</Link>
      </nav>
      <Routes>
        <Route path="/" component={Home} />
        <Route path="/users/:id" component={User} />
        <Route path="*"><NotFound /></Route>
      </Routes>
    </>
  );
}

function User({ params }) {          // or: const params = useParams();
  const { query } = useLocation();   // /users/42?tab=likes -> query.tab === 'likes'
  return <Button onClick={() => setQuery({ tab: 'posts' })}>User {params.id}</Button>;
}
```

| API | What it does |
| --- | --- |
| `<Routes>` | Renders the first child `<Route>` whose `path` matches. |
| `<Route path component>` | `path` like `/`, `/users/:id`, `/files/*` or `*`. Renders `component` (it gets `params`) or its children. |
| `<NavLink href end>` | A `Link` with class `active` while the URL is at or below `href` (`end`: exact match only), plus `aria-current="page"` on an exact match. |
| `<Link href>` | An `<a>` that navigates without reloading. Takes `replace` and `state`. Ctrl/Cmd-click, `target="_blank"` and links to other sites work like normal links. |
| `navigate(to, { replace, state })` | Go to a path, `?query`, `#hash` or URL from code (e.g. after a form submit). |
| `useLocation()` | `{ href, pathname, search, hash, query, state }`. Re-renders when the URL changes. |
| `useParams()` | Params of the closest matching route. |
| `setQuery(changes, { replace })` | Merge into the query string; `null` removes a key. Replaces the history entry by default. |
| `matchPath(pattern, pathname)` | `matchPath('/users/:id', '/users/42')` gives `{ id: '42' }`, or `null` when it doesn't match. |

Your server must return `index.html` for every app path, so that reloading `/users/42` works. Vite's dev server already does this.

## HTTP

`http` works like axios, on top of `fetch`. Make your own client with `createHttp(defaults)`:

```js
import { createHttp, HttpError } from 'tree-project-ui';

export const api = createHttp({
  baseURL: '/api',
  timeout: 10000,
  headers: { Authorization: `Bearer ${token}` },
});

const { data } = await api.get('/users', { params: { page: 2, q: 'ann' } }); // GET /api/users?page=2&q=ann
await api.post('/users', { name: 'Ann' });  // sent as JSON
await api.delete(`/users/${id}`);

try {
  await api.get('/secret');
} catch (e) {
  if (e instanceof HttpError && e.status === 404) { /* e.response.data has the body */ }
}
```

- Methods: `get(url, config)`, `delete`, `head`, `options`; `post(url, data, config)`, `put`, `patch`; `request(config)` or `api(config)`.
- Config: `baseURL`, `url`, `method`, `params` (`null` skipped, arrays repeated), `data`, `headers` (`null` removes a default), `timeout` (ms), `signal`, `withCredentials`, `responseType` (`auto` `json` `text` `blob` `arrayBuffer`), `validateStatus`, `fetch`.
- Response: `{ data, status, statusText, headers, config }`. JSON responses are parsed and anything else comes back as text.
- `data`: plain objects and arrays are sent as JSON; `FormData`, `Blob`, `URLSearchParams` and strings are sent as they are.
- Errors are `HttpError` with `code`: `ERR_STATUS` (non-2xx, with `response` and `status`), `ERR_TIMEOUT`, `ERR_CANCELED`, `ERR_NETWORK`.
- `api.defaults` can be changed later, e.g. `api.defaults.headers.Authorization = ...` after logging in. `api.create(more)` makes a child client with merged defaults.

Interceptors run in the order they were added:

```js
api.interceptors.request.use(config => ({ ...config, headers: { ...config.headers, 'x-request-id': crypto.randomUUID() } }));
const id = api.interceptors.response.use(
  res => res,
  err => {
    if (err.status === 401) navigate('/login');
    return Promise.reject(err);
  },
);
api.interceptors.response.eject(id);
```

### Loading data in a component

`useRequest(fn, deps)` runs `fn(signal)` on mount and whenever `deps` change. When deps change or the component goes away, the request that is still running gets canceled.

```jsx
function User({ id }) {
  const { data: user, error, loading, reload } = useRequest(signal => api.get(`/users/${id}`, { signal }), [id]);
  if (error) return <Alert variant="danger">{error.message}</Alert>;
  if (!user) return <Text color="muted">Loading…</Text>;
  return <Card title={user.name}><Button onClick={reload} disabled={loading}>Refresh</Button></Card>;
}
```

`data` is the response body. While a new request loads, `data` keeps the previous value.

## Components

Every component accepts size props that map to the `tree-project` utility classes. Values are `0`, `xs`, `sm`, `md`, `lg`, `xl` (and `auto` for margins):

`p px py pt pr pb pl m mx my mt mr mb ml gap rounded border text`, plus `grow` (boolean).

```jsx
<Box as="section" p="lg" rounded="xl" text="sm">...</Box>
```

| Component | Props |
| --- | --- |
| `Button` | `variant`: `default` `primary` `soft` `danger`; `size`: `xs`–`xl` |
| `Input` | `size`: `xs`–`xl`. Use `onInput` for each keystroke. |
| `Card` | `title` |
| `Badge` | `variant`: `soft` `primary` |
| `Text` | `color`: `primary` `muted` `danger` `success` `warning`; `size`; `as` |
| `Stack` / `Row` | vertical / horizontal flex layout, use `gap` |
| `Container` | centred page column |
| `List` / `ListItem` | bordered list |
| `Box` | any element (`as="section"`) with size props |
| `Theme` | `color`, `tint`: re-colours everything inside from one colour |
| `Field` | `label`, `hint`, `error` (shown instead of the hint, and marks the input red). Wraps one control. `as="div"` when it holds a `Checkbox` or radios. |
| `Textarea` | `size`, `rows` (default 3) |
| `Select` | `options`: `['a', 'b']` or `[{ value, label, disabled }]` (or `<option>` children); `placeholder`; `size` |
| `Checkbox` | label as children or `label`; `switch` draws a toggle. Read `e.target.checked` in `onChange`. |
| `Radio` | like `Checkbox`; give a group the same `name` |
| `Alert` | `variant`: `info` `success` `warning` `danger`; `title`; `onClose` shows a close button |
| `Modal` | `open`, `onClose` (Escape and backdrop click), `title`, `footer`. Content only renders while open. |

Any other prop (`onClick`, `disabled`, `style`, `className`, `ref`, ...) is passed to the element. `cx(...)` is exported for joining class names.

## Notes

- Events use native DOM names: `onClick`, `onInput`, `onChange` (fires on commit, not every keystroke), `onSubmit`.
- `class` and `className` both work. `style` takes a string or an object, including CSS variables (`{ '--ui-theme': '#e11d48' }`).
- Give list items a `key` so they keep their DOM and state when the list is reordered.
- `act(fn)` runs `fn` and then applies all pending updates and effects synchronously, which is useful in tests.

## Develop

```sh
npm install
npm run dev     # demo app at http://localhost:5173
npm test
```

## Publish

```sh
npm publish
```
