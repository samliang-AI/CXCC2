import { NextResponse } from 'next/server'

/**
 * 数据源模式（可同时在服务端路由与客户端组件中判断）
 *
 * - `mock`（默认）：允许使用本地/接口内的模拟数据降级
 * - `real`：禁止模拟数据；未接入真实源的接口返回 501，已接入的必须走真实源
 *
 * 建议在 `.env.local` 中同时设置（客户端组件需 NEXT_PUBLIC_）：
 * ```
 * DATA_SOURCE_MODE=real
 * NEXT_PUBLIC_DATA_SOURCE_MODE=real
 * ```
 */
export function isRealDataOnly(): boolean {
  const mode =
    process.env.DATA_SOURCE_MODE?.trim() ||
    process.env.NEXT_PUBLIC_DATA_SOURCE_MODE?.trim()
  return mode === 'real'
}

/** 真实模式且未允许 mock 时，各 API 返回的统一错误体 */
export function mockDisabledResponse(feature: string) {
  return NextResponse.json(
    {
      code: 501,
      error: 'MOCK_DATA_DISABLED',
      message:
        `当前为「仅真实源」模式（DATA_SOURCE_MODE=real）：已禁用模拟数据「${feature}」。` +
        `请接入对应真实接口/数据库，或临时设置 DATA_SOURCE_MODE=mock。`,
    },
    { status: 501 }
  )
}
