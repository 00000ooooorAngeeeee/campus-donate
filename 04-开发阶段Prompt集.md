# 后续开发阶段 Prompt 集

> 对应《Web前端开发技术与UI设计》选题与实施指南「六、推荐开发流程」
> 覆盖阶段 3（核心功能开发）、阶段 4（体验与工程完善）、阶段 5（演示与总结）
> 配套文档：《01-项目需求说明书》《02-数据结构与系统架构说明》《03-三人分工与贡献说明》
> 原型基准：`prototype/` 下 10 个 HTML

---

## 一、怎么用这批 Prompt

| 规则 | 说明 |
| --- | --- |
| 一次只跑一个 | 一个 Prompt 就是一个可验收的小闭环。合并执行看似快，出错时无法定位是哪一步坏的 |
| 先贴上下文块 | 每个 Prompt 前面都要粘贴 §2 的「通用上下文块」，Agent 不会自己记住上一次会话 |
| 让它读文件 | Prompt 里的【先读】列了必读文件。**不要让 Agent 凭记忆猜字段名**，字段错一个就全盘返工 |
| 跑完必须自查 | 每个 Prompt 都带统一的自查回复格式（见 §2.3），不按格式回复就不要 commit |
| 小步提交 | 一个 Prompt 一次 commit，commit message 按 `feat(scope): 描述` |
| 卡住就退回 | 如果 Agent 改动了「不要碰」的目录，直接 `git checkout` 回滚，换更小的 Prompt 重来 |

### 1.1 三人并行时的文件边界

这是最容易出事的地方。三个人同时让 Agent 改同一个文件，必然冲突。

| 归属 | 独占目录 / 文件 | 说明 |
| --- | --- | --- |
| **A** | `project/backend/prisma/**`、`project/backend/src/lib/**`、`project/backend/src/middleware/**`、`project/backend/src/routes/admin.ts`、`project/backend/src/routes/reservations.ts`、`project/front/src/views/admin/items/`、`project/front/src/views/admin/redeem/` | schema 唯一修改人，其他人只能读 |
| **B** | `project/front/src/views/discover/`、`item-detail/`、`donate/`、`my-records/`、`project/front/src/components/**`、`project/front/src/styles/**`、`project/backend/src/routes/items.ts`、`project/backend/src/routes/my.ts` | 组件与样式归 B，A/C 复用但不要改 |
| **C** | `project/front/src/views/admin/dashboard/`、`project/front/src/views/login/`、`project/front/src/api/auth.ts`、`project/backend/src/routes/auth.ts`、`project/backend/src/routes/stats.ts`、`docs/**` | 文档与看板归 C |
| 共用只读 | `project/backend/src/index.ts`、`project/front/src/router/**`、`project/front/src/api/http.ts`、`project/front/src/stores/**` | 需要改动时先在群里说一声，由 A 统一改 |

---

## 二、通用上下文块

### 2.1 上下文块正文

每个 Prompt 前面都粘这一段（可直接复制）：

```
【项目】校园旧物捐赠平台「拾光」，Vue3 + Express + Prisma + SQLite 的前后端分离项目。
本科课程作业，3 人 3 周，只求可演示的完整闭环，不追求大而全。

【技术栈】
前端：Vue 3.4 + TypeScript(strict) + Vite 5 + Vue Router 4 + Pinia + axios + zod + dayjs
后台 UI：Element Plus（仅 /admin 路由下使用）
用户端 UI：手写 CSS + 设计 token，不使用组件库
图表：ECharts 5
后端：Node 20 + Express 4 + Prisma 6 + SQLite，JWT 单 token，bcryptjs，multer
包管理：npm

【硬性约束，违反即返工】
1. 薄后端：接口总数不超过 20 个，路由处理函数内直接调用 Prisma，
   不写 Controller/Service/Repository 分层，不写后端单元测试。
2. 余量不落库：Item 只存 totalQty / reservedQty / collectedQty 三个事实字段，
   可用量一律在查询时派生：totalQty - reservedQty - collectedQty。
3. 占用必须用条件更新，禁止"先查再改"：
   UPDATE Item SET reservedQty = reservedQty + ? 
   WHERE id = ? AND (totalQty - reservedQty - collectedQty) >= ? AND status = 'ON_SHELF'
   影响行数为 1 才算成功，否则返回错误码 3001。
4. 状态只能由后端校验变更，前端按钮显隐不算权限。
5. 所有列表页必须处理四态：加载中(骨架屏) / 加载失败(带重试) / 无数据(带引导) / 无权限。
6. 类型定义前后端共享，放在 project/front/src/types/ 与 project/backend/src/lib/schema.ts，用 zod 定义后导出 z.infer。
7. 注释用中文，写"为什么"不写"是什么"。

【业务规则】
- 双轨状态机：批次 PENDING→RECEIVING→ON_SHELF→(OFFLINE|CLOSED)，驳回走 REJECTED 可重提；
  预约 PENDING→(COLLECTED|CANCELLED|EXPIRED)
- 审核通过 ≠ 入库：必须经「收货确认」后批次才可上架，收货时可修正实际数量并记入履历
- 预约有效期 3 天（expireAt），超时惰性回收：在读取列表/详情/核销前扫描一次
- 同一学生最多同时持有 2 个未领取预约单（按单计数，不按件计）
- 核销为整单核销，不做部分核销
- 存在未领取预约时禁止下架批次

【错误码】
0 成功｜1001 参数校验失败｜1002 未登录｜1003 无权限｜2001 资源不存在
3001 余量不足｜3002 状态不允许｜3003 预约已超时｜3004 重复核销
3005 超出未领取上限｜3006 存在未核销预约禁止下架｜4001 文件不合法｜5000 服务端异常
统一响应：{ code, message, data }，message 为可直接展示给用户的中文文案。

【不要做】
- 不要引入上下文未提到的新依赖，需要时先问我
- 不要改动 project/backend/prisma/schema.prisma（除非当前任务明确要求）
- 不要"顺便重构"已经能跑的代码
- 不要生成 README、变更说明、示例配置等我没要求的文件
```

### 2.2 每个 Prompt 的结构

```
【先读】必读文件，按顺序
【任务】编号列出的具体动作
【必须做到】可验证的硬要求
【验收】我怎么判断你做完了
【不要做】本次任务的禁区
```

### 2.3 统一的自查回复格式

每个 Prompt 结尾都附这句，让 Agent 按格式交作业：

```
完成后按以下格式回复，不要写额外的客套话：
1. 改动文件清单（路径 + 一句话说明改了什么）
2. 逐条对照【验收】，写出自测结果（通过/不通过 + 依据）
3. 未完成项与原因
4. 你认为我接下来该跑的下一步（一行）
```

---

## 三、阶段 3：核心功能开发（W0—W2）

> 指南原文：「优先完成一个完整闭环」。我们的闭环是
> **提交登记 → 审核 → 收货入库 → 浏览 → 预约 → 核销 → 记录**。
> 阶段 3 的所有 Prompt 围绕这条链，先打通再补分支。

### 3.1 Prompt 索引

| 编号 | 任务 | 归属 | 依赖 | 预计 |
| --- | --- | --- | --- | --- |
| S3-01 | 数据库 schema + 种子数据 | A | — | 1.5 天 |
| S3-02 | 后端骨架：中间件、统一响应、JWT | A | S3-01 | 1 天 |
| S3-03 | 前端骨架：路由、守卫、axios、四态组件、设计 token | B | — | 2 天 |
| S3-04 | 登录（接口 + 页面） | C | S3-02、S3-03 | 1 天 |
| S3-05 | 发现页（列表接口 + 页面 + 筛选） | B | S3-03 | 3 天 |
| S3-06 | 预约内核（占用 / 取消 / 超时回收） | A | S3-02 | 2 天 |
| S3-07 | 详情页（含履历时间轴） | B | S3-05、S3-06 | 2.5 天 |
| S3-08 | 捐赠登记（接口 + 页面 + 图片压缩） | B | S3-03 | 2.5 天 |
| S3-09 | 审核 / 收货 + 物品管理页 | A | S3-02 | 3 天 |
| S3-10 | 核销内核 + 核销台 | A | S3-06 | 2 天 |
| S3-11 | 我的记录（我捐的 / 我领的） | B | S3-06、S3-08 | 2 天 |
| S3-12 | 统计看板（聚合接口 + 页面） | C | S3-09 | 3 天 |

**串行关键路径**：S3-01 → S3-02 → S3-06 → S3-10。这条链打通，闭环就能演示。

---

### S3-01　数据库 schema 与种子数据（A）

```
【先读】
docs/02-数据结构与系统架构说明.md 第 2 章（表定义、取值约定、索引）
docs/01-项目需求说明书.md 第 4.5 节（业务规则 BR-01~12）

【任务】
1. 在 project/backend/prisma/schema.prisma 中定义 7 个模型：
   User / Category / Station / Item / Reservation / ItemLog / SystemConfig，
   字段名、类型、默认值与架构文档 2.2 完全一致，不要自己改名或增删字段。
2. 定义 5 组取值约定（String 字段 + 常量数组，SQLite 不支持 enum）：
   role / condition / Item.status / Reservation.status / ItemLog.scope，取值见架构文档 2.3。
3. 按架构文档 2.4 建索引（Prisma 用 @@index）。
4. 生成并执行首次迁移，确认 dev.db 创建成功。
5. 写 project/backend/prisma/seed.ts，要求幂等：重复执行两次，数据量不翻倍。
6. 种子内容：
   - 2 个管理员（admin / admin02，密码 admin123）
   - 10 个学生（学号 2022010101 起，密码 123456，其中 1 个无任何记录用于演示空态）
   - 6 个品类，带 weightPerUnitKg 与 co2FactorPerKg（取需求说明书附录 10 的系数表）
   - 2 个驿站（一食堂西侧、三号宿舍楼下），含 openHours
   - 80 个 Item，状态分布：待审核 5 / 已驳回 3 / 待收货 4 / 在架 60 / 已下架 5 / 已完结 3
   - 约 30 条 Reservation，必须包含：5 条已核销、3 条已超时（expireAt 已过）、
     2 条即将到期（24 小时内）、其余待领取；且同一学生不超过 2 条未领取
   - 每个 Item 至少有 1 条 ItemLog，已完结的要有完整链路日志
7. package.json 增加 script：db:push / db:seed / db:reset（reset 需 db push --force-reset 后再 seed）。

【必须做到】
- 在架的批次，其 totalQty = reservedQty + collectedQty + 剩余可领量，三者自洽
- 已完结批次的 collectedQty === totalQty
- 密码统一用 bcryptjs hash，不出现明文

【验收】
- npx prisma migrate dev 无报错，Prisma Studio 能打开
- 连续执行 npm run db:seed 两次，Item 数量仍为 80
- 随机抽 1 个在架批次，其三个数量字段之和等于 totalQty
- 存在至少 1 条 expireAt < now 且 status = PENDING 的预约（用于演示超时回收）

【不要做】
- 不要写任何业务逻辑或接口
- 不要加架构文档里没有的表或字段
- 不要用字符串拼接 SQL
```

---

### S3-02　后端骨架：中间件与统一响应（A）

```
【先读】docs/02-数据结构与系统架构说明.md 第 1.4、6.2、7 章

【任务】
1. project/backend/src/lib/response.ts：封装 ok(data) 与 fail(code, message)，统一 { code, message, data }。
2. project/backend/src/lib/errors.ts：定义 BizError 类（携带 code + message）。
3. project/backend/src/lib/prisma.ts：导出单例 PrismaClient。
4. project/backend/src/lib/jwt.ts：签发与校验，payload 含 { id, role }，有效期 7 天。
5. project/backend/src/middleware/auth.ts：解析 Bearer token，挂到 req.user；失败抛 1002。
6. project/backend/src/middleware/role.ts：高阶函数 requireRole('ADMIN')，失败抛 1003。
7. project/backend/src/middleware/validate.ts：接收 zod schema，校验 body/query，失败抛 1001
   并把第一个字段错误拼进 message（例如"标题至少 4 个字"）。
8. project/backend/src/middleware/errorHandler.ts：兜底捕获，BizError 按其 code 返回，
   其他异常统一 5000 并 console.error 原始堆栈，不返回给前端。
9. project/backend/src/index.ts：装配 express.json、cookie、静态托管 uploads/、
   各路由前缀、404 处理、errorHandler；端口读 .env 的 PORT（默认 3001）。
10. 建 .env.example，含 PORT / DATABASE_URL / JWT_SECRET 三项说明。

【必须做到】
- 所有响应都经过 ok/fail，不出现裸 res.json({...})
- errorHandler 必须放在最后注册，且是 4 参数函数
- 401 与 403 要区分：未登录 1002，已登录但角色不够 1003

【验收】
- 请求不存在的接口返回 { code: 404, message: '接口不存在' } 而非 HTML
- 带无效 token 请求受保护接口返回 1002
- 故意抛一个普通 Error，返回 5000 且服务端日志有完整堆栈

【不要做】
- 不要实现任何业务路由（留给后续 Prompt）
- 不要引入 express-validator / passport 等替代方案
```

---

### S3-03　前端骨架：路由、守卫、axios、四态组件、设计 token（B）

```
【先读】
docs/02-数据结构与系统架构说明.md 第 6 章
prototype/02-发现.html（看顶栏与卡片结构）
prototype/09-状态与异常.html（看四态的设计意图）

【任务】
1. Vite 初始化 project/front/，开 TypeScript strict，配 @ 别名指向 src。
2. project/front/src/styles/tokens.css：落地架构文档 6.4 的设计 token（颜色/字阶/间距/圆角/阴影/动效），
   全部用 CSS 变量，命名用 --c- / --fs- / --sp- / --r- / --sh- / --dur- 前缀。
3. project/front/src/styles/base.css：reset、字体栈、正文行高、focus-visible 样式（可见的 2px 主色描边）。
4. project/front/src/api/http.ts：axios 实例，baseURL /api，超时 10s；
   请求拦截带 token，响应拦截解包 data、把非 0 code 转成 BizError、401 清 token 并跳登录。
5. project/front/src/router/index.ts：定义 10 条路由（7 个核心页 + 登录 + 403 + 404），
   全部懒加载，后台路由加 meta.requiresRole = 'ADMIN'。
6. project/front/src/router/guards.ts：全局前置守卫，未登录跳 /login?redirect=，角色不符跳 /403。
7. project/front/src/stores/user.ts：token、userInfo、login()、logout()、isAdmin。
8. project/front/src/stores/dict.ts：categories 与 stations，带 1 小时内存缓存。
9. project/front/src/composables/useRequest.ts：返回 { data, loading, error, refresh }，
   统一 try/catch，不吞错误但要转成可展示文案。
10. project/front/src/components/base/AsyncState.vue：props 为 loading / error / empty，
    四个插槽或内置态：骨架屏、错误态(带重试按钮)、空态(带引导按钮)、默认内容。
11. project/front/src/components/base/ 下补 EmptyState.vue、ErrorState.vue、SkeletonCard.vue、
    AppButton.vue、AppTag.vue。
12. 三个布局壳：SiteHeader.vue（用户端顶栏）、AdminSidebar.vue（后台侧栏）、PageContainer.vue。

【必须做到】
- AsyncState 的骨架屏尺寸与真实内容一致，加载完成不产生布局跳动
- 用户端不引入 Element Plus；后台可以
- 所有基础组件不引 store、不发请求（保持纯展示）

【验收】
- 访问 /admin/items 未登录 → 跳 /login；以学生身份登录后访问 → 跳 /403 页
- 断网时任意页面通过 AsyncState 展示错误态，重试按钮可再次请求
- tokens.css 里的颜色在页面中被引用，不存在硬编码色值（grep 检查 #2F7D4F 应只在 tokens.css 出现）

【不要做】
- 不要实现具体业务页面内容（只出空壳 + 一个标题占位）
- 不要在组件里写内联样式覆盖 token
```

---

### S3-04　登录（C）

```
【先读】prototype/01-登录.html、docs/01-项目需求说明书.md F 章节前的 §1.3

【任务】
1. project/backend/src/routes/auth.ts：
   - POST /api/auth/login：zod 校验 studentNo + password，查 User，bcrypt 比对，
     成功返回 { token, user: { id, name, role, studentNo } }；
     失败统一返回 1002 且 message 为「学号或密码错误」（不区分账号是否存在）。
   - GET /api/auth/me：需登录，返回当前用户。
   - POST /api/auth/logout：记一条日志即可，返回 ok。
2. project/front/src/views/login/LoginView.vue：按原型实现左右分栏——
   左侧品牌区（logo、主标题、三条卖点、插画占位），右侧表单（学号、密码、登录按钮、演示账号卡）。
3. 表单用 zod 做前端校验，错误定位到字段下方，输入框转红。
4. 登录成功后按 role 分流：STUDENT → /discover，ADMIN → /admin/items；
   若 URL 带 redirect 参数，优先回跳该地址。
5. 登录按钮 loading 期间禁用，防止重复提交。
6. 演示账号区点击某个账号自动填充表单（仅开发环境显示，用 import.meta.env.DEV 控制）。

【必须做到】
- 错误文案不泄露账号是否存在
- 登录失败时清空密码框并把焦点移回密码输入
- token 存 localStorage，key 为 shiguang_token

【验收】
- 错误密码 → 密码框下方出现红色「学号或密码错误」，页面不刷新
- 管理员登录 → 落在 /admin/items；学生登录 → 落在 /discover
- 未登录访问 /my/records 被拦 → 登录后回到 /my/records

【不要做】
- 不要做注册入口
- 不要做"记住我"与 refresh token（需求文档 §3.2 已明确不做）
```

---

### S3-05　发现页：列表接口 + 页面（B）

```
【先读】
prototype/02-发现.html（页面结构与卡片信息层次）
docs/02-数据结构与系统架构说明.md 3.1 接口表第 6 条

【任务】
1. project/backend/src/routes/items.ts 增加 GET /api/items：
   查询参数 categoryId / stationId / condition(可多值) / keyword / onlyAvailable / page / size；
   只返回 status = ON_SHELF 的批次；返回时计算 available；
   关键词匹配 title 与 description；按 submittedAt 倒序；
   返回 { list, total, page, size }，list 项含 id/title/categoryName/condition/images/available/totalQty/stationName。
2. project/front/src/views/discover/DiscoverView.vue：
   - 运营位：本季主题、累计流转件数、累计减碳、离校倒计时（倒计时天数读一个常量配置即可）
   - 筛选区：品类胶囊单选、驿站下拉、成色多选胶囊、"仅看有货"开关、搜索框
   - 结果头：共 N 件 + 排序（最新入库 / 余量从多到少 / 减碳量）
   - 卡片网格：桌面 4 列，卡片含图片占位、标题两行截断、品类与成色标签、余量、驿站名
   - 余量 ≤1 时数字转暖橙色；余量为 0 时整卡降饱和并显示"已约满"
   - 底部"加载更多"，每页 12 条，加载完变"已经到底了"并禁用
3. 筛选条件同步到 URL query，刷新后保持。
4. 用 AsyncState 包住列表区，切换筛选时进入骨架屏。
5. 卡片点击跳 /items/:id。

【必须做到】
- 只查在架批次，待审核/已驳回/已下架的不得出现
- 切换筛选不出现空白闪烁，只有骨架屏
- 空结果时展示"清除筛选"与"看看全部"两个动作
- 图片用统一占位块（不引外网图）

【验收】
- 选"教材书籍"后 URL 带 categoryId，刷新后筛选仍生效
- 搜索一个不存在的词 → 空态 + 两个引导按钮
- 把某批次改成 PENDING 后刷新，发现页不再显示它
- 窄到 768px 时网格降为 2 列且无横向滚动

【不要做】
- 不要做服务端分页之外的无限滚动
- 不要在卡片上放"预约"按钮（预约在详情页，避免误触）
```

---

### S3-06　预约内核：占用、取消、超时回收（A）

```
【先读】
docs/02-数据结构与系统架构说明.md 4.2、4.3、5 章
docs/01-项目需求说明书.md F4、§4.4 异常流程

【任务】
1. project/backend/src/routes/reservations.ts：
   - POST /api/items/:id/reservations
     · 校验 qty 为 1..可用量 的正整数
     · 校验该用户未领取预约单数 < 2，否则 3005
     · 校验批次 status = ON_SHELF，否则 3002
     · 在单事务内执行条件更新（见通用上下文第 3 条），影响行数 0 则 3001
     · 生成 8 位领取码（大写字母+数字，剔除 O/0/I/1），保证唯一
     · expireAt = now + 3 天
     · 创建 Reservation、写 ItemLog(scope=RESERVATION, action=RESERVE)，提交事务
     · 返回 { reservationId, code, qty, expireAt, available }
   - POST /api/reservations/:id/cancel
     · 仅本人可操作；状态必须为 PENDING，否则 3002
     · 事务内 reservedQty -= qty，Reservation 置 CANCELLED，写日志
2. project/backend/src/lib/expire.ts：export async function sweepExpired(scope) 
   支持 'user' | 'item' | 'all' 三种范围；
   逻辑：把 now > expireAt 且 status=PENDING 的预约置 EXPIRED，
   同时归还 reservedQty，并写 ItemLog(action=EXPIRE)。
3. 在 GET 我的预约列表、GET 物品详情、核销前 三处调用 sweepExpired。
4. 把 3 天与上限 2 抽到 SystemConfig 读取，带默认值兜底。

【必须做到】
- 占用必须是原子条件更新，不允许出现"先 select 再 update"
- 事务失败要整体回滚，不能出现更新了数量但没建预约
- 超时回收只影响 reservedQty，不改批次状态

【验收】
- 用两个终端同时对余量 1 的批次发预约请求：一个 200，一个 3001
- 已有 2 个未领取预约时再预约 → 3005
- 把某条预约的 expireAt 改成昨天，再请求详情 → 该预约变 EXPIRED 且余量 +1
- 取消后余量恢复，且 ItemLog 有 CANCEL 记录

【不要做】
- 不要写定时任务或 cron（需求已定惰性判定）
- 不要支持部分取消（整单取消）
```

---

### S3-07　详情页与流转履历（B）

```
【先读】
prototype/03-物品详情与预约.html
docs/02-数据结构与系统架构说明.md 3.1 第 7 条

【任务】
1. project/backend/src/routes/items.ts 增加 GET /api/items/:id：
   返回批次详情 + available + 驿站信息 + 按时间升序的履历数组。
   履历每项含 { action, actionLabel, qty, createdAt, operatorRole, operatorName }；
   **学生视角下 operatorName 一律替换为「某同学」或「驿站管理员」**，不返回学号。
2. project/front/src/views/item-detail/DetailView.vue：按原型实现
   - 左侧图片轮播（主图 + 缩略图，点击切换，用占位块）
   - 右侧标题、标签行（品类/成色/在架状态/减碳估算）、余量三段进度条、
     驿站卡片（名称+地址+营业时间+领取方式）、数量步进器、立即预约按钮
   - 余量区间下方标注三条限制：最多可选 N 件 / 3 天内领取 / 最多同时 2 个预约
   - 下方左：物品描述；右：流转履历时间轴
3. 时间轴组件 Timeline.vue：实心点=已完成，空心点=进行中，灰点=未来节点；
   进入视口时逐节点淡入上移（错峰 80ms，IntersectionObserver 触发），
   prefers-reduced-motion 时直接显示不做动画。
4. 预约点击后调用 S3-06 的接口，成功弹领取码卡片（码 + 到期时间 + 驿站地址）；
   失败按四种情况给不同文案（余量不足/超上限/已下架/未登录）。
5. 未登录时按钮文案改为「登录后预约」，点击跳登录并带 redirect。

【必须做到】
- 时间轴只在首次进入视口时播放一次，来回滚动不重复触发
- 余量为 0 时按钮禁用并显示「已约满」
- 履历中不出现任何学号或真实姓名

【验收】
- 学生账号看他人履历，节点显示"某同学"而非姓名
- 减少动态效果开启后，时间轴无动画直接显示
- 余量 1 的批次，数量步进器上限为 1，点 + 无效
- 预约成功后详情页余量立即减少（无需手动刷新）

【不要做】
- 不要做图片放大镜、视频播放等额外交互
- 不要在详情页做"相关推荐"
```

---

### S3-08　捐赠登记：接口 + 页面 + 图片压缩（B）

```
【先读】prototype/04-捐赠登记.html、docs/01-项目需求说明书.md F1 小节

【任务】
1. project/backend/src/routes/items.ts 增加：
   - POST /api/items：zod 校验 6 个必填项（标题≥4、品类、成色、数量 1..20、驿站、描述≥10），
     创建批次 status=PENDING，写 ItemLog(SUBMIT)，返回批次 id。
   - PATCH /api/items/:id：仅本人且 status=REJECTED 时可调用；
     更新字段后 status 回到 PENDING，写 ItemLog(RESUBMIT)，保留原 rejectReason 到日志 note。
2. 图片上传：POST /api/upload（multer，单文件≤5MB，仅 jpg/png/webp），
   存 project/backend/uploads/，文件名用 uuid，返回 { url }。放在 items 路由文件内即可。
3. project/front/src/views/donate/DonateView.vue：
   - 表单顺序与原型一致：标题、品类胶囊、成色分段、数量步进、驿站下拉、描述、图片
   - 图片选择后**立即用 canvas 压缩**（长边 1280、质量 0.82、优先 WebP），
     压缩完成才显示缩略图；最多 6 张，可删除
   - 描述右下角实时字数（n/200），少于 10 字时提交按钮禁用
   - 选驿站后下方提示替换为该驿站的地址与营业时间
   - 右侧三张提示卡：提交后会发生什么 / 常见驳回原因 / 本季数据
4. 提交成功后跳 /my/records 并高亮新记录，同时 toast 提示应送达的驿站。
5. 从「已驳回」进入时，顶部展示红色驳回原因横幅，标题改为「修改后重新提交」。

【必须做到】
- 图片压缩在前端完成，上传到服务端的文件不超过 500KB
- 必填项校验与后端 zod schema 共用同一份定义（放 project/front/src/types/）
- 提交中按钮禁用，防重复提交

【验收】
- 传一张 4MB 照片，Network 面板显示实际上传体积 < 500KB
- 描述只填 5 个字 → 提交按钮禁用，下方提示"至少 10 字"
- 驳回后点"修改重提"进入本页，字段预填、有红色原因横幅
- 重提成功后状态回到待审核，且履历中能看到原驳回原因

【不要做】
- 不要做富文本编辑器
- 不要做图片裁剪
- 不要做"存为草稿"（P1，本次跳过）
```

---

### S3-09　审核、收货与物品管理（A）

```
【先读】
prototype/06-物品管理.html（含收货确认弹窗）
docs/01-项目需求说明书.md F2、§4.3 状态转换表

【任务】
1. project/backend/src/routes/admin.ts：
   - GET /api/admin/items?status=&keyword=&page=&size=：按状态分组查询，
     返回含 donorName、donorStudentNo、submittedAt、totalQty。
   - POST /api/admin/items/:id/approve：仅 PENDING → RECEIVING，写 ItemLog(APPROVE)。
   - POST /api/admin/items/:id/reject：body 含 reason（≥5 字），仅 PENDING → REJECTED，
     保存 rejectReason，写 ItemLog(REJECT)。
   - POST /api/admin/items/:id/receive：body 含 actualQty（≥1），仅 RECEIVING → ON_SHELF；
     更新 totalQty；若 actualQty ≠ 原申报值，额外写一条 ItemLog(QTY_ADJUST)，
     note 为"申报 X 件，实收 Y 件"；生成入库编号 SR-YYYY-NNNN；写 ItemLog(RECEIVE)。
   - POST /api/admin/items/:id/offline：仅 ON_SHELF → OFFLINE；
     若存在未核销预约则返回 3006 且 message 带上待取消数量。
2. project/front/src/views/admin/items/ItemListView.vue：
   5 个 Tab（待审核/待收货/在架/已驳回/已下架）带数量角标；
   表格列：勾选、图片、物品+登记人、品类、数量、提交时间、状态、操作；
   待审核行操作为"通过/驳回/详情"，待收货行操作为"收货确认/退回"，在架行有一个"下架"；
   分页每页 10 条，按提交时间**升序**（先到先审）。
3. 驳回弹窗：必填原因，空则禁用确认按钮。
4. 收货确认弹窗：展示物品/登记人/申报数量/驿站，可修改实收数量，
   数量不一致时出现黄色提示"实收数量将与申报不一致，记入流转履历并通知捐赠人"。
5. 批量通过：支持跨页选中，执行前二次确认；批量驳回弹统一原因输入框。

【必须做到】
- 每次状态变更都在同一事务内写 ItemLog
- 收货修正必须留痕，不允许静默改数量
- 下架前必须校验未核销预约数

【验收】
- 驳回原因为空时确认按钮禁用
- 申报 5 件收 4 件后，批次 totalQty = 4，履历出现"申报 5 件，实收 4 件"
- 对有待领取预约的批次点下架 → 提示有 N 个预约未领取，操作被拒
- 通过审核后该批次出现在"待收货"Tab，且发现页仍看不到它

【不要做】
- 不要做编辑物品内容的功能（只做状态流转）
- 不要做导出（P2）
```

---

### S3-10　核销内核与核销台（A）

```
【先读】
prototype/07-核销台.html
docs/01-项目需求说明书.md F5、§4.4 表中 E-03
docs/02-数据结构与系统架构说明.md 5 章事务边界

【任务】
1. project/backend/src/routes/admin.ts 增加 POST /api/admin/reservations/redeem：
   · 入参 code（8 位）
   · 核销前先 sweepExpired 一次
   · 校验顺序：码不存在→2001；status=COLLECTED→3004（message 带首次核销时间与操作人）；
     status=EXPIRED→3003；status=CANCELLED→3002；批次非 ON_SHELF→3002
   · 通过后在单事务内：Reservation 置 COLLECTED（记录 collectedAt/collectedBy）、
     reservedQty -= qty、collectedQty += qty、
     若 collectedQty === totalQty 则批次置 CLOSED 并写 ItemLog(CLOSE)、
     写 ItemLog(COLLECT)
   · 返回 { itemTitle, qty, collectedAt, itemClosed }
2. project/backend/src/routes/admin.ts 增加 GET /api/admin/reservations/today：
   返回当日及之前所有 PENDING 预约，按 expireAt 升序，含 code/itemTitle/qty/expireAt/receiverName。
3. project/front/src/views/admin/redeem/RedeemView.vue：
   - 左：8 位输入框（等宽字体、字距加宽、自动转大写并过滤空格）、核销按钮、
     成功结果卡（物品名/数量/领取人/批次剩余）、四类失败原因的展示区
   - 右：今日待领取列表（码/物品+数量/剩余时长），剩余不足 1 天的整行转红
   - 下：最近核销记录表（当日），列为领取码、物品+数量、核销时间、操作人
4. 输入框回车即触发核销；成功后 3 秒清空并把焦点还给输入框。

【必须做到】
- 四类失败必须给出不同文案，不能统一"核销失败"
- 码无效时不清空已输入内容
- 核销后批次剩余为 0 时，发现页不再出现该批次

【验收】
- 同一码核销两次 → 第二次返回 3004，文案含首次核销时间与操作人
- 输入已超时 4 小时的码 → 返回 3003，且该预约的数量已归还
- 最后一件核销后，批次状态为 CLOSED，发现页查不到
- 回车能直接核销，无需点按钮

【不要做】
- 不要做撤销核销
- 不要接扫码枪 SDK（扫码枪本质是键盘输入，无需额外处理）
```

---

### S3-11　我的记录：我捐的 / 我领的（B）

```
【先读】prototype/05-我的记录.html

【任务】
1. project/backend/src/routes/my.ts：
   - GET /api/my/donations：返回当前用户捐赠的批次，含 status、totalQty、collectedQty、
     available、rejectReason、submittedAt，按提交时间倒序。
   - GET /api/my/reservations：返回当前用户的预约，含 code、qty、expireAt、status、
     itemTitle、stationName，调用 sweepExpired('user') 后再查。
2. project/front/src/views/my-records/RecordsView.vue：
   - 双 Tab：我捐的 / 我领的，Tab 带数量角标；默认落在「我领的」，
     无预约记录时回退到「我捐的」
   - 我捐的：列表行含缩略图、标题、状态徽标、数量与已被领走数、驿站、操作按钮；
     已驳回行内直接展示红色驳回原因 + 「放弃 / 修改重提」；
     点击整行展开内联时间轴（复用 S3-07 的 Timeline 组件）
   - 我领的：两列卡片，含领取码（等宽大字 + 复制按钮）、驿站、数量、到期时间、
     倒计时（每秒刷新，剩不足 1 天转红）、查看物品 / 取消预约
3. 取消预约需二次确认，说明"数量将归还，需重新预约"；取消后卡片保留并置为已取消。
4. 两个 Tab 都用 AsyncState 处理四态；空态文案区分"从未捐过"与"筛选为空"。

【必须做到】
- 倒计时归零后卡片自动转为"已超时，数量已释放"（依赖服务端下次请求的结果，不靠前端改状态）
- 已驳回记录的重提入口，与 S3-08 的表单预填打通
- 他人信息脱敏

【验收】
- 新账号进入 → 空态带"去捐赠""去逛逛"两个按钮
- 驳回记录行内可见原因，点"修改重提"能带数据进入捐赠表单
- 领取码点击可复制，且有 toast 反馈
- 倒计时剩余 23 小时时文案转红

【不要做】
- 不要做分页（数据量小，一次返回）
- 不要做筛选与排序
```

---

### S3-12　统计看板（C）

```
【先读】
prototype/08-统计看板.html
docs/01-项目需求说明书.md F7、附录 10
注意：2026-11-20 补充，需求说明书 F7 只列了 5 个指标，本页需要第 5 项「转化漏斗」，
口径见本 Prompt 第 2 条。

【任务】
1. project/backend/src/routes/stats.ts：GET /api/admin/stats/overview?range=quarter
   **一次请求返回全部指标**，服务端聚合，前端不做二次计算：
   - categoryDistribution：按已核销件数分组，返回 [{ name, count, percent, color }]
   - monthlyFlow：近 6 个月每月核销件数 [{ month, count }]
   - staleItems：在架超 30 天且 collectedQty = 0 的批次，最多 5 条
   - carbonTotal：Σ(品类 weightPerUnitKg × co2FactorPerKg × collectedQty)
   - funnel：提交数 / 审核通过数 / 上架数 / 产生预约数 / 完成核销数
   - kpi：在架批次数、本季核销件数、平均在架天数
2. project/front/src/views/admin/dashboard/DashboardView.vue：
   - 顶部 4 个 KPI 卡（在架批次/本季核销/碳减排累计/平均在架天数），带环比
   - 环形图（品类分布）用 conic-gradient 或 ECharts 实现，配图例显示件数与占比
   - 柱状图（月度流转量）用 ECharts，6 根柱
   - 漏斗（5 段横向条，宽度按百分比）
   - 滞销物品表（物品/品类/余量/在架天数/下架操作）
3. 碳减排数字旁加"估算"标注，点击弹出计算口径说明：
   Σ(单件估重 × 单位碳因子 × 已核销件数)，并注明"仅用于公益可视化，不构成碳核算"。
4. 所有图表在无数据时展示空状态文案，不渲染空白画布。

【必须做到】
- 聚合在 SQL/Prisma 层完成，不把全表拉到前端算
- 环图颜色与图例顺序一致，占比之和为 100%
- 窄屏（<1024）时两列降为一列，图表不横向溢出

【验收】
- 80 条种子数据下，5 个指标均有值且无空白图表
- 删掉所有 Reservation 后刷新，图表显示空状态而非报错
- 碳减排口径弹窗能打开且文案与附录 10 一致
- 滞销列表点击"下架"能调用 S3-09 的下架接口

【不要做】
- 不要做自定义时间区间选择器（先固定"本季度"）
- 不要做 CSV 导出（P2）
```

---

## 四、阶段 4：体验与工程完善（W3）

> 指南原文：「补充响应式布局、加载状态、错误处理、表单校验、权限控制、性能优化和测试」。
> 这个阶段最容易"看起来做完了其实全是坑"，所以每个 Prompt 都带**走查清单**而不是"优化一下"。

### 4.1 Prompt 索引

| 编号 | 任务 | 归属 | 依赖 |
| --- | --- | --- | --- |
| S4-01 | 四态全面接入 + 全局错误边界 | B | 阶段 3 全部 |
| S4-02 | 表单校验统一与错误文案 | B | S3-08 |
| S4-03 | 权限双层校验走查 | A | 阶段 3 全部 |
| S4-04 | 性能处理：图片、列表、路由、首屏 | B | S3-05、S3-07 |
| S4-05 | 无障碍走查 | B/C | S4-01 |
| S4-06 | 桌面优先响应式与窄屏兜底 | B | 阶段 3 全部 |
| S4-07 | 工程规范：lint、hook、提交规范 | A | 阶段 3 全部 |
| S4-08 | 冒烟用例执行与缺陷修复 | 全员 | S4-01~07 |

### S4-01　四态全面接入 + 全局错误边界（B）

```
【先读】prototype/09-状态与异常.html、docs/02-数据结构与系统架构说明.md 7 章

【任务】
1. 逐个走查 7 个核心页面，确认每个数据区块都被 AsyncState 包裹。
   产出走查表：页面 × 区块 × 四态是否覆盖（缺的补上）。
2. 空态文案要区分场景：
   - 发现页无结果 → "清除筛选" + "看看全部"
   - 我的记录无数据 → "还没有记录" + "去捐赠/去逛逛"
   - 看板无数据 → "本季度还没有核销记录"
   不要所有空态都用同一句"暂无数据"。
3. 全局错误边界：
   - app.config.errorHandler 捕获未处理异常，上报 console 并 toast 一次
   - onErrorCaptured 在页面级组件兜底，渲染 ErrorState 而不是白屏
4. 统一 toast 组件（成功/警告/错误三色），三条文案按原型 09 页的措辞改写到位。

【必须做到】
- 每页至少一处能触发四态的入口，方便答辩演示
- 错误态必须有重试按钮且能真的重试
- 骨架屏尺寸与真实内容一致，无布局跳动（Lighthouse CLS < 0.1）

【验收】
- 用 DevTools 断网，逐页刷新，每页都能看到错误态 + 重试可用
- 全局搜 "暂无数据"，应为 0 处
- 在某个组件里故意 throw，页面显示错误边界而非白屏

【不要做】
- 不要引入第三方 toast 库
- 不要给每个页面重复写四态模板，必须复用 AsyncState
```

### S4-02　表单校验统一与错误文案（B）

```
【先读】docs/02-数据结构与系统架构说明.md 6.4、S3-08 已完成的捐赠表单

【任务】
1. 把捐赠、登录、驳回原因、收货数量四处的 zod schema 收敛到 project/front/src/types/ 下，
   前后端 import 同一份，不允许两份定义。
2. 每个字段错误文案改成"具体规则"而不是"格式不正确"：
   例：标题 → "标题至少 4 个字，请写清物品名称与规格"
       描述 → "描述至少 10 个字，需说明使用痕迹与缺失配件"
3. 提交失败时把焦点移到第一个出错字段，并 scrollIntoView。
4. 服务端返回 1001 时，把 message 映射回对应字段的错误位，而不是只弹一个 toast。

【必须做到】
- 同一规则前后端文案一致
- 错误提示用 aria-live="polite"，屏幕阅读器能读到

【验收】
- 提交空表单 → 4 个必填项同时标红，焦点落在第一个
- 改后端 schema 的最小长度后，前端提示同步变化（证明共用同一份）

【不要做】
- 不要引入 vee-validate 等额外校验库
```

### S4-03　权限双层校验走查（A）

```
【先读】docs/01-项目需求说明书.md §8 权限矩阵

【任务】
1. 按权限矩阵逐格核对：每一条"能力"都要有 前端路由守卫 + 后端中间件 两道。
   产出核对表：能力 × 前端是否拦 × 后端是否拦 × 结论。
2. 重点补三个容易漏的：
   - PATCH /api/items/:id 必须校验 donorId === 当前用户
   - POST /api/reservations/:id/cancel 必须校验 userId === 当前用户
   - GET /api/my/* 只能查自己，不接受 userId 入参
3. 用 curl 或 REST Client 直接调受保护接口（绕过前端），确认返回 1002/1003。

【必须做到】
- 任何接口都不能只靠前端按钮隐藏来保护
- 越权访问返回 1003，不返回 200 空数据（避免信息泄露）

【验收】
- 用学生 token 调所有 /api/admin/* → 全部 1003
- 用 A 学生 token 取消 B 学生的预约 → 1003
- 核对表 12 行全部"是/是"

【不要做】
- 不要做 RBAC 表或权限点配置（只有两个角色，硬编码即可）
```

### S4-04　性能处理（B）

```
【先读】docs/02-数据结构与系统架构说明.md 6.5

【任务】
1. 图片：列表与详情统一走 blur-up —— 先用 20px 占位放大模糊，原图 onload 后淡入；
   列表图 loading="lazy"，并设置固定宽高比防止抖动。
2. 列表：卡片组件用 v-memo 绑定关键字段，避免筛选时全量重渲染。
3. 路由：确认全部懒加载，/admin/* 单独分包（build 后看 chunk 分布）。
4. 首屏：字典数据缓存 1 小时；运营位插画用 SVG 不用位图。
5. 加打包分析（vite build --report 或 rollup-plugin-visualizer 的临时用法），
   产出优化前后的对比表：首屏 JS 体积、首次内容绘制时间。

【必须做到】
- 首屏 JS（gzip）≤ 300KB
- 图片区域无累积布局偏移（CLS）
- 筛选切换时不出现整页重渲染（用 Vue DevTools 的 render 高亮确认）

【验收】
- Lighthouse 桌面性能 ≥ 85
- 弱网（Fast 3G）下图片先出现模糊占位再清晰
- 打包报告里 /admin 的 chunk 与主包分离

【不要做】
- 不要做虚拟列表（每页 12 条用不上）
- 不要上 CDN 或图片服务
```

### S4-05　无障碍走查（B/C）

```
【先读】docs/01-项目需求说明书.md N3

【任务】
1. 语义化：导航用 nav、主内容用 main、列表用 ul/li、表格保留 th scope；
   时间轴用 ol + role="list"。
2. 图片：占位块给 aria-label 描述（如"物品照片，暂未上传"）。
3. 对比度：正文与背景 ≥ 4.5:1，次要文字 ≥ 3:1；用 axe DevTools 扫一遍。
4. 键盘可达：Tab 顺序合理，focus-visible 有 2px 主色描边，
   弹窗打开后焦点锁在弹窗内，Esc 可关闭。
5. 表单：label 与 input 用 for/id 关联，错误用 aria-describedby 指向提示文本。
6. 降低动态：时间轴与页面过渡尊重 prefers-reduced-motion。

【必须做到】
- axe 扫描 0 个 critical 问题
- 只用键盘能完成一次完整预约流程

【验收】
- 关闭鼠标，从登录到预约成功全程可操作
- axe 报告 critical 为 0
- 系统开启"减少动态效果"后无位移动画

【不要做】
- 不要追求 WCAG AAA
- 不要给每个元素加 role（过度标注反而更乱）
```

### S4-06　桌面优先响应式与窄屏兜底（B）

```
【背景】Q10 决议：本期只做桌面浏览器运行，但指南要求"响应式"，所以窄屏不能崩。

【任务】
1. 以 1280 为设计基准，检查 ≥1024 的完整体验。
2. 768—1023：网格从 4 列降 2 列，侧栏变窄，表格允许横向滚动。
3. <768：保证不出现横向滚动条、不出现文字重叠、按钮可点击；
   不专门做移动交互（不做底部 TabBar、不做手势）。
4. 用 clamp() 处理标题字号，用 minmax 处理网格，避免写多套断点。
5. 产出 1280 / 1024 / 768 / 375 四档截图。

【必须做到】
- 四档宽度下均无横向滚动
- 表格在窄屏下用外层容器 overflow-x: auto，不挤压单元格

【验收】
- 拖拽窗口从 1440 到 375，全程无重叠、无截断、无横向滚动
- 四个断点截图入文档

【不要做】
- 不要为移动端单独写一套布局
- 不要隐藏内容来"适配"（信息必须都能看到）
```

### S4-07　工程规范（A）

```
【任务】
1. ESLint flat config + @typescript-eslint + eslint-plugin-vue，规则以 recommended 为底，
   关掉与 Prettier 冲突的格式规则。
2. Prettier 配置：单引号、无分号、printWidth 100。
3. husky + lint-staged：pre-commit 只检查暂存区文件的 lint 与 format。
4. commitlint：约定式提交（feat/fix/docs/style/refactor/test），配 commit-msg 钩子。
5. package.json 增加 scripts：lint / lint:fix / format / type-check / build / dev。
6. 统一 .editorconfig 与 .nvmrc，engines 锁定 Node ≥20.10。
7. 首次全量跑一遍 lint:fix，把历史问题清干净，commit message 记为 style: 统一格式。

【必须做到】
- npm run lint 零 error
- npm run type-check 零 error
- 提交一条不符合规范的 message 时被拦截

【验收】
- 故意写一个未使用变量 → pre-commit 拦截
- 故意写 "修改了一下" → commit-msg 拦截
- 新拉仓库执行 npm ci 后可直接 npm run dev

【不要做】
- 不要引入 stylelint（本项目手写 CSS 量不大）
- 不要配置 CI（时间不够，本地钩子足够）
```

### S4-08　冒烟用例执行与缺陷修复（全员）

```
【先读】docs/02-数据结构与系统架构说明.md 第 9 章 15 条冒烟用例

【任务】
1. 逐条执行 T-01 至 T-15，记录：通过 / 不通过 / 阻塞，不通过的要写复现步骤。
2. 把结果整理成表格写入 docs/测试记录.md（新建，含用例编号、结果、备注）。
3. 缺陷按模块分派：接口与状态 → A；用户端页面 → B；看板与文档 → C。
4. 修完的缺陷在表里标注修复 commit 的短 hash。

【必须做到】
- 每条用例都要真的执行，不能凭代码看着像对就标通过
- 并发用例（T-05）必须用两个浏览器窗口真的同时点

【验收】
- 15 条全部有明确结论，不通过项已修复或已记录为已知问题
- 测试记录中有至少 3 条真实的修复记录

【不要做】
- 不要写自动化测试脚本（时间不够，手工冒烟即可）
- 不要把"没测"写成"通过"
```

---

## 五、阶段 5：演示与总结（W4）

> 指南原文：「准备演示账号、测试数据、项目文档、演示视频和答辩材料」。
> 这个阶段占评分 30 分，多数小组栽在"文档最后三天赶"，所以每个 Prompt 都要求**先出结构再填内容**。

### 5.1 Prompt 索引

| 编号 | 任务 | 归属 |
| --- | --- | --- |
| S5-01 | README 与可重复运行验证 | A |
| S5-02 | 需求说明书定稿与交叉校对 | C |
| S5-03 | 架构文档补全（含真实截图） | A |
| S5-04 | 演示视频脚本与分镜 | C |
| S5-05 | 项目总结报告 | C（A/B 供章） |
| S5-06 | 答辩 PPT 大纲与每人三问 | C |
| S5-07 | 演示环境与数据准备清单 | A |

### S5-01　README 与可重复运行（A）

```
【任务】
1. 写 README.md，结构：
   项目一句话 → 技术栈 → 目录说明 → 三步启动 → 演示账号 → 常见问题 → 已知限制
2. 三步启动必须真的只有三步：npm ci / cp .env.example .env / npm run db:push && npm run db:seed && npm run dev
3. 写清演示数据来源：自建模拟数据，非真实业务数据，仅用于课程演示。
4. 附一张目录树（只到二级）。
5. 已知限制一节：SQLite 不适合公网部署、未做移动端专用交互、CSV 导出未实现。

【必须做到】
- 在一台没装过项目的机器（或新建用户目录）上照 README 跑一遍，10 分钟内起来
- 不出现"请自行安装 XXX"这种含糊表述

【验收】
- 按 README 全程操作，一次成功，无需额外查资料
- 换 Node 版本低于 20 时有明确报错提示

【不要做】
- 不要写 Docker（P2 已砍）
- 不要在 README 里写实现细节（那是架构文档的事）
```

### S5-02　需求说明书定稿（C）

```
【先读】docs/01-项目需求说明书.md

【任务】
1. 补三处与实际实现不一致的地方（以代码为准，不要改代码迁就文档）：
   - F7 增加第 5 个指标"转化漏斗"及其口径
   - §7.2 页面清单与最终路由对齐
   - §3.2 范围外补上"CSV 导出、配额制、深色模式"三项并注明为 P2 未实现
2. 每个功能补一段"实现要点"，说明该功能最后落在哪个文件、用了什么方案。
3. 导出 PDF 版（用编辑器导出，不要改内容）。
4. 交叉校对：A 看第 4、5 章，B 看第 7 章，C 统稿。

【必须做到】
- 文档描述与代码行为一致，抽查 3 个功能逐条对照
- 术语全文统一（"批次""预约单""驿站"不混用"物品""订单""站点"）

【验收】
- 三人各签字确认负责章节
- PDF 目录层级正确，图表无跨页断裂
```

### S5-03　架构文档补全（A）

```
【任务】
1. 用真实截图替换文档中的示意图（ER 图可用 Prisma Studio 截图或 dbdiagram 导出）。
2. 接口清单标注实际实现状态：已实现 / 未实现，未实现的写原因。
3. §4 关键设计决策补两条实战踩坑：
   - 实际遇到的并发问题与解决过程
   - 图片压缩前后的体积对比数据
4. 附一份"代码地图"：功能 → 前端文件 → 后端文件 → 涉及表，方便评审快速定位。

【必须做到】
- 每个设计决策都有"问题-方案-权衡"三段
- 踩坑记录写真实发生的事，不要编

【验收】
- 评审任指一个功能，能在代码地图里 30 秒内定位到文件
```

### S5-04　演示视频脚本与分镜（C）

```
【任务】
1. 按 5—8 分钟写分镜脚本，表格列：时间码 / 画面 / 旁白 / 出镜人 / 录屏操作。
   结构沿用分工文档 §7.2：痛点 45s → 定位 30s → 闭环演示 3min → 技术亮点 1.5min → 设计说明 1min → 总结 45s。
2. 闭环演示段要写清每一步点哪里、说什么，精确到"点'立即预约'，说：这里余量只剩 1 件"。
3. 技术亮点段设计两个"看得见"的实验：
   - 双窗口抢最后一件（证明不超卖）
   - 把数据库时间改到 4 天后（证明超时回收）
4. 写录制注意事项：分辨率 1920×1080、隐藏书签栏、字体放大到 110%、关闭通知。

【必须做到】
- 旁白是口语，不是念文档
- 每个时间码可执行，不出现"这里简单展示一下"

【验收】
- 照脚本能一次录完，不需要临场想
- 总时长控制在 8 分钟内
```

### S5-05　项目总结报告（C）

```
【任务】
1. 报告结构：项目概述 / 需求与方案演变 / 技术实现 / 遇到的问题与解决 / 不足与改进 / 个人收获。
2. "需求与方案演变"要写真实的两次转向：
   - 从"二手交易"改为"旧物捐赠"的理由
   - 从"单件模型"改为"数量模型"带来的状态机重构
3. "不足"必须写真问题（例如：未做部分核销、移动端仅保证不崩、没有自动化测试），
   并给出如果再来一次会怎么做。
4. 三人各写一段个人收获（300 字），C 统稿。

【必须做到】
- 不出现"圆满完成""效果良好"这类空话
- 每个"不足"都配一个具体改进方案

【验收】
- 通读一遍能在 5 分钟内讲清"你们做了什么、为什么这么做、哪里没做好"
```

### S5-06　答辩 PPT 与每人三问（C）

```
【任务】
1. PPT 12—14 页：封面 / 痛点 / 一句话定位 / 用户与角色 / 闭环流程图 / 双轨状态机 /
   技术架构 / 三个技术亮点 / 界面展示（4 张截图）/ 数据与减碳 / 不足与改进 / 分工 / 致谢。
2. 每页只放一个观点，正文不超过 40 字，图优先于字。
3. 按分工文档 §7.3 整理每人必须能答的 3 个问题，每题写 3 句话的标准答案，
   并在组内互问一遍，答不上的当场补。
4. 预约答辩顺序：A 讲架构与并发，B 讲设计与体验，C 讲需求与反思，最后合演 demo。

【必须做到】
- 每人讲解时间控制在 4 分钟，超时说明内容太满
- 三问答不出来的人，不能上答辩

【验收】
- 完整走一遍，总时长 ≤ 15 分钟
- 每人被随机追问 2 个问题能答上
```

### S5-07　演示环境与数据准备（A）

```
【任务】
1. 写一份演示检查清单（文档或便签），答辩前 30 分钟逐项打勾：
   - 演示机 Node 版本、端口 3001 未被占用
   - npm run db:reset 后数据恢复到初始 80 条
   - 三个演示账号可登录
   - 待审核队列有 5 条、待领取有 2 条（其中 1 条 24 小时内到期）
   - 双窗口并发演示的两个浏览器已就位
   - 演示用的 4 天后时间修改脚本准备好（改完记得改回）
2. 准备一个 dev.db + uploads 的压缩包作为兜底，解压即可运行。
3. 写一页"现场翻车预案"：数据库坏了怎么办、网络断了怎么办、某个功能点不动了怎么圆场。

【必须做到】
- 兜底包在另一台机器上验证过能跑
- 时间修改脚本有配套的还原脚本

【验收】
- 按清单在答辩机上完整走一遍，全部打勾
```

---

## 六、自写 Prompt 的模板

遇到上面没覆盖的任务时，按这个骨架写：

```
【先读】列出 1—3 个必读文件（不要超过 3 个，太多 Agent 会抓不住重点）

【任务】
1. 具体到文件路径与函数名
2. 一件事一条，不要写"完善一下""优化一下"
3. 涉及状态的，写清从哪个状态到哪个状态

【必须做到】
- 可被验证的硬要求（能 grep、能点、能看数字）

【验收】
- 我怎么判断你做完了（用"操作 → 期望结果"的形式）

【不要做】
- 本次任务的禁区（防止 Agent 顺手重构或加依赖）
```

**写 Prompt 的三条经验**

| 经验 | 反例 | 正例 |
| --- | --- | --- |
| 说清"不做什么"比说清"做什么"更重要 | "实现预约功能" | "实现预约功能，但不要写定时任务，不要支持部分取消" |
| 用可验证的结果代替形容词 | "优化一下加载体验" | "切换筛选时出现骨架屏，且不出现整页空白" |
| 一次只推进一个状态转换 | "把审核和收货都做了" | "先做审核：PENDING → RECEIVING" |

---

## 七、反模式：这几种用法一定会返工

| 反模式 | 后果 | 正确做法 |
| --- | --- | --- |
| 一个 Prompt 干完整个阶段 | 出错范围不可控，回滚成本极高 | 拆成 8—12 个 Prompt，逐个验收 |
| 不贴上下文块就开跑 | Agent 编字段名、编错误码、擅自分层 | 每次必贴 §2.1 |
| 让 Agent 自己决定数据结构 | 与架构文档脱节，三人对不上 | 数据结构只由 S3-01 定义，之后只读不改 |
| 三个人同时改 `router/` 和 `http.ts` | 合并冲突，互相覆盖 | 共用文件由 A 统一改，其他人提需求 |
| 跑完不 commit 就接下一个 | 出问题无法回滚到可用状态 | 一个 Prompt 一次 commit |
| 用"看起来对了"作为验收 | 答辩时一操作就露馅 | 每个 Prompt 都按【验收】实际点一遍 |
| 让 Agent 顺手"重构"老代码 | 本来能跑的模块被改坏 | 通用上下文块里明确禁止 |
