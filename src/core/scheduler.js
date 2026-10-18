// Scheduling: batching re-renders and running effects after the DOM updates.

import { patch, renderComponent } from './reconcile.js';
import { firstNode, lastNode } from './dom.js';

export const dirty = new Set();
let renderQueued = false;
let layoutQ = [];
export let passiveQ = [];
let passiveQueued = false;

export function schedule(inst) {
  if (inst.dead) return;
  inst.dirty = true;
  dirty.add(inst);
  if (!renderQueued) {
    renderQueued = true;
    queueMicrotask(flushRenders);
  }
}

// Re-render every component whose state changed, parents first. A child that
// was already re-rendered by its parent is skipped.
export function flushRenders() {
  renderQueued = false;
  const list = [...dirty].sort((a, b) => a.depth - b.depth);
  dirty.clear();
  for (const inst of list) {
    if (inst.dead || !inst.dirty) continue;
    const old = inst.child;
    const parent = firstNode(old).parentNode;
    const before = lastNode(old).nextSibling;
    const next = renderComponent(inst);
    patch(old, next, parent, inst, before);
    inst.child = next;
    queueEffects(inst);
  }
  commit();
}

export function queueEffects(inst) {
  for (const hk of inst.hooks) if (hk.pending) (hk.layout ? layoutQ : passiveQ).push(hk);
}

function runEffect(hk) {
  if (!hk.pending || hk.inst.dead) return;
  hk.pending = false;
  if (hk.cleanup) hk.cleanup();
  const c = hk.fn();
  hk.cleanup = typeof c === 'function' ? c : null;
}

export function flushPassive() {
  passiveQueued = false;
  const q = passiveQ;
  passiveQ = [];
  q.forEach(runEffect);
}

export function commit() {
  const q = layoutQ;
  layoutQ = [];
  q.forEach(runEffect);
  if (passiveQ.length && !passiveQueued) {
    passiveQueued = true;
    queueMicrotask(flushPassive);
  }
}
