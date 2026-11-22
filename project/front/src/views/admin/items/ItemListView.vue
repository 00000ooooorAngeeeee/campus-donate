<template>
  <div class="ilist">
    <!-- 五 Tab 分组 + 角标（原型 06：按状态分组而非状态筛选，符合"处理积压"的任务模型） -->
    <div class="atabs" role="tablist">
      <button
        v-for="t in TABS"
        :key="t.status"
        class="atab"
        :class="{ on: activeTab === t.status }"
        type="button"
        role="tab"
        :aria-selected="activeTab === t.status"
        @click="switchTab(t.status)"
      >
        {{ t.label }} <span class="c">{{ counts[t.status] ?? 0 }}</span>
      </button>
    </div>

    <!-- 工具栏：搜索 / 品类 / 批量操作（批量仅对待审核有意义） -->
    <div class="toolbar">
      <el-input
        v-model="keyword"
        class="search"
        placeholder="搜索物品标题或入库编号"
        clearable
        @keyup.enter="reload"
        @clear="reload"
      />
      <el-select v-model="categoryId" class="catsel" placeholder="全部品类" clearable @change="reload">
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <div v-if="activeTab === 'PENDING'" class="right">
        <el-button size="small" :disabled="!selectedRows.length" @click="openBatchReject">批量驳回</el-button>
        <el-button size="small" type="primary" :disabled="!selectedRows.length" @click="batchApprove">批量通过</el-button>
      </div>
    </div>

    <div class="card">
      <!-- 加载失败：给出原因与重试（四态之二，不复用空态） -->
      <div v-if="error" class="state">
        <div class="ico">!</div>
        <h4>没能加载出来</h4>
        <p>{{ error }}</p>
        <el-button type="primary" @click="reload">重新加载</el-button>
      </div>

      <template v-else>
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="rows"
          row-key="id"
          class="tb"
          @selection-change="onSelectionChange"
        >
          <!-- 跨页保留勾选：reserve-selection + row-key（原型 06 交互说明第 2 条） -->
          <el-table-column v-if="showSelection" type="selection" width="40" reserve-selection />
          <el-table-column label="图片" width="64">
            <template #default="{ row }">
              <div class="thumb-s ph">
                <img v-if="row.images.length" :src="'/uploads/' + row.images[0]" alt="物品照片" loading="lazy" />
                <span v-else>暂无</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="物品 / 登记人" min-width="240">
            <template #default="{ row }">
              <div class="tb-title">{{ row.title }}</div>
              <div class="tb-sub">{{ row.donorName }} · {{ row.donorStudentNo }} · {{ row.stationName }}</div>
            </template>
          </el-table-column>
          <el-table-column v-if="activeTab !== 'RECEIVING'" label="品类" width="110">
            <template #default="{ row }">
              <span class="tag">{{ row.categoryName }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="activeTab === 'RECEIVING'" label="申报数量" width="100">
            <template #default="{ row }">{{ row.totalQty }} 件</template>
          </el-table-column>
          <el-table-column v-else label="数量" width="90">
            <template #default="{ row }">
              <div>{{ row.totalQty }} 件</div>
              <div v-if="activeTab === 'ON_SHELF'" class="tb-sub">余 {{ row.available }}</div>
            </template>
          </el-table-column>
          <el-table-column v-if="activeTab === 'RECEIVING'" label="审核通过" width="110">
            <template #default="{ row }">{{ fmt(row.approvedAt) }}</template>
          </el-table-column>
          <el-table-column v-else label="提交时间" width="110">
            <template #default="{ row }">{{ fmt(row.submittedAt) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="86">
            <template #default="{ row }">
              <span class="tag" :class="statusClass(row.status)"><span class="dot"></span>{{ ITEM_STATUS_TEXT[row.status] }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="156">
            <template #default="{ row }">
              <div class="ops">
                <template v-if="row.status === 'PENDING'">
                  <a @click="approve(row as AdminItemRow)">通过</a>
                  <a class="danger" @click="openReject(row as AdminItemRow, 'reject')">驳回</a>
                  <a @click="openDetail(row as AdminItemRow)">详情</a>
                </template>
                <template v-else-if="row.status === 'RECEIVING'">
                  <a @click="openReceive(row as AdminItemRow)">收货确认</a>
                  <a class="danger" @click="openReject(row as AdminItemRow, 'return')">退回</a>
                </template>
                <template v-else-if="row.status === 'ON_SHELF'">
                  <a class="danger" @click="offline(row as AdminItemRow)">下架</a>
                  <a @click="openDetail(row as AdminItemRow)">详情</a>
                </template>
                <template v-else>
                  <a @click="openDetail(row as AdminItemRow)">详情</a>
                </template>
              </div>
            </template>
          </el-table-column>
          <template #empty>
            <!-- 空态：说明为什么空 + 下一步（四态之三，文案区分场景） -->
            <div class="state">
              <div class="ico">□</div>
              <h4>{{ emptyCopy.title }}</h4>
              <p>{{ emptyCopy.desc }}</p>
            </div>
          </template>
        </el-table>

        <div class="pgn">
          <span class="total">共 {{ total }} 条</span>
          <el-pagination
            v-model:current-page="page"
            small
            layout="prev, pager, next"
            :total="total"
            :page-size="PAGE_SIZE"
            :pager-count="5"
          />
        </div>
      </template>
    </div>

    <!-- 选中浮动条：跨页选择提示 + 清空（原型 06 交互说明第 2 条） -->
    <div v-if="selectedRows.length && activeTab === 'PENDING'" class="selbar">
      已选 {{ selectedRows.length }} 项
      <a @click="clearSelection">清空</a>
    </div>

    <!-- 驳回 / 退回弹窗：原因必填（≥5 字），空则禁用确认 -->
    <el-dialog
      v-model="rejectDlg.visible"
      :title="rejectDlg.kind === 'reject' ? '驳回' : '退回'"
      width="472px"
      append-to-body
      :close-on-click-modal="false"
    >
      <p class="ms">
        {{ rejectDlg.kind === 'reject'
          ? '驳回后捐赠人可在「我的记录」中修改信息并重新提交'
          : '实物与申报不符时退回，捐赠人可修改后重新提交' }}
      </p>
      <div class="mrow"><span>物品</span><b>{{ rejectDlg.item?.title }}</b></div>
      <div class="mrow"><span>登记人</span><b>{{ rejectDlg.item?.donorName }} · {{ rejectDlg.item?.donorStudentNo }}</b></div>
      <div class="mfield">
        <label class="label" for="reject-reason">原因（必填）</label>
        <el-input
          id="reject-reason"
          v-model="rejectDlg.reason"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          placeholder="请填写原因，捐赠人将看到这段文字（至少 5 个字）"
        />
        <div v-if="rejectDlg.reason.trim().length > 0 && rejectDlg.reason.trim().length < 5" class="err">
          驳回原因至少 5 个字
        </div>
      </div>
      <template #footer>
        <el-button @click="rejectDlg.visible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="rejectDlg.reason.trim().length < 5"
          :loading="rejectDlg.submitting"
          @click="confirmReject"
        >
          {{ rejectDlg.kind === 'reject' ? '确认驳回' : '确认退回' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 收货确认弹窗（原型 06 第二屏）：可修正实收数量，不一致时黄色提示留痕 -->
    <el-dialog v-model="receiveDlg.visible" title="收货确认" width="472px" append-to-body :close-on-click-modal="false">
      <p class="ms">请核对实物，确认后物品将出现在「发现」页供领取</p>
      <div class="mrow"><span>物品</span><b>{{ receiveDlg.item?.title }}</b></div>
      <div class="mrow"><span>登记人</span><b>{{ receiveDlg.item?.donorName }} · {{ receiveDlg.item?.donorStudentNo }}</b></div>
      <div class="mrow"><span>申报数量</span><b>{{ receiveDlg.item?.totalQty }} 件</b></div>
      <div class="mrow"><span>送达驿站</span><b>{{ receiveDlg.item?.stationName }}</b></div>
      <div class="mfield">
        <label class="label" for="receive-qty">实收数量</label>
        <div class="qty-row">
          <el-input-number id="receive-qty" v-model="receiveDlg.actualQty" :min="1" :max="99" :step="1" step-strictly />
          <span class="dim qty-unit">件</span>
          <span v-if="receiveMismatch" class="warn-text">
            与申报数量相差 {{ Math.abs(receiveDlg.actualQty - (receiveDlg.item?.totalQty ?? 0)) }} 件
          </span>
        </div>
        <div v-if="receiveMismatch" class="warn-line">
          <b>注意：</b>实收数量与申报不一致的情况将记入流转履历，并通知捐赠人。
        </div>
      </div>
      <template #footer>
        <el-button @click="receiveDlg.visible = false">取消</el-button>
        <el-button class="confirm-in" type="primary" :loading="receiveDlg.submitting" @click="confirmReceive">确认入库</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗：只读信息，含驳回原因与入库编号 -->
    <el-dialog v-model="detailDlg.visible" title="批次详情" width="472px" append-to-body>
      <template v-if="detailDlg.visible">
        <div class="mrow"><span>物品</span><b>{{ detailDlg.item?.title }}</b></div>
        <div class="mrow"><span>状态</span><b>{{ ITEM_STATUS_TEXT[detailDlg.item!.status] }}</b></div>
        <div class="mrow"><span>品类</span><b>{{ detailDlg.item?.categoryName }}</b></div>
        <div class="mrow"><span>成色</span><b>{{ CONDITION_TEXT[detailDlg.item?.condition ?? ''] }}</b></div>
        <div class="mrow"><span>数量</span><b>{{ detailDlg.item?.totalQty }} 件<span v-if="detailDlg.item?.status === 'ON_SHELF'">（余 {{ detailDlg.item?.available }}）</span></b></div>
        <div class="mrow"><span>驿站</span><b>{{ detailDlg.item?.stationName }}</b></div>
        <div class="mrow"><span>登记人</span><b>{{ detailDlg.item?.donorName }} · {{ detailDlg.item?.donorStudentNo }}</b></div>
        <div class="mrow"><span>提交时间</span><b>{{ fmtFull(detailDlg.item?.submittedAt) }}</b></div>
        <div v-if="detailDlg.item?.code" class="mrow"><span>入库编号</span><b>{{ detailDlg.item?.code }}</b></div>
        <div v-if="detailDlg.item?.shelfAt" class="mrow"><span>上架时间</span><b>{{ fmtFull(detailDlg.item?.shelfAt) }}</b></div>
        <div v-if="detailDlg.item?.rejectReason" class="mrow"><span>驳回原因</span><b class="danger-text">{{ detailDlg.item?.rejectReason }}</b></div>
        <div class="desc-block">
          <span>物品描述</span>
          <p>{{ detailDlg.item?.description }}</p>
        </div>
      </template>
    </el-dialog>

    <!-- 批量驳回弹窗：统一原因 -->
    <el-dialog v-model="batchRejectDlg.visible" title="批量驳回" width="472px" append-to-body :close-on-click-modal="false">
      <p class="ms">将对选中的 {{ selectedRows.length }} 个批次使用同一原因驳回</p>
      <div class="mfield">
        <label class="label" for="batch-reject-reason">原因（必填）</label>
        <el-input
          id="batch-reject-reason"
          v-model="batchRejectDlg.reason"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          placeholder="请填写统一原因（至少 5 个字）"
        />
        <div v-if="batchRejectDlg.reason.trim().length > 0 && batchRejectDlg.reason.trim().length < 5" class="err">
          驳回原因至少 5 个字
        </div>
      </div>
      <template #footer>
        <el-button @click="batchRejectDlg.visible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="batchRejectDlg.reason.trim().length < 5"
          :loading="batchRejectDlg.submitting"
          @click="confirmBatchReject"
        >
          确认驳回 {{ selectedRows.length }} 项
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import {
  ElButton,
  ElDialog,
  ElInput,
  ElInputNumber,
  ElLoadingDirective,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  type TableInstance,
} from 'element-plus'
import { fetchAdminItems, approveItem, rejectItem, receiveItem, offlineItem } from '@/api/admin'
import { BizError, CONDITION_TEXT, ITEM_STATUS_TEXT, type AdminItemRow } from '@/types'

// script setup 约定：v 开头的局部变量会被识别为模板指令
const vLoading = ElLoadingDirective

const PAGE_SIZE = 10

// Tab 顺序与原型 06 一致；数量为 0 的组仍可进入（灰色由 CSS 角标表达）
const TABS: { status: string; label: string; empty: { title: string; desc: string } }[] = [
  { status: 'PENDING', label: '待审核', empty: { title: '当前没有待审核的批次', desc: '新的捐赠提交后会出现在这里' } },
  { status: 'RECEIVING', label: '待收货', empty: { title: '没有待收货的批次', desc: '审核通过后，等待实物送达驿站' } },
  { status: 'ON_SHELF', label: '在架', empty: { title: '没有在架批次', desc: '收货确认后的批次会在这里上架供领取' } },
  { status: 'REJECTED', label: '已驳回', empty: { title: '没有已驳回的批次', desc: '驳回后等待捐赠人修改重提' } },
  { status: 'OFFLINE', label: '已下架', empty: { title: '没有已下架的批次', desc: '滞销或不宜继续展示的批次会归档在这里' } },
]

const activeTab = ref('PENDING')
const keyword = ref('')
const categoryId = ref<number | ''>('')
const page = ref(1)
const rows = ref<AdminItemRow[]>([])
const total = ref(0)
const counts = ref<Record<string, number>>({})
const categories = ref<{ id: number; name: string }[]>([])
const loading = ref(false)
const error = ref('')
const selectedRows = ref<AdminItemRow[]>([])
const tableRef = ref<TableInstance>()

let fetchSeq = 0
let keywordTimer: ReturnType<typeof setTimeout> | null = null

const showSelection = computed(() => activeTab.value === 'PENDING' || activeTab.value === 'RECEIVING')
const emptyCopy = computed(() => TABS.find((t) => t.status === activeTab.value)?.empty ?? { title: '', desc: '' })
const receiveMismatch = computed(
  () => receiveDlg.item != null && receiveDlg.actualQty !== receiveDlg.item.totalQty,
)

const rejectDlg = reactive({
  visible: false,
  kind: 'reject' as 'reject' | 'return',
  item: null as AdminItemRow | null,
  reason: '',
  submitting: false,
})
const receiveDlg = reactive({
  visible: false,
  item: null as AdminItemRow | null,
  actualQty: 1,
  submitting: false,
})
const detailDlg = reactive({ visible: false, item: null as AdminItemRow | null })
const batchRejectDlg = reactive({ visible: false, reason: '', submitting: false })

// ---- 数据加载 ----

async function fetchList(): Promise<void> {
  loading.value = true
  error.value = ''
  const seq = ++fetchSeq
  try {
    const data = await fetchAdminItems({
      status: activeTab.value,
      keyword: keyword.value.trim() || undefined,
      categoryId: categoryId.value || undefined,
      page: page.value,
      size: PAGE_SIZE,
    })
    if (seq !== fetchSeq) return // 丢弃过期响应，避免快速切换筛选时的竞态
    rows.value = data.list
    total.value = data.total
    counts.value = data.counts
    categories.value = data.categories
  } catch (e) {
    if (seq !== fetchSeq) return
    error.value = e instanceof BizError ? e.message : '网络连接不太稳定，请检查后重试'
  } finally {
    if (seq === fetchSeq) loading.value = false
  }
}

function reload(): void {
  page.value = 1
  fetchList()
}

function switchTab(status: string): void {
  if (activeTab.value === status) return
  activeTab.value = status
  clearSelection()
  page.value = 1
  fetchList()
}

watch(categoryId, () => {
  page.value = 1
  fetchList()
})
watch(page, () => fetchList())
// 搜索防抖 400ms：输入停顿后再请求
watch(keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    page.value = 1
    fetchList()
  }, 400)
})
onBeforeUnmount(() => {
  if (keywordTimer) clearTimeout(keywordTimer)
})

// ---- 选择 ----

function onSelectionChange(sel: AdminItemRow[]): void {
  selectedRows.value = sel
}

function clearSelection(): void {
  selectedRows.value = []
  nextTick(() => tableRef.value?.clearSelection())
}

// ---- 单条操作 ----

async function approve(row: AdminItemRow): Promise<void> {
  try {
    await approveItem(row.id)
    ElMessage.success('已通过审核，等待实物送达驿站')
    clearSelection()
    fetchList()
  } catch (e) {
    showErr(e)
  }
}

function openReject(row: AdminItemRow, kind: 'reject' | 'return'): void {
  rejectDlg.kind = kind
  rejectDlg.item = row
  rejectDlg.reason = ''
  rejectDlg.visible = true
}

async function confirmReject(): Promise<void> {
  if (!rejectDlg.item) return
  rejectDlg.submitting = true
  try {
    await rejectItem(rejectDlg.item.id, rejectDlg.reason.trim())
    ElMessage.success(rejectDlg.kind === 'reject' ? '已驳回，等待捐赠人修改重提' : '已退回，等待捐赠人处理')
    rejectDlg.visible = false
    clearSelection()
    fetchList()
  } catch (e) {
    showErr(e)
  } finally {
    rejectDlg.submitting = false
  }
}

function openReceive(row: AdminItemRow): void {
  receiveDlg.item = row
  receiveDlg.actualQty = row.totalQty
  receiveDlg.visible = true
}

async function confirmReceive(): Promise<void> {
  if (!receiveDlg.item) return
  receiveDlg.submitting = true
  try {
    const res = await receiveItem(receiveDlg.item.id, receiveDlg.actualQty)
    ElMessage.success(`已入库，入库编号 ${res.code}${res.adjusted ? `（申报 ${receiveDlg.item.totalQty} 件，实收 ${res.totalQty} 件，已记入履历）` : ''}`)
    receiveDlg.visible = false
    fetchList()
  } catch (e) {
    showErr(e)
  } finally {
    receiveDlg.submitting = false
  }
}

async function offline(row: AdminItemRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认下架「${row.title}」？下架后将不再公开展示。`, '下架确认', {
      confirmButtonText: '确认下架',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }
  try {
    await offlineItem(row.id)
    ElMessage.success('已下架')
    fetchList()
  } catch (e) {
    // 3006：有未领取预约 → 弹窗说明数量与出路，不是冷冰冰的"操作失败"
    if (e instanceof BizError) {
      ElMessageBox.alert(e.message, '无法下架', { confirmButtonText: '知道了', type: 'warning' })
    } else {
      showErr(e)
    }
  }
}

function openDetail(row: AdminItemRow): void {
  detailDlg.item = row
  detailDlg.visible = true
}

// ---- 批量操作 ----

async function batchApprove(): Promise<void> {
  const n = selectedRows.value.length
  if (!n) return
  try {
    await ElMessageBox.confirm(`确认通过选中的 ${n} 个批次？`, '批量通过', {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  const results = await Promise.allSettled(selectedRows.value.map((r) => approveItem(r.id)))
  reportBatch(results, '通过')
}

function openBatchReject(): void {
  if (!selectedRows.value.length) return
  batchRejectDlg.reason = ''
  batchRejectDlg.visible = true
}

async function confirmBatchReject(): Promise<void> {
  batchRejectDlg.submitting = true
  const reason = batchRejectDlg.reason.trim()
  const results = await Promise.allSettled(selectedRows.value.map((r) => rejectItem(r.id, reason)))
  batchRejectDlg.submitting = false
  if (results.some((r) => r.status === 'fulfilled')) batchRejectDlg.visible = false
  reportBatch(results, '驳回')
}

function reportBatch(results: PromiseSettledResult<unknown>[], action: string): void {
  const ok = results.filter((r) => r.status === 'fulfilled').length
  const fail = results.length - ok
  if (fail === 0) {
    ElMessage.success(`已${action} ${ok} 个批次`)
  } else {
    ElMessage.warning(`${action}完成：成功 ${ok} 条，失败 ${fail} 条（可能与他人操作冲突，列表已刷新）`)
  }
  clearSelection()
  fetchList()
}

// ---- 杂项 ----

function showErr(e: unknown): void {
  ElMessage.error(e instanceof BizError ? e.message : '操作失败，请稍后重试')
}

function fmt(d: string | null): string {
  return d ? dayjs(d).format('MM-DD HH:mm') : '-'
}

function fmtFull(d: string | null | undefined): string {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
}

function statusClass(status: string): string {
  if (status === 'ON_SHELF') return 'green'
  if (status === 'RECEIVING') return 'blue'
  if (status === 'REJECTED') return 'red'
  return 'grey'
}

fetchList()
</script>

<style scoped>
/* 视觉照原型 06：胶囊 Tab / 工具栏 / 卡片表格 / 弹窗 mrow 行 */
.ilist {
  max-width: 1080px;
}
.atabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.atab {
  height: 32px;
  padding: 0 15px;
  border: 1px solid var(--c-line);
  border-radius: 6px;
  background: #fff;
  display: flex;
  align-items: center;
  font-size: 12.5px;
  color: var(--c-ink2);
  gap: 7px;
  cursor: pointer;
  font-family: inherit;
}
.atab.on {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
  font-weight: 500;
}
.atab .c {
  font-size: 11px;
  padding: 0 5px;
  height: 16px;
  line-height: 16px;
  border-radius: 8px;
  background: #f0f0ea;
  color: var(--c-ink2);
}
.atab.on .c {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.toolbar .search {
  width: 240px;
}
.toolbar .catsel {
  width: 150px;
}
.toolbar .right {
  margin-left: auto;
  display: flex;
  gap: 10px;
}
.card {
  background: #fff;
  border: 1px solid var(--c-line);
  border-radius: 8px;
  overflow: hidden;
}

/* Element Plus 表格贴合原型 .tb 的视觉 */
.tb :deep(.el-table__header) th {
  background: #fafaf6;
  color: var(--c-ink2);
  font-weight: 500;
  font-size: 12px;
}
.tb :deep(.el-table__row) td {
  border-bottom: 1px solid var(--c-line2);
  font-size: 12.5px;
  padding: 9px 0;
}
.tb :deep(.el-table__body) tr:last-child td {
  border-bottom: none;
}
.tb :deep(.el-table__inner-wrapper)::before {
  display: none;
}

.thumb-s {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  background: #f1f1ec;
  border: 1px solid #e3e3dc;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b4b4ac;
  font-size: 10px;
}
.thumb-s img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tb-title {
  font-size: 12.5px;
  font-weight: 500;
  margin-bottom: 3px;
  color: var(--c-ink);
}
.tb-sub {
  font-size: 11px;
  color: var(--c-ink3);
}
.ops {
  display: flex;
  gap: 10px;
  font-size: 12px;
}
.ops a {
  color: var(--c-primary);
  cursor: pointer;
  white-space: nowrap;
}
.ops a:hover {
  text-decoration: underline;
}
.ops a.danger {
  color: var(--c-danger);
}

.tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 3px;
  font-size: 11px;
  background: #f3f3ee;
  color: var(--c-ink2);
  border: 1px solid #e7e7e0;
  white-space: nowrap;
}
.tag .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  margin-right: 4px;
}
.tag.green {
  background: var(--c-primary-s);
  color: var(--c-primary-d);
  border-color: #cfe4d6;
}
.tag.blue {
  background: #eef4fa;
  color: #265f8e;
  border-color: #d3e3f1;
}
.tag.red {
  background: var(--c-danger-s);
  color: var(--c-danger);
  border-color: #f0cdc8;
}
.tag.grey {
  background: #f2f2ed;
  color: var(--c-ink3);
  border-color: #e6e6df;
}

.pgn {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 18px;
  font-size: 12.5px;
  color: var(--c-ink2);
}

/* 选中浮动条 */
.selbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #2e2e2b;
  color: #fff;
  border-radius: 999px;
  padding: 8px 18px;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  z-index: 10;
}
.selbar a {
  color: #fff;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* 四态：错误与空态（照原型 09 的 .state 结构） */
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
  max-width: 340px;
}

/* 弹窗内容（照原型 06 的 .modal 排版） */
.ms {
  font-size: 12px;
  color: var(--c-ink3);
  margin: 0 0 18px;
}
.mrow {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--c-line2);
  font-size: 12.5px;
}
.mrow span {
  color: var(--c-ink3);
  flex: none;
}
.mrow b {
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}
.mfield {
  margin: 18px 0 0;
}
.label {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  color: var(--c-ink2);
}
.err {
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--c-danger);
}
.qty-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.qty-unit {
  font-size: 12px;
}
.warn-text {
  font-size: 12px;
  color: var(--c-warn);
}
.warn-line {
  margin-top: 10px;
  background: var(--c-warn-s);
  border: 1px solid #f0dcb4;
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 11.5px;
  color: #8a5e12;
}
.warn-line b {
  font-weight: 600;
}
.confirm-in {
  min-width: 110px;
}
.desc-block {
  margin: 12px 0 0;
  font-size: 12.5px;
}
.desc-block span {
  color: var(--c-ink3);
  display: block;
  margin-bottom: 4px;
}
.desc-block p {
  margin: 0;
  line-height: 1.7;
  color: var(--c-ink2);
  background: #fafaf6;
  border: 1px solid var(--c-line2);
  border-radius: 6px;
  padding: 10px 12px;
}
.danger-text {
  color: var(--c-danger);
}
</style>
