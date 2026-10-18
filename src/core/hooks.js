// Hooks: per-component state, effects, refs and memoization.

import { current } from './reconcile.js';
import { schedule } from './scheduler.js';

function hook(init) {
  const inst = current;
  if (!inst) throw new Error('Hooks can only be called while a component is rendering');
  const i = inst.hookIndex++;
  return inst.hooks[i] || (inst.hooks[i] = init(inst));
}

const depsChanged = (a, b) => !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));

export function useReducer(reducer, initialArg, init) {
  const hk = hook(inst => {
    const s = { inst, value: init ? init(initialArg) : initialArg };
    s.dispatch = action => {
      const next = s.reducer(s.value, action);
      if (Object.is(next, s.value)) return;
      s.value = next;
      schedule(s.inst);
    };
    return s;
  });
  hk.reducer = reducer;
  return [hk.value, hk.dispatch];
}

const stateReducer = (state, action) => (typeof action === 'function' ? action(state) : action);
const lazyInit = v => (typeof v === 'function' ? v() : v);

export function useState(initial) {
  return useReducer(stateReducer, initial, lazyInit);
}

function effectHook(fn, deps, layout) {
  const hk = hook(inst => ({ inst, layout, ran: false, deps: null, cleanup: null, pending: false }));
  if (!hk.ran || !deps || depsChanged(hk.deps, deps)) {
    hk.ran = true;
    hk.fn = fn;
    hk.deps = deps;
    hk.pending = true;
  }
}

/** Runs after the DOM is updated, without blocking it. Return a function to clean up. */
export const useEffect = (fn, deps) => effectHook(fn, deps, false);
/** Like useEffect, but runs synchronously right after the DOM update (for measuring layout). */
export const useLayoutEffect = (fn, deps) => effectHook(fn, deps, true);

export function useRef(initial) {
  return hook(() => ({ current: initial }));
}

export function useMemo(fn, deps) {
  const hk = hook(() => ({ has: false }));
  if (!hk.has || !deps || depsChanged(hk.deps, deps)) {
    hk.has = true;
    hk.value = fn();
    hk.deps = deps;
  }
  return hk.value;
}

export const useCallback = (fn, deps) => useMemo(() => fn, deps);
