// Virtual nodes: creating elements and normalizing what components return.

export const Fragment = Symbol.for('tree.fragment');
export const TEXT = Symbol('text');
export const EMPTY = Symbol('empty');

export function h(type, props, ...children) {
  const { key = null, ref = null, ...rest } = props || {};
  if (children.length) rest.children = children.length === 1 ? children[0] : children;
  // Components receive `ref` as a normal prop so they can pass it to a DOM element.
  if (typeof type === 'function') {
    if (ref) rest.ref = ref;
    return { type, props: rest, key, ref: null };
  }
  return { type, props: rest, key, ref };
}

// Turn anything a component can return into a fresh vnode. Vnodes are copied
// so the same element object can safely be rendered in more than one place.
export function toVNode(c) {
  if (c == null || typeof c === 'boolean') return { type: EMPTY, props: {}, key: null };
  if (Array.isArray(c)) return { type: Fragment, props: { children: c }, key: null };
  if (typeof c === 'object' && 'type' in c && 'props' in c) {
    return { type: c.type, props: c.props, key: c.key ?? null, ref: c.ref ?? null };
  }
  return { type: TEXT, props: { text: String(c) }, key: null };
}

// Fragments always keep at least one child so every vnode owns a DOM node.
export function kidsOf(v, atLeastOne) {
  const c = v.props.children;
  const list = (c === undefined ? [] : Array.isArray(c) ? c : [c]).map(toVNode);
  if (atLeastOne && !list.length) list.push(toVNode(null));
  return list;
}
