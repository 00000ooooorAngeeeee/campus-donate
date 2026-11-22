/// <reference types="vite/client" />

// vue SFC 模块声明（vue-tsc 接管精确类型前的基础声明）
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
