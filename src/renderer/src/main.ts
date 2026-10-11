// 最早处安装 window.api 兼容桥(Tauri 后端),后续任何模块 import 时都已就绪
import './api/bridge'
import { createApp } from 'vue'
import { vJelly } from './directives/jelly'
import App from './App.vue'
import './editor.css'

createApp(App).directive('jelly', vJelly).mount('#app')
