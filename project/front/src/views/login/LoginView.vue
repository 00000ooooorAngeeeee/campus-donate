<template>
  <div class="login-page">
    <div class="login">
      <!-- 左侧品牌区（原型 01：主标题 + 三条卖点 + 插画占位） -->
      <div class="lg-left">
        <div class="brand">
          <span class="logo">拾</span>
          <span>拾光 · 校园旧物捐赠</span>
        </div>
        <h1>把用不上的东西，<br />交到下一位同学手里</h1>
        <p class="slogan">本校毕业季闲置物品捐赠与领取平台</p>

        <div class="feat"><span class="no">1</span><div><b>六项填完就能捐</b><span>不填一堆字段，照片会自动压缩</span></div></div>
        <div class="feat"><span class="no">2</span><div><b>每件物品都有流转履历</b><span>谁捐的、何时入库、被谁领走，全程可查</span></div></div>
        <div class="feat"><span class="no">3</span><div><b>减碳量看得见</b><span>你的每次捐赠都会被折算成 CO₂e 减排</span></div></div>

        <div class="lg-art">
          <div class="ph"><span>插画占位 · 毕业季 · 旧物传递</span></div>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="lg-right">
        <form class="lg-form" novalidate @submit.prevent="submit">
          <h2>登录</h2>
          <p class="lead-t">使用学号登录，管理员请使用后台账号</p>

          <div class="field">
            <label class="label" for="studentNo">学号 / 管理员账号</label>
            <input
              id="studentNo"
              v-model="form.studentNo"
              class="input"
              :class="{ 'err-b': fieldError.studentNo }"
              type="text"
              placeholder="请输入学号"
              maxlength="20"
              autocomplete="username"
              @blur="validateStudentNo"
              @input="fieldError.studentNo = ''"
              @keydown.enter.prevent="pwdRef?.focus()"
            />
            <div v-if="fieldError.studentNo" class="err" aria-live="polite">{{ fieldError.studentNo }}</div>
          </div>

          <div class="field">
            <label class="label" for="password">密码</label>
            <div class="pwd-wrap">
              <input
                id="password"
                ref="pwdRef"
                v-model="form.password"
                class="input"
                :class="{ 'err-b': fieldError.password }"
                :type="showPwd ? 'text' : 'password'"
                placeholder="请输入密码"
                maxlength="64"
                autocomplete="current-password"
                @input="fieldError.password = ''"
                @keydown.enter.prevent="submit"
              />
              <button type="button" class="eye" :aria-label="showPwd ? '隐藏密码' : '显示密码'" @click="showPwd = !showPwd">
                {{ showPwd ? '隐藏' : '显示' }}
              </button>
            </div>
            <div v-if="fieldError.password" class="err" aria-live="polite">{{ fieldError.password }}</div>
          </div>

          <div class="forgot">
            <span>忘记密码？请联系学生资助中心重置</span>
          </div>

          <button class="btn-login" type="submit" :disabled="submitting || lockSeconds > 0">
            {{ lockSeconds > 0 ? `已锁定，${lockSeconds}s 后可重试` : '登 录' }}
          </button>
        </form>

        <!-- 演示账号卡：仅开发环境显示（原型 01 交互说明第 4 条） -->
        <div v-if="isDev" class="demo">
          <b>演示账号</b>
          <button type="button" class="demo-row" @click="fill('admin', 'admin123')">管理员　<code>admin</code> / <code>admin123</code></button>
          <button type="button" class="demo-row" @click="fill('2022010101', '123456')">学生　　<code>2022010101</code> / <code>123456</code></button>
          <button type="button" class="demo-row" @click="fill('2023010202', '123456')">学生（无记录）<code>2023010202</code> / <code>123456</code></button>
        </div>
      </div>
    </div>

    <div class="lg-foot">《Web前端开发技术与UI设计》期末大作业 · 第三小组 · 2026</div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { BizError } from '@/types'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const isDev = import.meta.env.DEV
const form = reactive({ studentNo: '', password: '' })
const fieldError = reactive({ studentNo: '', password: '' })
const showPwd = ref(false)
const submitting = ref(false)
const pwdRef = ref<HTMLInputElement | null>(null)

// 连续 5 次失败锁定 60 秒（原型 01 交互说明第 2 条）
const failCount = ref(0)
const lockSeconds = ref(0)
let lockTimer: ReturnType<typeof setInterval> | null = null

function validateStudentNo(): boolean {
  const v = form.studentNo.trim()
  if (!v) {
    fieldError.studentNo = '请输入学号'
    return false
  }
  if (!/^[A-Za-z0-9]{3,20}$/.test(v)) {
    fieldError.studentNo = '学号格式不正确'
    return false
  }
  fieldError.studentNo = ''
  return true
}

function fill(no: string, pwd: string): void {
  form.studentNo = no
  form.password = pwd
  fieldError.studentNo = ''
  fieldError.password = ''
}

function startLock(): void {
  lockSeconds.value = 60
  lockTimer = setInterval(() => {
    lockSeconds.value -= 1
    if (lockSeconds.value <= 0 && lockTimer) {
      clearInterval(lockTimer)
      lockTimer = null
      failCount.value = 0
    }
  }, 1000)
}

async function submit(): Promise<void> {
  if (submitting.value || lockSeconds.value > 0) return
  const noOk = validateStudentNo()
  if (!form.password) {
    fieldError.password = '请输入密码'
    return
  }
  if (!noOk) return

  submitting.value = true
  try {
    const user = await userStore.login(form.studentNo.trim(), form.password)
    failCount.value = 0
    // 回跳优先（E-08：登录后回到原页面），仅允许站内路径防开放跳转
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect.startsWith('/') && !redirect.startsWith('//')) {
      router.push(redirect)
    } else {
      router.push(user.role === 'ADMIN' ? '/admin/items' : '/discover')
    }
  } catch (e) {
    failCount.value += 1
    // 失败反馈落在密码框下方，且不刷新页面（原型 01 交互说明第 5 条）
    fieldError.password = e instanceof BizError ? e.message : '登录失败，请稍后重试'
    form.password = ''
    pwdRef.value?.focus()
    if (failCount.value >= 5) {
      startLock()
      fieldError.password = '尝试次数过多，请稍后再试'
    }
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  document.querySelector<HTMLInputElement>('#studentNo')?.focus()
})

onBeforeUnmount(() => {
  if (lockTimer) clearInterval(lockTimer)
})
</script>

<style scoped>
/* 本页为用户端手写 CSS（技术约束：用户端不用组件库）；
   颜色与原型 proto.css 保持一致，B 的 tokens.css 落地后统一为变量 */
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.login {
  flex: 1;
  display: flex;
  min-height: 660px;
}
.lg-left {
  width: 600px;
  flex: none;
  background: #f4f8f4;
  padding: 0 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid #edede8;
}
.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 44px;
}
.logo {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #2f7d4f;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.lg-left h1 {
  font-size: 27px;
  line-height: 1.45;
  font-weight: 600;
  margin: 0 0 12px;
  letter-spacing: 0.3px;
  color: #2e2e2c;
}
.slogan {
  color: #6b6b66;
  font-size: 13.5px;
  margin: 0 0 30px;
}
.feat {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  align-items: flex-start;
}
.feat .no {
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: #edf5ef;
  color: #26663f;
  font-size: 10.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin-top: 1px;
  font-weight: 600;
}
.feat b {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 1px;
}
.feat span {
  font-size: 12px;
  color: #9c9c95;
}
.lg-art {
  margin-top: 26px;
}
.ph {
  height: 150px;
  border-radius: 8px;
  border: 1px solid #e3e3dc;
  background: #f1f1ec;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b4b4ac;
  font-size: 11px;
  letter-spacing: 1px;
}
.lg-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.lg-form {
  width: 344px;
}
.lg-form h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
}
.lead-t {
  color: #9c9c95;
  font-size: 12.5px;
  margin: 0 0 30px;
}
.field {
  margin-bottom: 20px;
}
.label {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  color: #6b6b66;
}
.input {
  width: 100%;
  height: 38px;
  padding: 0 11px;
  border: 1px solid #dbdbd4;
  border-radius: 6px;
  background: #fff;
  color: #2e2e2c;
  font-size: 13px;
  font-family: inherit;
}
.input:focus {
  outline: 2px solid #edf5ef;
  border-color: #2f7d4f;
}
.input.err-b {
  border-color: #c0392b;
}
.pwd-wrap {
  position: relative;
}
.eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: #9c9c95;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}
.err {
  margin-top: 5px;
  font-size: 11.5px;
  color: #c0392b;
}
.forgot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #9c9c95;
  margin: -4px 0 22px;
}
.btn-login {
  width: 100%;
  height: 40px;
  border: none;
  border-radius: 6px;
  background: #2f7d4f;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}
.btn-login:hover:not(:disabled) {
  background: #26663f;
}
.btn-login:disabled {
  background: #f4f4ef;
  color: #b8b8b0;
  cursor: not-allowed;
}
.demo {
  width: 344px;
  margin-top: 26px;
  background: #fafaf6;
  border: 1px solid #edede8;
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 11.5px;
  color: #6b6b66;
  line-height: 1.9;
}
.demo b {
  color: #2e2e2c;
  font-weight: 600;
}
.demo-row {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 0;
}
.demo-row:hover {
  color: #2e2e2c;
}
.demo code {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  background: #fff;
  border: 1px solid #edede8;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 11px;
}
.lg-foot {
  height: 44px;
  border-top: 1px solid #edede8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11.5px;
  color: #9c9c95;
}
/* 窄屏兜底：左栏收窄隐藏插画，表单全宽 */
@media (max-width: 900px) {
  .lg-left {
    display: none;
  }
  .lg-form,
  .demo {
    width: min(344px, 86vw);
  }
}
</style>
