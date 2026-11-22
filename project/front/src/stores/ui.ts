// 轻量 UI 全局态：后台顶栏的动态文案（如核销台的"驿站 · 营业中"）。
// 遵循架构文档 §4.5：Pinia 只存 user / dict / ui 三类全局态，业务数据由页面持有
import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    /** 非空时后台顶栏优先显示该文案（替代默认的"今天是 …"） */
    topbarText: '',
  }),
})
