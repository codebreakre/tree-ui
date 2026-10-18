// Ready-made components built on the `tree-project` CSS classes.
import { h, useRef, useLayoutEffect } from './core/index.js';

/** Join class names: cx('a', cond && 'b', ['c'], { d: true }) -> 'a b c d' */
export function cx(...args) {
  const out = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === 'string') out.push(a);
    else if (Array.isArray(a)) out.push(cx(...a));
    else if (typeof a === 'object') for (const k in a) if (a[k]) out.push(k);
  }
  return out.filter(Boolean).join(' ');
}

// Size props shared by every component. Values: 0, 'xs', 'sm', 'md', 'lg', 'xl'.
// e.g. <Box p="md" mx="auto" rounded="lg" text="sm" grow>
const SIZE_PROPS = ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'gap', 'rounded', 'border', 'text'];

function split(props) {
  const classes = [];
  const rest = {};
  for (const k in props) {
    const v = props[k];
    if (SIZE_PROPS.includes(k)) {
      if (v != null && v !== false) classes.push(`${k}-${v}`);
    } else if (k === 'grow') {
      if (v) classes.push('grow');
    } else if (k !== 'className' && k !== 'class') {
      rest[k] = v;
    }
  }
  return [cx(classes, props.className, props.class), rest];
}

function withClass(tag, base, props) {
  const [classes, rest] = split(props);
  return h(tag, { ...rest, className: cx(base, classes) || undefined });
}

/** Plain element with size props. `as` picks the tag (default div). */
export const Box = ({ as = 'div', ...props }) => withClass(as, null, props);

export const Container = props => withClass('div', 'container', props);

/** Vertical flex column. */
export const Stack = props => withClass('div', 'stack', props);

/** Horizontal flex row that wraps. */
export const Row = props => withClass('div', 'row', props);

/** Surface box with an optional title. */
export function Card({ title, children, ...props }) {
  return withClass('div', 'card', { ...props, children: title == null ? children : [h('h2', null, title), children] });
}

/**
 * variant: 'default' | 'primary' | 'soft' | 'danger'
 * size:    'xs' | 'sm' | 'md' | 'lg' | 'xl'
 */
export function Button({ variant = 'default', size = 'md', type = 'button', ...props }) {
  return withClass('button', cx('btn', variant !== 'default' && `btn-${variant}`, size !== 'md' && `btn-${size}`), {
    type,
    ...props,
  });
}

/** size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'. Use onInput for every keystroke, onChange for commit. */
export function Input({ size = 'md', ...props }) {
  return withClass('input', cx('input', size !== 'md' && `input-${size}`), props);
}

/** variant: 'soft' | 'primary' */
export function Badge({ variant = 'soft', ...props }) {
  return withClass('span', cx(variant === 'primary' ? 'bg-primary' : 'bg-primary-soft', 'px-sm rounded-full text-sm'), props);
}

/**
 * color: 'primary' | 'muted' | 'danger' | 'success' | 'warning'
 * size:  'xs' | 'sm' | 'md' | 'lg' | 'xl'
 */
export function Text({ as = 'span', color, size, ...props }) {
  return withClass(as, cx(color && `text-${color}`, size && `text-${size}`), props);
}

export const List = props => withClass('ul', 'list', props);
export const ListItem = props => withClass('li', null, props);

/**
 * Re-colour everything inside from a single colour.
 * <Theme color="#e11d48" tint={1}>...</Theme>
 */
export function Theme({ color, tint, style, ...props }) {
  return withClass('div', 'ui-theme', {
    ...props,
    style: { ...style, '--ui-theme': color, '--ui-tint': tint },
  });
}

/* Forms -------------------------------------------------------------- */

/**
 * Label, control, and a hint or error underneath.
 * <Field label="Email" hint="We never share it" error={errors.email}><Input type="email" /></Field>
 */
export function Field({ as = 'label', label, hint, error, children, ...props }) {
  return withClass(as, cx('field', error && 'field-invalid'), {
    ...props,
    children: [
      label != null && h('span', { className: 'field-label' }, label),
      children,
      error ? h('span', { className: 'field-error', role: 'alert' }, error) : hint != null && h('span', { className: 'field-hint' }, hint),
    ],
  });
}

/** Multi-line Input. size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' */
export function Textarea({ size = 'md', rows = 3, ...props }) {
  return withClass('textarea', cx('input textarea', size !== 'md' && `input-${size}`), { rows, ...props });
}

/**
 * options: ['a', 'b'] or [{ value, label, disabled }]; or pass <option> children.
 * placeholder adds a disabled first option, shown while value is ''.
 */
export function Select({ size = 'md', options, placeholder, children, ...props }) {
  const opts = options
    ? options
        .map(o => (o !== null && typeof o === 'object' ? o : { value: o }))
        .map(o => h('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label ?? o.value))
    : children;
  return withClass('select', cx('input select', size !== 'md' && `input-${size}`), {
    ...props,
    children: [placeholder != null && h('option', { value: '', disabled: true }, placeholder), opts],
  });
}

/**
 * Checkbox with a clickable label. `switch` draws it as a toggle.
 * <Checkbox checked={on} onChange={e => setOn(e.target.checked)}>Remember me</Checkbox>
 */
export function Checkbox({ label, children, switch: isSwitch, type = 'checkbox', ...props }) {
  const [classes, rest] = split(props);
  const text = label ?? children;
  return h(
    'label',
    { className: cx('check', isSwitch && 'switch', classes) },
    h('input', { ...rest, type, role: isSwitch ? 'switch' : undefined }),
    text != null && h('span', null, text),
  );
}

/** Same as Checkbox; give radios in a group the same `name`. */
export const Radio = props => h(Checkbox, { ...props, type: 'radio' });

/* Feedback and overlays ---------------------------------------------- */

/** variant: 'info' | 'success' | 'warning' | 'danger'. Pass onClose to show a close button. */
export function Alert({ variant = 'info', title, onClose, children, ...props }) {
  return withClass('div', cx('alert', `alert-${variant}`), {
    role: variant === 'danger' || variant === 'warning' ? 'alert' : 'status',
    ...props,
    children: [
      h('div', { className: 'grow' }, title != null && h('strong', { className: 'alert-title' }, title), children),
      onClose && h('button', { type: 'button', className: 'alert-close', 'aria-label': 'Close', onClick: onClose }, '×'),
    ],
  });
}

/**
 * Dialog over the page, built on the native <dialog>.
 * <Modal open={open} onClose={() => setOpen(false)} title="Delete file?" footer={<Button>Delete</Button>}>...</Modal>
 * Escape and clicking the backdrop call onClose. The content only renders while open.
 */
export function Modal({ open, onClose, title, footer, children, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const d = ref.current;
    const isOpen = d.hasAttribute('open');
    if (open && !isOpen) d.showModal ? d.showModal() : d.setAttribute('open', '');
    else if (!open && isOpen) d.close ? d.close() : d.removeAttribute('open');
  }, [open]);
  return withClass('dialog', 'modal', {
    ...props,
    ref,
    // Escape: let the `open` prop decide instead of the browser closing it.
    onCancel: e => {
      e.preventDefault();
      if (onClose) onClose();
    },
    // The dialog itself has no padding, so a click whose target is the dialog hit the backdrop.
    onClick: e => {
      if (e.target === ref.current && onClose) onClose();
    },
    children:
      open &&
      h(
        'div',
        { className: 'modal-body' },
        title != null && h('h2', { className: 'modal-title' }, title),
        children,
        footer != null && h('div', { className: 'row modal-footer' }, footer),
      ),
  });
}
