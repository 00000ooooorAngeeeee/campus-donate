<template>
  <div class="e404">
    <div class="big">404</div>
    <h4>页面不存在</h4>
    <p>你访问的地址可能已被移动，或从未存在过。</p>
    <div class="acts">
      <button class="btn primary" type="button" @click="router.push('/')">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style scoped>
/* 按原型 09 的异常态家族样式 */
.e404 {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
}
.big {
  font-size: 54px;
  font-weight: 600;
  color: #d6d6ce;
  line-height: 1;
  letter-spacing: 2px;
  margin-bottom: 12px;
}
h4 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
}
p {
  margin: 0 0 18px;
  font-size: 12.5px;
  color: #9c9c95;
}
.btn {
  height: 32px;
  padding: 0 15px;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}
.btn.primary {
  border: 1px solid #2f7d4f;
  background: #2f7d4f;
  color: #fff;
}
</style>
