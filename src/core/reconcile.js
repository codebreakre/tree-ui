// Mount / patch / unmount: turning vnode trees into DOM and keeping it in sync.

import { Fragment, TEXT, EMPTY, toVNode, kidsOf } from './vnode.js';
import { SVG_NS, firstNode, place, setRef, setProps } from './dom.js';
import { queueEffects } from './scheduler.js';

const ROOT_CTX = Object.freeze(Object.create(null));

export let current = null; // component currently rendering

export function mount(v, parent, before, owner) {
  const t = v.type;
  const doc = parent.ownerDocument;

  if (t === TEXT) {
    v.dom = doc.createTextNode(v.props.text);
    parent.insertBefore(v.dom, before);
  } else if (t === EMPTY) {
    v.dom = doc.createComment('');
    parent.insertBefore(v.dom, before);
  } else if (t === Fragment) {
    v.kids = kidsOf(v, true);
    for (const k of v.kids) mount(k, parent, before, owner);
  } else if (typeof t === 'function') {
    const inst = (v.inst = {
      vnode: v,
      hooks: [],
      hookIndex: 0,
      depth: owner ? owner.depth + 1 : 0,
      ctx: owner ? owner.ctx : ROOT_CTX,
      dirty: false,
      dead: false,
      child: null,
    });
    if (t._context) {
      inst.ctx = Object.create(inst.ctx);
      inst.ctx[t._context.id] = inst;
    }
    inst.child = renderComponent(inst);
    mount(inst.child, parent, before, inst);
    queueEffects(inst);
  } else {
    const svg = t === 'svg' || (parent.namespaceURI === SVG_NS && parent.nodeName !== 'foreignObject');
    const dom = (v.dom = svg ? doc.createElementNS(SVG_NS, t) : doc.createElement(t));
    v.kids = kidsOf(v);
    for (const k of v.kids) mount(k, dom, null, owner);
    setProps(dom, {}, v.props, svg); // after children so <select value> works
    parent.insertBefore(dom, before);
    setRef(v.ref, dom);
  }
}

// Patch `old` into `v`. `before` is the node that should follow v's DOM afterwards.
export function patch(old, v, parent, owner, before) {
  if (old.type !== v.type || old.key !== v.key) {
    mount(v, parent, before, owner);
    unmount(old, true);
    return;
  }
  const t = v.type;

  if (t === TEXT) {
    v.dom = old.dom;
    if (old.props.text !== v.props.text) v.dom.nodeValue = v.props.text;
  } else if (t === EMPTY) {
    v.dom = old.dom;
  } else if (t === Fragment) {
    v.kids = patchChildren(parent, old.kids, kidsOf(v, true), owner, before);
  } else if (typeof t === 'function') {
    const inst = (v.inst = old.inst);
    inst.vnode = v;
    const child = renderComponent(inst);
    patch(inst.child, child, parent, inst, before);
    inst.child = child;
    queueEffects(inst);
  } else {
    const dom = (v.dom = old.dom);
    v.kids = patchChildren(dom, old.kids, kidsOf(v), owner, null);
    setProps(dom, old.props, v.props, dom.namespaceURI === SVG_NS);
    if (old.ref !== v.ref) {
      setRef(old.ref, null);
      setRef(v.ref, dom);
    }
  }
}

// Match children by key (or by position when unkeyed), then walk backwards so
// every child can be placed right before the one after it.
function patchChildren(parent, oldKids, newKids, owner, before) {
  const id = (k, i) => (k.key != null ? 'k' + k.key : 'i' + i);
  const pool = new Map();
  oldKids.forEach((k, i) => pool.set(id(k, i), k));

  const matched = newKids.map((k, i) => {
    const o = pool.get(id(k, i));
    if (o && o.type === k.type) {
      pool.delete(id(k, i));
      return o;
    }
    return null;
  });
  for (const o of pool.values()) unmount(o, true);

  for (let i = newKids.length - 1; i >= 0; i--) {
    const k = newKids[i];
    if (matched[i]) {
      patch(matched[i], k, parent, owner, before);
      place(k, parent, before);
    } else {
      mount(k, parent, before, owner);
    }
    before = firstNode(k);
  }
  return newKids;
}

function unmount(v, remove) {
  if (v.inst) {
    const inst = v.inst;
    inst.dead = true;
    for (const hk of inst.hooks) {
      if (hk.cleanup) {
        const c = hk.cleanup;
        hk.cleanup = null;
        c();
      }
    }
    unmount(inst.child, remove);
    return;
  }
  if (v.kids) for (const k of v.kids) unmount(k, remove && !v.dom);
  if (v.dom) {
    if (v.ref) setRef(v.ref, null);
    if (remove) v.dom.remove();
  }
}

export function renderComponent(inst) {
  const prev = current;
  current = inst;
  inst.hookIndex = 0;
  inst.dirty = false;
  try {
    return toVNode(inst.vnode.type(inst.vnode.props));
  } finally {
    current = prev;
  }
}
