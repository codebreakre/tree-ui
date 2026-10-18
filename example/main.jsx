import 'tree-project-ui/styles.css'; // all the CSS, including tree-project
import {
  render,
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  Container,
  Stack,
  Row,
  Card,
  Button,
  Input,
  Badge,
  Text,
  List,
  ListItem,
  Theme,
  Routes,
  Route,
  NavLink,
  useLocation,
  setQuery,
  Field,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Alert,
  Modal,
  createHttp,
  useRequest,
} from 'tree-project-ui';

const ThemeContext = createContext(null);

function ThemePicker() {
  const { color, setColor } = useContext(ThemeContext);
  const presets = ['#4f46e5', '#0ea5e9', '#16a34a', '#f59e0b', '#e11d48'];
  return (
    <Row>
      <input type="color" value={color} onInput={e => setColor(e.target.value)} />
      {presets.map(c => (
        <Button key={c} size="sm" onClick={() => setColor(c)} style={{ color: c }}>
          ●
        </Button>
      ))}
      <Text color="muted" size="sm">{color}</Text>
    </Row>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Card title="useState">
      <Row>
        <Button onClick={() => setCount(c => c - 1)}>−</Button>
        <Text size="xl">{count}</Text>
        <Button variant="primary" onClick={() => setCount(c => c + 1)}>+</Button>
        <Button variant="soft" size="sm" onClick={() => setCount(0)} disabled={count === 0}>Reset</Button>
      </Row>
    </Card>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id); // cleanup when the component goes away
  }, []);
  return <Text size="lg">{now.toLocaleTimeString()}</Text>;
}

function ClockCard() {
  const [show, setShow] = useState(true);
  return (
    <Card title="useEffect">
      <Row>
        {show && <Clock />}
        <Button size="sm" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'} clock</Button>
      </Row>
    </Card>
  );
}

function Todos() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Publish tree-project', done: true },
    { id: 2, text: 'Build a UI framework', done: false },
  ]);
  const [text, setText] = useState('');
  const input = useRef();
  const left = useMemo(() => todos.filter(t => !t.done).length, [todos]);

  const add = e => {
    e.preventDefault();
    if (!text.trim()) return;
    setTodos(ts => [...ts, { id: Date.now(), text: text.trim(), done: false }]);
    setText('');
    input.current.focus();
  };
  const toggle = id => setTodos(ts => ts.map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = id => setTodos(ts => ts.filter(t => t.id !== id));

  return (
    <Card title="Todos (useRef, useMemo, keyed list)">
      <Stack>
        <form onSubmit={add}>
          <Row>
            <Input ref={input} grow value={text} onInput={e => setText(e.target.value)} placeholder="What needs doing?" />
            <Button variant="primary" type="submit">Add</Button>
          </Row>
        </form>
        <List>
          {todos.map(t => (
            <ListItem key={t.id}>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
              <Text grow className={t.done ? 'done' : ''}>{t.text}</Text>
              <Button variant="danger" size="xs" onClick={() => remove(t.id)}>Delete</Button>
            </ListItem>
          ))}
        </List>
        <Row>
          <Badge>{left} left</Badge>
          <Badge variant="primary">{todos.length} total</Badge>
        </Row>
      </Stack>
    </Card>
  );
}

function UserPage({ params }) {
  const { query } = useLocation();
  const tab = query.tab || 'posts';
  return (
    <Stack gap="xs">
      <Text>User #{params.id}</Text>
      <Row>
        {['posts', 'likes'].map(t => (
          <Button key={t} size="xs" variant={t === tab ? 'primary' : 'soft'} onClick={() => setQuery({ tab: t })}>
            {t}
          </Button>
        ))}
      </Row>
    </Stack>
  );
}

function RouterCard() {
  const { pathname, search } = useLocation();
  return (
    <Card title="URL manager (Routes, Link, useLocation)">
      <Stack>
        <Row>
          <NavLink href="/">Home</NavLink>
          <NavLink href="/about">About</NavLink>
          <NavLink href="/users/42">User 42</NavLink>
          <NavLink href="/users/7?tab=likes">User 7 likes</NavLink>
          <NavLink href="/nowhere">Broken link</NavLink>
        </Row>
        <Routes>
          <Route path="/"><Text>Home page. Click a link: the URL changes, the page doesn't reload.</Text></Route>
          <Route path="/about"><Text>About page. Try the browser's back button.</Text></Route>
          <Route path="/users/:id" component={UserPage} />
          <Route path="*"><Text color="danger">Nothing at this URL.</Text></Route>
        </Routes>
        <Text color="muted" size="sm">{pathname}{search}</Text>
      </Stack>
    </Card>
  );
}

function FormCard() {
  const [form, setForm] = useState({ name: '', role: '', bio: '', plan: 'free', news: true, terms: false });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = e => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Please enter your name';
    if (!form.role) errs.role = 'Pick a role';
    if (!form.terms) errs.terms = 'You need to accept the terms';
    setErrors(errs);
    if (!Object.keys(errs).length) setSent(true);
  };

  return (
    <Card title="Forms (Field, Select, Textarea, Checkbox, Radio, Alert, Modal)">
      <form onSubmit={submit}>
        <Stack>
          <Field label="Name" hint="As it appears on your profile" error={errors.name}>
            <Input value={form.name} onInput={set('name')} />
          </Field>
          <Field label="Role" error={errors.role}>
            <Select value={form.role} onChange={set('role')} placeholder="Choose…" options={['Designer', 'Developer', { value: 'pm', label: 'Product manager' }]} />
          </Field>
          <Field label="Bio">
            <Textarea value={form.bio} onInput={set('bio')} placeholder="A few words about you" />
          </Field>
          <Field as="div" label="Plan">
            <Row>
              {['free', 'pro'].map(p => (
                <Radio key={p} name="plan" value={p} checked={form.plan === p} onChange={set('plan')} label={p} />
              ))}
            </Row>
          </Field>
          <Checkbox switch checked={form.news} onChange={set('news')}>Email me product news</Checkbox>
          <Field as="div" error={errors.terms}>
            <Checkbox checked={form.terms} onChange={set('terms')}>I accept the terms</Checkbox>
          </Field>
          {Object.keys(errors).length > 0 && (
            <Alert variant="danger" title="Check the form" onClose={() => setErrors({})}>Some fields need attention.</Alert>
          )}
          <Row>
            <Button variant="primary" type="submit">Save</Button>
          </Row>
        </Stack>
      </form>
      <Modal open={sent} onClose={() => setSent(false)} title="Saved" footer={<Button variant="primary" onClick={() => setSent(false)}>Done</Button>}>
        <Text>Thanks, {form.name}! You signed up as {form.role} on the {form.plan} plan.</Text>
      </Modal>
    </Card>
  );
}

// An axios-style client with defaults; every request goes through it.
const api = createHttp({ baseURL: 'https://jsonplaceholder.typicode.com', timeout: 8000 });

function HttpCard() {
  const [id, setId] = useState(1);
  const { data: user, error, loading, reload } = useRequest(signal => api.get(`/users/${id}`, { signal }), [id]);
  return (
    <Card title="HTTP (createHttp, useRequest)">
      <Stack>
        <Row>
          <Button size="sm" onClick={() => setId(n => Math.max(1, n - 1))} disabled={id === 1}>Prev</Button>
          <Badge>user {id}</Badge>
          <Button size="sm" onClick={() => setId(n => Math.min(10, n + 1))} disabled={id === 10}>Next</Button>
          <Button size="sm" variant="soft" onClick={reload}>Reload</Button>
          {loading && <Text color="muted" size="sm">Loading…</Text>}
        </Row>
        {error && <Alert variant="danger" title="Request failed">{error.message}</Alert>}
        {user && (
          <Stack gap="xs">
            <Text size="lg">{user.name}</Text>
            <Text color="muted" size="sm">{user.email} · {user.company.name}</Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function App() {
  const [color, setColor] = useState('#4f46e5');

  // Theme the whole page, including <body>, from one colour.
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-theme', color);
  }, [color]);

  return (
    <ThemeContext.Provider value={{ color, setColor }}>
      <Container>
        <Stack gap="lg">
          <Stack gap="xs">
            <h1 class="m-0">tree-project-ui</h1>
            <Text color="muted">A tiny framework with hooks, styled by the tree-project CSS.</Text>
          </Stack>
          <Card title="Theme (createContext / useContext)">
            <ThemePicker />
          </Card>
          <RouterCard />
          <FormCard />
          <HttpCard />
          <Counter />
          <ClockCard />
          <Todos />
          <Theme color="#e11d48">
            <Card title="<Theme> component">
              <Row>
                <Text>This card has its own theme colour.</Text>
                <Button variant="primary" size="sm">Rose</Button>
                <Badge>badge</Badge>
              </Row>
            </Card>
          </Theme>
        </Stack>
      </Container>
    </ThemeContext.Provider>
  );
}

render(<App />, document.getElementById('app'));
