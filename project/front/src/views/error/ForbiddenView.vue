<template>
  <div class="e403">
    <div class="big">403</div>
    <h4>这个页面需要管理员权限</h4>
    <p>你当前以学生身份登录。如需处理审核或核销，<br />请使用管理后台账号重新登录。</p>
    <div class="acts">
      <button class="btn ghost" type="button" @click="router.push('/discover')">返回发现</button>
      <button class="btn primary" type="button" @click="switchAccount">切换账号</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

async function switchAccount(): Promise<void> {
  await userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
/* 按原型 09 的 403 态设计：说明边界 + 给出两条出路 */
.e403 {
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
  line-height: 1.8;
}
.acts {
  display: flex;
  gap: 12px;
}
.btn {
  height: 32px;
  padding: 0 15px;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}
.btn.ghost {
  border: 1px solid #dbdbd4;
  background: #fff;
  color: #6b6b66;
}
.btn.primary {
  border: 1px solid #2f7d4f;
  background: #2f7d4f;
  color: #fff;
}
</style>
