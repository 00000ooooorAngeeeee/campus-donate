<template>
  <RouterView />
</template>

<script setup lang="ts">
// 根组件只承担路由出口。全局基线样式（字体栈/背景/focus 可见性）
// 写在本组件的非 scoped style 中；B 的 tokens.css（S3-03）落地后统一接管。
</script>

<style>
* {
  box-sizing: border-box;
}
html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}
body {
  font: 13px/1.65 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
  background: #f1f1ec;
  color: #2e2e2c;
  -webkit-font-smoothing: antialiased;
}
a {
  color: #2f7d4f;
  text-decoration: none;
}
/* N3 无障碍：键盘焦点必须可见（2px 主色描边） */
:focus-visible {
  outline: 2px solid #2f7d4f;
  outline-offset: 1px;
}
</style>
