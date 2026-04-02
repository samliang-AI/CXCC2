import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'

const SYSTEM_PROMPT = `你是一个专业的数据查询助手，帮助用户查询外呼质检管理平台的数据。

## 可查询的模块
1. 数据看板 - 查看整体外呼数据、趋势、排名
2. 团队看板 - 查看团队和坐席业绩数据  
3. 类型筛选 - 按类型统计外呼数据
4. 外呼结果 - 查看外呼结果状态分布

## 常用地市
广州、深圳、珠海、佛山、东莞

## 常用团队
登封、云晟、如皓、诚聚、佳硕、聚能、腾飞、飞越

## 常用坐席
林宇君、刘土梅、张小明、李小红、王大伟、陈小芳、赵大力、周小敏

## 回答要求
- 使用简洁、自然的口语化表达
- 直接给出数据结论，不要解释技术细节
- 不要出现"工具"、"API"、"参数"、"调用"等技术词汇
- 不要显示代码、JSON 或工具调用格式
- 数据要准确，单位要清晰
- 可以适当提供进一步查询的建议

## 示例
用户：本月整体外呼数据如何？
回答：本月整体外呼数据表现良好。总外呼量 XX 通，接通 XX 通，成功 XX 通，成功率约 XX%。相比上月有 XX% 的增长。

用户：广州近 7 天外呼类型分布
回答：广州近 7 天外呼类型分布如下：类型 A 占比 XX%，类型 B 占比 XX%，类型 C 占比 XX%。其中类型 A 表现最好。

用户：团队业绩排名
回答：团队业绩排名前三的是：第一名登封团队（XX 单），第二名云晟团队（XX 单），第三名如皓团队（XX 单）。
`

const cityCodeMap: Record<string, string> = {
  '广州': '4401', '深圳': '4403', '珠海': '4404', '佛山': '4406', '东莞': '4419',
  '4401': '4401', '4403': '4403', '4404': '4404', '4406': '4406', '4419': '4419'
}

const teamIdMap: Record<string, string> = {
  '登封': 'T001', '云晟': 'T002', '如皓': 'T003', '诚聚': 'T004',
  '佳硕': 'T005', '聚能': 'T006', '腾飞': 'T007', '飞越': 'T008',
  'T001': 'T001', 'T002': 'T002', 'T003': 'T003', 'T004': 'T004',
  'T005': 'T005', 'T006': 'T006', 'T007': 'T007', 'T008': 'T008'
}

const agentMap: Record<string, string> = {
  '林宇君': 'A001', '刘土梅': 'A002', '张小明': 'A003', '李小红': 'A004',
  '王大伟': 'A005', '陈小芳': 'A006', '赵大力': 'A007', '周小敏': 'A008',
  'A001': 'A001', 'A002': 'A002', 'A003': 'A003', 'A004': 'A004',
  'A005': 'A005', 'A006': 'A006', 'A007': 'A007', 'A008': 'A008'
}

function extractCityCode(text: string): string | undefined {
  for (const [name, code] of Object.entries(cityCodeMap)) {
    if (text.includes(name)) return code
  }
  return undefined
}

function extractTeamId(text: string): string | undefined {
  for (const [name, code] of Object.entries(teamIdMap)) {
    if (text.includes(name)) return code
  }
  return undefined
}

function extractAgentCode(text: string): string | undefined {
  for (const [name, code] of Object.entries(agentMap)) {
    if (text.includes(name)) return code
  }
  return undefined
}

function getDateRange(text: string): { startDate: string; endDate: string } | undefined {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const monthAgoStr = monthAgo.toISOString().split('T')[0]
  
  if (text.includes('今天') || text.includes('今日')) {
    return { startDate: todayStr, endDate: todayStr }
  }
  if (text.includes('本周') || text.includes('这周')) {
    return { startDate: weekAgoStr, endDate: todayStr }
  }
  if (text.includes('本月') || text.includes('这个月')) {
    return { startDate: monthAgoStr, endDate: todayStr }
  }
  return { startDate: weekAgoStr, endDate: todayStr }
}

function getYearMonth(text: string): { year: number; month: number } {
  const now = new Date()
  const yearMatch = text.match(/(\d{4})年/)
  const monthMatch = text.match(/(\d{1,2})月/)
  
  return {
    year: yearMatch ? parseInt(yearMatch[1]) : now.getFullYear(),
    month: monthMatch ? parseInt(monthMatch[1]) : now.getMonth() + 1
  }
}

async function callTool(toolName: string, params: Record<string, any>): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  
  const toolUrls: Record<string, string> = {
    get_dashboard: `/api/dashboard/statistics`,
    get_team_statistics: `/api/reports?type=team`,
    get_type_filter: `/api/reports?type=type-filter`,
    get_outbound_result: `/api/reports?type=outbound-result`
  }
  
  const url = toolUrls[toolName]
  if (!url) {
    return { error: '未知工具' }
  }
  
  try {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.set(key, String(value))
      }
    })
    
    const fullUrl = `${baseUrl}${url}?${queryParams.toString()}`
    const response = await fetch(fullUrl)
    const data = await response.json()
    return data
  } catch (error) {
    return { error: '调用工具失败', details: String(error) }
  }
}

// 无 AI 服务时的降级回复（基于常见问题匹配）
function getFallbackResponse(message: string): string {
  const m = message.trim()
  if (m.includes('本月') && (m.includes('外呼') || m.includes('整体'))) {
    return '本月整体外呼数据表现良好。您可在「数据看板」查看总外呼量、接通量、成功量及成功率等详细指标。如需查看团队或地市维度，请前往「团队看板」或「类型筛选」。'
  }
  if (m.includes('团队') && (m.includes('业绩') || m.includes('排名'))) {
    return '团队业绩排名可在「团队看板」查看。支持按团队、坐席维度查看本月外呼量、成功量及排名。'
  }
  if (m.includes('类型') || m.includes('分布')) {
    return '外呼类型分布可在「类型筛选」模块查看，支持按地市、时间范围筛选。'
  }
  if (m.includes('外呼结果') || m.includes('成功率')) {
    return '外呼结果及成功率分析可在「外呼结果」模块查看，包含接通、成功、失败等状态分布。'
  }
  if (m.includes('今天') || m.includes('今日')) {
    return '今日外呼数据可在「数据看板」或「外呼结果」中查看，支持按日期筛选。'
  }
  return '您可在数据看板、团队看板、类型筛选、外呼结果等模块查询相关数据。请前往对应页面获取详细信息，或尝试更具体的问题。'
}

export async function POST(request: NextRequest) {
  let userMessage = ''
  try {
    const body = await request.json().catch(() => ({}))
    const { message, history = [] } = (body as { message?: string; history?: unknown[] }) || {}
    userMessage = String(message || '').trim()
    
    if (!userMessage) {
      return NextResponse.json({ error: '请输入问题' }, { status: 400 })
    }
    
    const openrouterApiKey = process.env.OPENROUTER_API_KEY
    
    if (!openrouterApiKey || openrouterApiKey.trim() === '') {
      const fallback = getFallbackResponse(userMessage)
      return NextResponse.json({ text: fallback })
    }
    
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ]
    
    for (const msg of history || []) {
      messages.push(msg)
    }
    
    messages.push({ role: 'user', content: userMessage })
    
    const { text } = await generateText({
      model: openrouter('openai/gpt-4o'),
      messages,
      temperature: 0.3,
    })
    
    const responseText = text || getFallbackResponse(userMessage)
    return NextResponse.json({ text: responseText })
    
  } catch (error) {
    console.error('OpenRouter API error:', error)
    const fallback = getFallbackResponse(userMessage)
    return NextResponse.json({ text: fallback })
  }
}
