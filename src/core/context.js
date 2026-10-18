// Context: providers register themselves on the component's ctx chain at mount.

import { current } from './reconcile.js';

export function createContext(defaultValue) {
  const context = { id: Symbol('context'), defaultValue };
  context.Provider = function Provider(props) {
    return props.children;
  };
  context.Provider._context = context;
  return context;
}

export function useContext(context) {
  if (!current) throw new Error('Hooks can only be called while a component is rendering');
  const provider = current.ctx[context.id];
  return provider ? provider.vnode.props.value : context.defaultValue;
}
