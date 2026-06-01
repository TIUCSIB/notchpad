import { createApp } from 'vue'
import { vJelly } from './directives/jelly'
import App from './App.vue'
import './editor.css'

createApp(App)
  .directive('jelly', vJelly)
  .mount('#app')
