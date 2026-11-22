<template>
  <div class="redeem">
    <div class="cols2">
      <!-- 左栏：领取码核销（原型 07：只保留「输入码 → 确认」两步） -->
      <div class="c-left">
        <div class="card">
          <div class="card-hd">
            <h3>领取码核销</h3>
            <span class="dim f11">8 位字母 + 数字</span>
          </div>
          <div class="card-bd">
            <label class="label" for="redeem-code">输入领取码</label>
            <input
              id="redeem-code"
              ref="codeRef"
              v-model="code"
              class="codeinput"
              :class="{ on: code.length > 0 }"
              type="text"
              inputmode="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="········"
              maxlength="8"
              aria-describedby="redeem-hint"
              @input="sanitize"
              @keydown.enter.prevent="tryRedeem"
            />
            <div class="keypad">
              <button type="button" class="k" @click="backspace">⌫</button>
              <button type="button" class="k" @click="code = ''">清空</button>
              <span id="redeem-hint" class="k-hint">扫码枪可直接输入，回车即核销</span>
            </div>

            <button class="btn-main" type="button" :disabled="code.length < 8 || submitting" @click="tryRedeem">
              {{ submitting ? '核销中…' : '核 销' }}
            </button>

            <!-- 成功结果卡：物品 / 数量 / 领取人 / 批次剩余 四件事必须齐全 -->
            <div v-if="result" class="ok" role="status" aria-live="polite">
              <div class="h"><span class="i">✓</span>核销成功</div>
              <div class="kv"><span>物品</span>　<b>{{ result.itemTitle }}</b></div>
              <div class="kv">
                <span>数量</span>　<b>{{ result.qty }} 件</b>　｜　领取人　<b>{{ result.receiverName }} · {{ result.receiverStudentNo }}</b>
              </div>
              <div class="kv">
                <span>批次状态</span>　<b>{{
                  result.itemClosed ? '已全部领完，批次完结' : `剩余 ${result.remaining} 件，继续在架`
                }}</b>
              </div>
            </div>

            <!-- 失败结果：四类原因必须区分，不能统一"核销失败" -->
            <div v-if="failure" class="fail" role="alert" aria-live="assertive">
              <div class="h"><span class="i">×</span>{{ failure.label }}</div>
              <p>{{ failure.message }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右栏：今日待领取 + 最近核销记录 -->
      <div class="c-right">
        <div v-if="error" class="card">
          <div class="state">
            <div class="ico">!</div>
            <h4>没能加载出来</h4>
            <p>{{ error }}</p>
            <button class="btn-retry" type="button" @click="loadToday">重新加载</button>
          </div>
        </div>

        <template v-else>
          <div class="card" v-loading="loading">
            <div class="card-hd">
              <h3>今日待领取</h3>
              <span class="dim f11">按到期时间升序，快过期的排前面</span>
            </div>
            <div class="card-bd wait">
              <div v-for="row in pendingRows" :key="row.code" class="wrow" :class="{ urgent: isUrgent(row) }">
                <span class="cd">{{ row.code }}</span>
                <span class="nm">
                  {{ row.itemTitle }}
                  <span>{{ row.receiverName }} · {{ row.receiverStudentNo }} · {{ row.qty }} 件</span>
                </span>
                <span class="lt">{{ remainText(row) }}</span>
                <span class="go"><a @click="redeemFromRow(row)">核销</a></span>
              </div>
              <div v-if="!loading && !pendingRows.length" class="wempty">当前没有待领取的预约</div>
            </div>
          </div>

          <div class="card mt20">
            <div class="card-hd">
              <h3>最近核销记录</h3>
              <span class="dim f11">今日已核销 {{ today?.stats.orders ?? 0 }} 单 / {{ today?.stats.pieces ?? 0 }} 件</span>
            </div>
            <table class="rec-tb">
              <thead>
                <tr>
                  <th>领取码</th>
                  <th>物品 / 数量</th>
                  <th>核销时间</th>
                  <th>操作人</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in today?.redeemedToday ?? []" :key="r.code">
                  <td>{{ r.code }}</td>
                  <td class="t-ellipsis">{{ r.itemTitle }}<em>×{{ r.qty }}</em></td>
                  <td>{{ fmt(r.collectedAt) }}</td>
                  <td>{{ r.operatorNo }}</td>
                </tr>
              </tbody>
              <tbody v-if="!today || !today.redeemedToday.length">
                <tr>
                  <td colspan="4" class="t-empty">今日还没有核销记录</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { ElLoadingDirective } from 'element-plus'
import { fetchToday, redeemCode } from '@/api/admin'
import { useUiStore } from '@/stores/ui'
import { BizError, type PendingReservation, type RedeemResult, type TodayData } from '@/types'

// script setup 约定：v 开头的局部变量会被识别为模板指令
const vLoading = ElLoadingDirective

const uiStore = useUiStore()
const code = ref('')
const submitting = ref(false)
const result = ref<RedeemResult | null>(null)
const failure = ref<{ label: string; message: string } | null>(null)
const today = ref<TodayData | null>(null)
const loading = ref(false)
const error = ref('')
const codeRef = ref<HTMLInputElement | null>(null)

const pendingRows = computed(() => today.value?.pending ?? [])

// 成功后 3 秒自动清空回焦（原型 07 提示条：高峰期一分钟两三单，少一次点击）
let resetTimer: ReturnType<typeof setTimeout> | null = null
// 每 30 秒刷新一次"现在"，让剩余时长走字
let tickTimer: ReturnType<typeof setInterval> | null = null
const nowTs = ref(Date.now())

onMounted(() => {
  loadToday()
  codeRef.value?.focus()
  tickTimer = setInterval(() => {
    nowTs.value = Date.now()
  }, 30 * 1000)
})
onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer)
  if (tickTimer) clearInterval(tickTimer)
  uiStore.topbarText = ''
})

async function loadToday(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    today.value = await fetchToday()
    // 顶栏显示所在驿站（原型 07 顶栏右侧：一食堂西侧驿站 · 营业中）
    uiStore.topbarText = today.value.station ? `${today.value.station.name} · 营业中` : ''
  } catch (e) {
    error.value = e instanceof BizError ? e.message : '网络连接不太稳定，请检查后重试'
  } finally {
    loading.value = false
  }
}

/** 输入即时归一化：转大写并过滤空格/连字符等（防从聊天记录复制带格式） */
function sanitize(): void {
  // 用户开始输入新码时，取消上一次成功结果的自动清空，避免误清当前输入
  if (resetTimer) {
    clearTimeout(resetTimer)
    resetTimer = null
    result.value = null
  }
  const raw = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  code.value = raw.slice(0, 8)
  failure.value = null
}

function backspace(): void {
  code.value = code.value.slice(0, -1)
  codeRef.value?.focus()
}

function scheduleAutoReset(): void {
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    result.value = null
    code.value = ''
    codeRef.value?.focus()
  }, 3000)
}

async function tryRedeem(): Promise<void> {
  if (code.value.length < 8 || submitting.value) return
  if (resetTimer) {
    clearTimeout(resetTimer)
    resetTimer = null
  }
  submitting.value = true
  result.value = null
  failure.value = null
  try {
    result.value = await redeemCode(code.value)
    scheduleAutoReset()
    loadToday()
  } catch (e) {
    if (e instanceof BizError) {
      // 码无效（2001）时不清空输入，方便逐位核对（原型 07 交互说明第 4 条）
      failure.value = { label: failLabel(e), message: e.message }
    } else {
      failure.value = { label: '操作失败', message: '网络异常，请稍后重试' }
    }
    // 超时/取消的核销尝试会触发服务端回收，列表可能变化，顺带刷新
    if (e instanceof BizError && (e.code === 3003 || e.code === 3004)) {
      loadToday()
    }
    codeRef.value?.focus()
  } finally {
    submitting.value = false
  }
}

function failLabel(e: BizError): string {
  if (e.code === 3004) return '重复核销'
  if (e.code === 3003) return '已超时'
  if (e.code === 2001) return '码无效'
  if (e.code === 3002 && e.message.includes('取消')) return '已取消'
  if (e.code === 3002) return '无法核销'
  if (e.code === 1001) return '领取码无效'
  return '操作失败'
}

function redeemFromRow(row: PendingReservation): void {
  code.value = row.code
  failure.value = null
  tryRedeem()
}

// ---- 剩余时长 ----

function remainMs(row: PendingReservation): number {
  return dayjs(row.expireAt).valueOf() - nowTs.value
}

/** 剩不足 1 天的整行转红（原型 07 交互说明第 5 条） */
function isUrgent(row: PendingReservation): boolean {
  return remainMs(row) < 24 * 60 * 60 * 1000
}

function remainText(row: PendingReservation): string {
  const ms = remainMs(row)
  if (ms <= 0) return '即将回收'
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const days = Math.floor(hours / 24)
  return days >= 1 ? `剩 ${days} 天 ${hours % 24} 小时` : `剩 ${hours} 小时`
}

function fmt(d: string): string {
  return dayjs(d).format('MM-DD HH:mm')
}
</script>

<style scoped>
/* 视觉照原型 07：左 520px 输入卡 + 右侧两张卡 */
.redeem {
  max-width: 1080px;
}
.cols2 {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.c-left {
  width: 520px;
  flex: none;
}
.c-right {
  flex: 1;
  min-width: 0;
}

.card {
  background: #fff;
  border: 1px solid var(--c-line);
  border-radius: 8px;
}
.card-hd {
  padding: 14px 18px;
  border-bottom: 1px solid var(--c-line2);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-hd h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}
.card-bd {
  padding: 18px 20px 20px;
}
.dim {
  color: var(--c-ink3);
}
.f11 {
  font-size: 11px;
}
.mt20 {
  margin-top: 20px;
}

.label {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  color: var(--c-ink2);
}
.codeinput {
  margin-top: 0;
  width: 100%;
  height: 58px;
  border: 2px solid var(--c-line);
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 18px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 25px;
  letter-spacing: 6px;
  color: var(--c-ink3);
  background: #fff;
}
.codeinput.on {
  border-color: var(--c-primary);
  color: var(--c-ink);
}
.codeinput::placeholder {
  color: #d9d9d2;
  letter-spacing: 6px;
}
.keypad {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  align-items: center;
}
.k {
  width: 44px;
  height: 26px;
  border: 1px solid var(--c-line);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11.5px;
  color: var(--c-ink2);
  background: #fff;
  cursor: pointer;
  font-family: inherit;
}
.k:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
}
.k-hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--c-ink3);
}

.btn-main {
  width: 100%;
  height: 40px;
  margin-top: 16px;
  border: none;
  border-radius: 6px;
  background: var(--c-primary);
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  letter-spacing: 2px;
  cursor: pointer;
}
.btn-main:hover:not(:disabled) {
  background: var(--c-primary-d);
}
.btn-main:disabled {
  background: #f4f4ef;
  color: #b8b8b0;
  cursor: not-allowed;
}

/* 成功卡（照原型 .ok） */
.ok {
  background: var(--c-primary-s);
  border: 1px solid #cfe4d6;
  border-radius: 8px;
  padding: 13px 16px;
  margin-top: 16px;
}
.ok .h {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--c-primary-d);
  margin-bottom: 8px;
}
.ok .h .i {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--c-primary);
  color: #fff;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ok .kv {
  color: var(--c-primary-d);
  opacity: 0.85;
  font-size: 12px;
  line-height: 2;
}
.ok .kv b {
  opacity: 1;
  font-weight: 500;
}

/* 失败卡：与成功卡同构但红色 */
.fail {
  background: var(--c-danger-s);
  border: 1px solid #f0cdc8;
  border-radius: 8px;
  padding: 13px 16px;
  margin-top: 16px;
}
.fail .h {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--c-danger);
  margin-bottom: 6px;
}
.fail .h .i {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--c-danger);
  color: #fff;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fail p {
  margin: 0;
  font-size: 12px;
  color: #8f4237;
  line-height: 1.7;
}

/* 今日待领取（照原型 .wrow） */
.wait {
  padding: 12px 20px 16px;
}
.wrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px dashed var(--c-line2);
}
.wrow:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.wrow .cd {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 1.5px;
  width: 98px;
  flex: none;
}
.wrow .nm {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wrow .nm span {
  display: block;
  font-size: 11px;
  color: var(--c-ink3);
  margin-top: 1px;
}
.wrow .lt {
  width: 106px;
  text-align: right;
  font-size: 11.5px;
  flex: none;
}
.wrow.urgent .lt {
  color: var(--c-danger);
  font-weight: 600;
}
.wrow .go {
  width: 56px;
  flex: none;
  text-align: right;
}
.wrow .go a {
  color: var(--c-primary);
  cursor: pointer;
}
.wrow .go a:hover {
  text-decoration: underline;
}
.wempty {
  padding: 30px 0 16px;
  text-align: center;
  font-size: 12.5px;
  color: var(--c-ink3);
}

/* 最近核销记录表（照原型 .rec-tb） */
.rec-tb {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12.5px;
}
.rec-tb th {
  background: #fafaf6;
  color: var(--c-ink2);
  font-weight: 500;
  text-align: left;
  padding: 9px 18px;
  border-bottom: 1px solid var(--c-line);
  font-size: 12px;
}
.rec-tb th:nth-child(1) {
  width: 96px;
}
.rec-tb th:nth-child(3) {
  width: 100px;
}
.rec-tb th:nth-child(4) {
  width: 70px;
}
.rec-tb td {
  padding: 10px 18px;
  border-bottom: 1px solid var(--c-line2);
  vertical-align: middle;
}
.rec-tb tr:last-child td {
  border-bottom: none;
}
.rec-tb td:first-child {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--c-ink2);
}
.rec-tb td:nth-child(2) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rec-tb td:nth-child(2) em {
  font-style: normal;
  color: var(--c-ink3);
  margin-left: 4px;
}
.t-empty {
  text-align: center;
  color: var(--c-ink3);
  font-size: 12.5px;
  padding: 24px 0 !important;
}

/* 四态：错误 */
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 44px 20px;
  color: var(--c-ink2);
}
.state .ico {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #f3f3ee;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #b8b8b0;
  margin-bottom: 14px;
}
.state h4 {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--c-ink);
}
.state p {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: var(--c-ink3);
}
.btn-retry {
  height: 32px;
  padding: 0 15px;
  border: none;
  border-radius: 6px;
  background: var(--c-primary);
  color: #fff;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}

/* 窄屏兜底：双栏变单列，不产生横向滚动 */
@media (max-width: 1024px) {
  .cols2 {
    flex-direction: column;
  }
  .c-left {
    width: 100%;
  }
}
</style>
