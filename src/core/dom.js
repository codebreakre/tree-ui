// DOM helpers: locating a vnode's nodes, moving them, and applying props.

export const SVG_NS = 'http://www.w3.org/2000/svg';

function nodesOf(v, out = []) {
  if (v.dom) out.push(v.dom);
  else if (v.inst) nodesOf(v.inst.child, out);
  else for (const k of v.kids) nodesOf(k, out);
  return out;
}
export const firstNode = v => v.dom || (v.inst ? firstNode(v.inst.child) : firstNode(v.kids[0]));
export const lastNode = v => v.dom || (v.inst ? lastNode(v.inst.child) : lastNode(v.kids[v.kids.length - 1]));

// Move a vnode's DOM nodes so they sit right before `before`, if they don't already.
export function place(v, parent, before) {
  if (lastNode(v).nextSibling === before) return;
  for (const n of nodesOf(v)) parent.insertBefore(n, before);
}

export function setRef(ref, value) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

const UNITLESS = /^(opacity|zIndex|flex|flexGrow|flexShrink|order|lineHeight|fontWeight|zoom)$/;

function setStyleProp(style, k, v) {
  if (k.includes('-')) style.setProperty(k, v == null ? '' : String(v));
  else style[k] = typeof v === 'number' && !UNITLESS.test(k) ? v + 'px' : v == null ? '' : v;
}

function setStyle(style, value, old) {
  if (value == null || typeof value === 'string') {
    style.cssText = value || '';
    return;
  }
  if (typeof old === 'string') {
    style.cssText = '';
    old = null;
  }
  for (const k in old) if (!(k in value)) setStyleProp(style, k, null);
  for (const k in value) if (!old || old[k] !== value[k]) setStyleProp(style, k, value[k]);
}

function proxy(e) {
  return this.__l[e.type](e);
}

function setProp(dom, name, value, old, svg) {
  if (name === 'children') return;
  if (name === 'style') return setStyle(dom.style, value, old);

  if (name[0] === 'o' && name[1] === 'n') {
    // One listener per event type; handlers are swapped without re-binding.
    const type = name.slice(2).toLowerCase();
    const ls = (dom.__l ||= {});
    if (value) {
      if (!ls[type]) dom.addEventListener(type, proxy);
      ls[type] = value;
    } else if (ls[type]) {
      dom.removeEventListener(type, proxy);
      delete ls[type];
    }
    return;
  }

  if (name === 'className') name = 'class';
  if (!svg) {
    if (name === 'value' || name === 'checked' || name === 'selected') {
      const v = name === 'value' ? (value == null ? '' : String(value)) : !!value;
      if (dom[name] !== v) dom[name] = v; // keeps the cursor where it is
      return;
    }
    if (name !== 'class' && typeof dom[name] === 'boolean') {
      dom[name] = !!value; // disabled, hidden, readOnly, ...
      return;
    }
  }
  if (value == null || value === false) dom.removeAttribute(name);
  else dom.setAttribute(name, value === true ? '' : value);
}

export function setProps(dom, oldP, newP, svg) {
  for (const n in oldP) if (!(n in newP)) setProp(dom, n, null, oldP[n], svg);
  for (const n in newP) {
    if (oldP[n] !== newP[n] || n === 'value' || n === 'checked') setProp(dom, n, newP[n], oldP[n], svg);
  }
}
