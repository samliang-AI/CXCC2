import { NextRequest, NextResponse } from 'next/server'

import { fetchAllRecordingsInRange, parseNum } from '@/lib/supabase-recordings'
import { isRealDataOnly } from '@/lib/data-source-config'

// 模拟生成坐席每日数据
function generateDailyData(year: number, month: number, agentCode: string) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const dailyData = []

  // 基于坐席工号生成随机种子，保证同一坐席数据相对稳定
  const seed = parseInt(agentCode.replace(/\D/g, '')) || 1
  const baseCalls = 30 + (seed % 50) // 基础外呼量 30-80

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    
    // 周末外呼量较少
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.3 : 1
    const randomFactor = 0.7 + Math.random() * 0.6 // 0.7-1.3 的随机波动
    
    const totalCalls = Math.floor(baseCalls * weekendFactor * randomFactor)
    const connectedCalls = Math.floor(totalCalls * (0.5 + Math.random() * 0.3))
    const successCalls = Math.floor(connectedCalls * (0.4 + Math.random() * 0.3))
    const successRate = connectedCalls > 0 ? Number((successCalls / connectedCalls * 100).toFixed(1)) : 0

    dailyData.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      totalCalls,
      connectedCalls,
      successCalls,
      successRate
    })
  }

  return dailyData
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentCode = searchParams.get('agentCode')
    const yearStr = searchParams.get('year')
    const monthStr = searchParams.get('month')

    // 验证必填参数
    if (!agentCode) {
      return NextResponse.json(
        { error: '缺少坐席工号参数' },
        { status: 400 }
      )
    }

    // 获取年月
    const now = new Date()
    const year = yearStr ? parseInt(yearStr) : now.getFullYear()
    const month = monthStr ? parseInt(monthStr) : now.getMonth() + 1

    // 验证参数
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: '无效的年月参数' },
        { status: 400 }
      )
    }

    if (isRealDataOnly()) {
      try {
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0, 23, 59, 59)

        const rows = await fetchAllRecordingsInRange({
          startDate,
          endDate,
          agent: agentCode,
        })

        const byDate = new Map<string, { total: number; connected: number; success: number }>()
        const daysInMonth = new Date(year, month, 0).getDate()
        for (let d = 1; d <= daysInMonth; d++) {
          const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          byDate.set(key, { total: 0, connected: 0, success: 0 })
        }

        for (const r of rows) {
          const date = r.start_time ? r.start_time.split('T')[0] : ''
          if (!date) continue
          if (!byDate.has(date)) byDate.set(date, { total: 0, connected: 0, success: 0 })
          const b = byDate.get(date)!
          b.total += 1
          if (parseNum(r.answer_duration) > 0) b.connected += 1
          if (r.status_name === '成功客户') b.success += 1
        }

        const dailyData = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, b]) => ({
            date,
            totalCalls: b.total,
            connectedCalls: b.connected,
            successCalls: b.success,
            successRate: b.connected > 0 ? Number(((b.success / b.connected) * 100).toFixed(1)) : 0,
          }))

        return NextResponse.json({
          code: 200,
          message: '查询成功',
          data: dailyData,
        })
      } catch (e) {
        return NextResponse.json(
          {
            code: 503,
            error: 'REAL_DATA_UNAVAILABLE',
            message: '坐席日维度仅从 Supabase 读取。请配置 COZE_SUPABASE_URL / COZE_SUPABASE_ANON_KEY。',
            details: e instanceof Error ? e.message : String(e),
          },
          { status: 503 }
        )
      }
    }

    // 生成模拟数据
    const data = generateDailyData(year, month, agentCode)

    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data
    })
  } catch (error) {
    console.error('Failed to fetch agent daily data:', error)
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    )
  }
}
