import { createApp } from 'vue'
import { createPinia } from 'pinia'
// The package ships a precompiled stylesheet with every component utility
// class — Tailwind here does not scan node_modules, so the package CSS must
// be imported. It is imported BEFORE our own style.css so our :root theme
// tokens win and re-skin the package components.
import 'propeller-v2-vue-ui/styles.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { graphqlClient } from './lib/api'

// Restore access token so authenticated API calls work after page reload
const storedToken = localStorage.getItem('accessToken') || localStorage.getItem('auth_token')
if (storedToken) {
  graphqlClient.setAccessToken(storedToken)
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
