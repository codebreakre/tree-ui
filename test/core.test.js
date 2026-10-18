import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  h,
  Fragment,
  render,
  act,
  createContext,
  useContext,
  useState,
  useReducer,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
} from '../src/index.js';

let root;
beforeEach(() => {
  root = new JSDOM('<!doctype html><div id="app"></div>').window.document.getElementById('app');
});

test('renders elements, text and props', () => {
  render(h('p', { className: 'a', id: 'x', title: 'hi' }, 'Hello ', 42), root);
  assert.equal(root.innerHTML, '<p class="a" id="x" title="hi">Hello 42</p>');
});

test('useState re-renders only the component that changed', async () => {
  let set;
  let siblingRenders = 0;
  const Counter = () => {
    const [n, setN] = useState(0);
    set = setN;
    return h('b', null, n);
  };
  const Sibling = () => (siblingRenders++, h('i', null, 'static'));
  render(h('div', null, h(Counter), h(Sibling)), root);

  await act(() => {
    set(1);
    set(n => n + 1); // batched into one render
  });
  assert.equal(root.querySelector('b').textContent, '2');
  assert.equal(siblingRenders, 1);
});

test('setting the same state does not re-render', async () => {
  let renders = 0;
  let set;
  const C = () => {
    renders++;
    const [v, setV] = useState('a');
    set = setV;
    return v;
  };
  render(h(C), root);
  await act(() => set('a'));
  assert.equal(renders, 1);
});

test('keyed children keep their DOM nodes and state when reordered', async () => {
  const Item = ({ label }) => {
    const [clicks, setClicks] = useState(0);
    return h('li', { onClick: () => setClicks(c => c + 1) }, `${label}:${clicks}`);
  };
  const view = items => h('ul', null, items.map(i => h(Item, { key: i, label: i })));

  render(view(['a', 'b', 'c']), root);
  const [a, b, c] = root.querySelectorAll('li');
  await act(() => b.click());
  assert.equal(b.textContent, 'b:1');

  render(view(['c', 'a', 'b']), root);
  const after = [...root.querySelectorAll('li')];
  assert.deepEqual(after, [c, a, b]);
  assert.deepEqual(after.map(li => li.textContent), ['c:0', 'a:0', 'b:1']);

  render(view(['a', 'b']), root);
  assert.deepEqual([...root.querySelectorAll('li')], [a, b]);
});

test('`cond && <X/>` does not shift sibling state', async () => {
  let set;
  const Keep = () => {
    const [v, setV] = useState('initial');
    set = setV;
    return h('span', null, v);
  };
  const view = show => h('div', null, show && h('em', null, 'shown'), h(Keep));
  render(view(false), root);
  await act(() => set('changed'));
  render(view(true), root);
  assert.equal(root.querySelector('span').textContent, 'changed');
  assert.equal(root.querySelector('em').textContent, 'shown');
});

test('fragments and components returning arrays', async () => {
  let set;
  const Pair = () => {
    const [n, setN] = useState(1);
    set = setN;
    return [h('i', null, n), h('i', null, n * 10)];
  };
  render(h('div', null, h('b', null, 'start'), h(Pair), h(Fragment, null, h('u', null, 'end'))), root);
  assert.equal(root.firstChild.innerHTML, '<b>start</b><i>1</i><i>10</i><u>end</u>');
  await act(() => set(2));
  assert.equal(root.firstChild.innerHTML, '<b>start</b><i>2</i><i>20</i><u>end</u>');
});

test('replacing a component type swaps its DOM in place', () => {
  const A = () => h('a', null, 'A');
  const B = () => h('b', null, 'B');
  render(h('div', null, h('i'), h(A), h('i')), root);
  render(h('div', null, h('i'), h(B), h('i')), root);
  assert.equal(root.firstChild.innerHTML, '<i></i><b>B</b><i></i>');
});

test('useEffect runs after render, cleans up on deps change and unmount', async () => {
  const log = [];
  const C = ({ id }) => {
    useEffect(() => {
      log.push('on ' + id);
      return () => log.push('off ' + id);
    }, [id]);
    return id;
  };
  render(h(C, { id: 1 }), root);
  assert.deepEqual(log, []); // not yet: effects are deferred
  await act();
  assert.deepEqual(log, ['on 1']);

  render(h(C, { id: 1 }), root);
  await act();
  assert.deepEqual(log, ['on 1']); // same deps, no re-run

  render(h(C, { id: 2 }), root);
  await act();
  assert.deepEqual(log, ['on 1', 'off 1', 'on 2']);

  render(null, root);
  assert.deepEqual(log, ['on 1', 'off 1', 'on 2', 'off 2']);
});

test('useLayoutEffect runs synchronously with the DOM ready', () => {
  let seen;
  const C = () => {
    const ref = useRef();
    useLayoutEffect(() => {
      seen = ref.current.textContent;
    }, []);
    return h('p', { ref }, 'measured');
  };
  render(h(C), root);
  assert.equal(seen, 'measured');
});

test('effects can set state', async () => {
  const C = () => {
    const [v, setV] = useState('loading');
    useEffect(() => setV('loaded'), []);
    return v;
  };
  render(h(C), root);
  await act();
  assert.equal(root.textContent, 'loaded');
});

test('useMemo only recomputes when deps change', async () => {
  let computed = 0;
  let setA, setB;
  const C = () => {
    const [a, _setA] = useState(1);
    const [b, _setB] = useState(0);
    setA = _setA;
    setB = _setB;
    const double = useMemo(() => (computed++, a * 2), [a]);
    return `${double}-${b}`;
  };
  render(h(C), root);
  await act(() => setB(1));
  assert.equal(computed, 1);
  await act(() => setA(5));
  assert.equal(computed, 2);
  assert.equal(root.textContent, '10-1');
});

test('useReducer', async () => {
  let dispatch;
  const C = () => {
    const [n, d] = useReducer((s, a) => (a === 'inc' ? s + 1 : s), 0);
    dispatch = d;
    return n;
  };
  render(h(C), root);
  await act(() => {
    dispatch('inc');
    dispatch('inc');
  });
  assert.equal(root.textContent, '2');
});

test('context passes values down and updates consumers', async () => {
  const Ctx = createContext('default');
  const Show = () => h('span', null, useContext(Ctx));
  let set;
  const App = () => {
    const [v, setV] = useState('one');
    set = setV;
    return h('div', null, h(Show), h(Ctx.Provider, { value: v }, h('p', null, h(Show))));
  };
  render(h(App), root);
  assert.equal(root.textContent, 'defaultone');
  await act(() => set('two'));
  assert.equal(root.textContent, 'defaulttwo');
});

test('event handlers see the latest state without re-binding', async () => {
  const C = () => {
    const [n, setN] = useState(0);
    return h('button', { onClick: () => setN(n + 1) }, n);
  };
  render(h(C), root);
  const btn = root.querySelector('button');
  await act(() => btn.click());
  await act(() => btn.click());
  await act(() => btn.click());
  assert.equal(btn.textContent, '3');
});

test('style objects, custom properties, booleans and removed props', () => {
  render(h('div', { style: { color: 'red', marginTop: 4, '--ui-theme': '#f00' }, hidden: true, title: 't' }), root);
  const el = root.firstChild;
  assert.equal(el.style.color, 'red');
  assert.equal(el.style.marginTop, '4px');
  assert.equal(el.style.getPropertyValue('--ui-theme'), '#f00');
  assert.equal(el.hidden, true);

  render(h('div', { style: { color: 'blue' } }), root);
  assert.equal(el.style.color, 'blue');
  assert.equal(el.style.marginTop, '');
  assert.equal(el.hasAttribute('title'), false);
  assert.equal(el.hidden, false);
});

test('controlled input keeps the value from state', async () => {
  const C = () => {
    const [v, setV] = useState('abc');
    return h('input', { value: v, onInput: e => setV(e.target.value.toUpperCase()) });
  };
  render(h(C), root);
  const input = root.querySelector('input');
  assert.equal(input.value, 'abc');
  input.value = 'hey';
  await act(() => input.dispatchEvent(new input.ownerDocument.defaultView.Event('input')));
  assert.equal(input.value, 'HEY');
});

test('svg elements use the SVG namespace', () => {
  render(h('svg', { viewBox: '0 0 10 10' }, h('circle', { r: 5 })), root);
  assert.equal(root.querySelector('circle').namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(root.querySelector('svg').getAttribute('viewBox'), '0 0 10 10');
});

test('hooks outside a component throw a clear error', () => {
  assert.throws(() => useState(0), /while a component is rendering/);
});

test('random keyed reorders (with multi-node items) always match the expected DOM', () => {
  let seed = 7;
  const rand = n => ((seed = (seed * 16807) % 2147483647) % n);
  const Item = ({ id }) => (id % 3 === 0 ? [h('i', null, id), h('i', null, id)] : h('i', null, id));
  const expected = ids => ids.flatMap(id => (id % 3 === 0 ? [id, id] : [id])).join(',');

  for (let round = 0; round < 300; round++) {
    const ids = [];
    for (let i = 0; i < 12; i++) if (rand(2)) ids.push(i);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    render(h('div', null, h('b'), ids.map(id => h(Item, { key: id, id })), h('b')), root);
    const got = [...root.firstChild.childNodes].slice(1, -1).map(n => n.textContent).join(',');
    assert.equal(got, expected(ids), `round ${round}`);
  }
});
