import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Vite reads .env from process.cwd() by default — when you run `npm run dev`
  // from frontend/, that's frontend/.env. Pass an explicit path if you ever
  // want to keep the env file at the workspace root.
  const env = loadEnv(mode, process.cwd(), '')

  // VITE_GRAPHQL_PROXY_TARGET is the full upstream URL the dev proxy forwards to.
  // VITE_GRAPHQL_ENDPOINT is what the browser-side SDK config calls — typically
  // /api/graphql so requests go through the Vite proxy. Don't put a relative
  // path in VITE_GRAPHQL_PROXY_TARGET; new URL() needs an absolute URL.
  const proxyUpstream =
    env.VITE_GRAPHQL_PROXY_TARGET ||
    (env.VITE_GRAPHQL_ENDPOINT && /^https?:/i.test(env.VITE_GRAPHQL_ENDPOINT)
      ? env.VITE_GRAPHQL_ENDPOINT
      : 'https://api.helice.cloud/v2/graphql')
  const apiKey = env.VITE_API_KEY || ''
  const orderEditorApiKey = env.VITE_ORDER_EDITOR_API_KEY || ''
  const behindProxy = env.VITE_BEHIND_PROXY === 'true'

  const endpointUrl = new URL(proxyUpstream)
  const proxyTarget = endpointUrl.origin
  const proxyRewritePath = endpointUrl.pathname

  return {
    plugins: [
      vue(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      allowedHosts: [
        'vue-boilerplate.dev.wp-propel.com',
        'vue-boilerplate.stage.wp-propel.com',
        'vue-boilerplate.prod.wp-propel.com',
      ],
      hmr: behindProxy ? { clientPort: 80 } : true,
      proxy: {
        '/api/graphql': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: () => proxyRewritePath,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('apikey', apiKey)
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          },
        },
        '/api/order-editor': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace('/api/order-editor', ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('apikey', orderEditorApiKey)
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          },
        },
      },
    },
  }
})