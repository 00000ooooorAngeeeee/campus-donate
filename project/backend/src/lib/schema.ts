// 入参 zod schema：前后端共用同一份校验规则（前端副本在 front/src/types/），
// 错误文案直接写给用户看，而不是 "格式不正确" 这类无信息量提示
import { z } from 'zod'

export const loginSchema = z.object({
  // admin 账号本身只有 5 位，所以下限放到 3 而不是原型里的 6
  studentNo: z
    .string({ required_error: '请输入学号' })
    .trim()
    .min(3, '账号长度至少 3 位')
    .max(20, '账号长度不超过 20 位')
    .regex(/^[A-Za-z0-9]+$/, '账号仅支持字母与数字'),
  password: z
    .string({ required_error: '请输入密码' })
    .min(1, '请输入密码')
    .max(64, '密码长度不正确'),
})

export const reserveSchema = z.object({
  // 上界 20 与"单批次 ≤20 件"的假设 A-02 对齐，可用量余量由条件更新兜底
  qty: z
    .number({ required_error: '数量必须为整数', invalid_type_error: '数量必须为整数' })
    .int('数量必须为整数')
    .min(1, '数量至少为 1 件')
    .max(20, '单次最多预约 20 件'),
})

export const rejectSchema = z.object({
  // 业务规则：驳回必须填原因（≥5 字），否则捐赠人无法知道怎么改
  reason: z
    .string({ required_error: '请填写驳回原因' })
    .trim()
    .min(5, '驳回原因至少 5 个字')
    .max(200, '驳回原因不超过 200 字'),
})

export const receiveSchema = z.object({
  actualQty: z
    .number({ required_error: '请填写实收数量', invalid_type_error: '数量必须为整数' })
    .int('数量必须为整数')
    .min(1, '数量必须 ≥1')
    .max(999, '数量过大，请人工核对'),
})

export const redeemSchema = z.object({
  // 从聊天记录粘贴的码常带空格/连字符，入口处先归一化再校验长度
  code: z
    .string({ required_error: '请输入领取码' })
    .transform((s) => s.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().length(8, '领取码为 8 位字母或数字')),
})

export const adminItemsQuerySchema = z.object({
  status: z.enum(['PENDING', 'RECEIVING', 'ON_SHELF', 'REJECTED', 'OFFLINE']).default('PENDING'),
  keyword: z.string().trim().max(40, '关键词过长').optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(10),
})

export type LoginInput = z.infer<typeof loginSchema>
export type ReserveInput = z.infer<typeof reserveSchema>
export type RejectInput = z.infer<typeof rejectSchema>
export type ReceiveInput = z.infer<typeof receiveSchema>
export type RedeemInput = z.infer<typeof redeemSchema>
export type AdminItemsQuery = z.infer<typeof adminItemsQuerySchema>
