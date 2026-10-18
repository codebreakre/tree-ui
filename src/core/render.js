// Public entry points: render into a container, and flush updates in tests.

import { toVNode } from './vnode.js';
import { lastNode } from './dom.js';
import { mount, patch } from './reconcile.js';
import { dirty, passiveQ, flushRenders, flushPassive, commit } from './scheduler.js';

/**
 * Render `element` into `container`. Calling it again on the same container
 * updates the existing DOM instead of replacing it. `render(null, el)` unmounts.
 */
export function render(element, container) {
  const v = toVNode(element);
  const old = container.__tree;
  if (old) {
    patch(old, v, container, null, lastNode(old).nextSibling);
  } else {
    container.textContent = '';
    mount(v, container, null, null);
  }
  container.__tree = v;
  commit();
}

/**
 * Run `fn`, then synchronously apply every pending state update and effect.
 * Handy in tests: `await act(() => button.click())`.
 */
export async function act(fn) {
  if (fn) await fn();
  for (let guard = 0; guard < 1000; guard++) {
    if (dirty.size) flushRenders();
    else if (passiveQ.length) flushPassive();
    else return;
  }
  throw new Error('act(): updates did not settle (infinite update loop?)');
}
