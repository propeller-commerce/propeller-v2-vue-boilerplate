import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
/**
 * Vite config for the SSR build.
 *
 * The `/api/graphql` + `/api/order-editor` proxies that used to live here are
 * gone — `server.js` (the Node SSR server) owns proxying now, in dev *and*
 * prod, so the API key is injected server-side in both. Vite runs in
 * middleware mode under that server; this config no longer starts a standalone
 * dev server.
 *
 * Two build targets, driven by npm scripts:
 *   - `vite build --outDir dist/client`            → browser bundle + assets
 *   - `vite build --ssr src/entry-server.ts ...`   → Node render bundle
 */
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  // `noExternal` keeps the workspace UI package in the SSR transform pipeline
  // so its `.vue` SFCs are compiled for the Node runtime rather than required
  // raw (Node can't `import` a `.vue` file).
  ssr: {
    noExternal: ['@propeller-commerce/propeller-v2-vue-ui'],
  },
})
