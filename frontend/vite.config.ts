import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const graphqlEndpoint = env.VITE_GRAPHQL_ENDPOINT || 'https://api.staging.helice.cloud/v2/graphql'
  const apiKey = env.VITE_API_KEY || ''

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
      hmr: {
        clientPort: 80,
      },
      proxy: {
        '/api/graphql': {
          target: 'https://api.staging.helice.cloud',
          changeOrigin: true,
          rewrite: (path) => '/v2/graphql',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('apikey', apiKey)
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          },
        },
      },
    },
  }
})
