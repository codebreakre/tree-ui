import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = path => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Use the local source, exactly as an app would import the published package.
    alias: [
      { find: /^tree-project-ui$/, replacement: src('index.js') },
      { find: /^tree-project-ui\/styles\.css$/, replacement: src('styles.css') },
    ],
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'tree-project-ui'`,
  },
});
