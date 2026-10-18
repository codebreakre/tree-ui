import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  h,
  render,
  act,
  useState,
  cx,
  Box,
  Stack,
  Card,
  Button,
  Input,
  Badge,
  Text,
  Theme,
  Field,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Alert,
  Modal,
} from '../src/index.js';

let root;
beforeEach(() => {
  root = new JSDOM('<!doctype html><div id="app"></div>').window.document.getElementById('app');
});

const html = el => (render(el, root), root.innerHTML);

test('cx joins class names', () => {
  assert.equal(cx('a', false, ['b', null], { c: true, d: false }), 'a b c');
});

test('Button variants and sizes map to tree-project classes', () => {
  assert.equal(html(h(Button, null, 'Go')), '<button type="button" class="btn">Go</button>');
  assert.equal(
    html(h(Button, { variant: 'primary', size: 'lg', className: 'extra' }, 'Go')),
    '<button type="button" class="btn btn-primary btn-lg extra">Go</button>',
  );
  assert.equal(html(h(Button, { variant: 'soft', type: 'submit' })), '<button type="submit" class="btn btn-soft"></button>');
});

test('size props become utility classes', () => {
  assert.equal(
    html(h(Box, { as: 'section', p: 'md', mx: 'auto', mt: 0, gap: 'lg', rounded: 'xl', text: 'sm', grow: true })),
    '<section class="p-md mx-auto mt-0 gap-lg rounded-xl text-sm grow"></section>',
  );
  assert.equal(html(h(Stack, { gap: 'xs' }, 'x')), '<div class="stack gap-xs">x</div>');
});

test('Card, Input, Badge, Text', () => {
  assert.equal(html(h(Card, { title: 'Hi' }, 'body')), '<div class="card"><h2>Hi</h2>body</div>');
  assert.equal(html(h(Input, { size: 'sm', placeholder: 'x' })), '<input placeholder="x" class="input input-sm">');
  assert.equal(html(h(Badge, null, 'new')), '<span class="bg-primary-soft px-sm rounded-full text-sm">new</span>');
  assert.equal(html(h(Text, { color: 'muted', size: 'xs' }, 't')), '<span class="text-muted text-xs">t</span>');
});

test('Theme sets --ui-theme on a ui-theme wrapper', () => {
  render(h(Theme, { color: '#e11d48' }, 'x'), root);
  const el = root.firstChild;
  assert.equal(el.className, 'ui-theme');
  assert.equal(el.style.getPropertyValue('--ui-theme'), '#e11d48');
});

test('ref on a component reaches its DOM element', () => {
  const ref = {};
  render(h(Input, { ref }), root);
  assert.equal(ref.current, root.querySelector('input'));
});

test('Field shows the label and hint, or the error instead', () => {
  assert.equal(
    html(h(Field, { label: 'Email', hint: 'Work address' }, h(Input))),
    '<label class="field"><span class="field-label">Email</span><input class="input"><span class="field-hint">Work address</span></label>',
  );
  render(h(Field, { label: 'Email', hint: 'Work address', error: 'Required' }, h(Input)), root);
  assert.equal(root.firstChild.className, 'field field-invalid');
  assert.equal(root.querySelector('[role=alert]').textContent, 'Required');
  assert.equal(root.querySelector('.field-hint'), null);
});

test('Textarea and Select', () => {
  assert.equal(html(h(Textarea, { size: 'sm' })), '<textarea rows="3" class="input textarea input-sm"></textarea>');

  render(h(Select, { value: 'b', placeholder: 'Pick one', options: ['a', { value: 'b', label: 'Bee' }, { value: 'c', disabled: true }] }), root);
  const select = root.querySelector('select');
  assert.equal(select.className, 'input select');
  assert.deepEqual([...select.options].map(o => [o.value, o.textContent, o.disabled]), [
    ['', 'Pick one', true],
    ['a', 'a', false],
    ['b', 'Bee', false],
    ['c', 'c', true],
  ]);
  assert.equal(select.value, 'b');
});

test('Checkbox, Switch and Radio', async () => {
  let on;
  const C = () => {
    const [v, setV] = useState(false);
    on = v;
    return h(Checkbox, { switch: true, checked: v, onChange: e => setV(e.target.checked), mt: 'sm' }, 'Notifications');
  };
  render(h(C), root);
  const label = root.firstChild;
  assert.equal(label.className, 'check switch mt-sm');
  assert.equal(label.querySelector('input').getAttribute('role'), 'switch');

  await act(() => label.querySelector('span').click()); // clicking the label toggles it
  assert.equal(on, true);

  assert.equal(html(h(Radio, { name: 'size', value: 's', label: 'Small' })), '<label class="check"><input name="size" type="radio" value="s"><span>Small</span></label>');
});

test('Alert variants and close button', async () => {
  let closed = 0;
  render(h(Alert, { variant: 'danger', title: 'Oops', onClose: () => closed++ }, 'Try again'), root);
  const el = root.firstChild;
  assert.equal(el.className, 'alert alert-danger');
  assert.equal(el.getAttribute('role'), 'alert');
  assert.equal(el.querySelector('.alert-title').textContent, 'Oops');
  el.querySelector('.alert-close').click();
  assert.equal(closed, 1);

  render(h(Alert, null, 'Saved'), root);
  assert.equal(root.firstChild.getAttribute('role'), 'status');
  assert.equal(root.querySelector('.alert-close'), null);
});

test('Modal opens and closes with its prop; Escape and backdrop call onClose', async () => {
  let setOpen;
  const App = () => {
    const [open, set] = useState(false);
    setOpen = set;
    return h(Modal, { open, onClose: () => set(false), title: 'Hello', footer: h(Button, null, 'OK') }, 'Body');
  };
  render(h(App), root);
  const dialog = root.querySelector('dialog');
  assert.equal(dialog.hasAttribute('open'), false);
  assert.equal(dialog.textContent, ''); // content only while open

  await act(() => setOpen(true));
  assert.equal(dialog.hasAttribute('open'), true);
  assert.equal(dialog.querySelector('.modal-title').textContent, 'Hello');

  await act(() => dialog.querySelector('.modal-body').click()); // inside: stays open
  assert.equal(dialog.hasAttribute('open'), true);

  const win = dialog.ownerDocument.defaultView;
  await act(() => dialog.dispatchEvent(new win.Event('cancel', { cancelable: true }))); // Escape
  assert.equal(dialog.hasAttribute('open'), false);

  await act(() => setOpen(true));
  await act(() => dialog.click()); // backdrop
  assert.equal(dialog.hasAttribute('open'), false);
});
