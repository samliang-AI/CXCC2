/**
 * CXCC 呼叫中心 API：二十一、获取通话清单信息
 * POST {base}/om/agentrecordList/api
 * 请求头：Authentication: token（见 PDF《呼叫中心 API》）
 */

import https from 'node:https'
import { getValidToken } from '@/lib/cxcc-auth'

export const CXCC_AGENT_RECORD_LIST_PATH =
  process.env.CXCC_AGENT_RECORD_LIST_PATH || '/om/agentrecordList/api'

function normalizeCxccPath(p: string): string {
  const t = p.trim()
  if (!t) return '/om/agentrecordList/api'
  return t.startsWith('/') ? t : `/${t}`
}

/** 按优先级尝试的路径（PDF 二十一、二十二 多为 …/api 结尾） */
function buildCxccRecordListPathCandidates(primaryOverride?: string): string[] {
  const primary = normalizeCxccPath(
    primaryOverride || process.env.CXCC_AGENT_RECORD_LIST_PATH || '/om/agentrecordList/api'
  )
  const seen = new Set<string>()
  const out: string[] = []
  const push = (p: string) => {
    const n = normalizeCxccPath(p)
    if (!seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  push(primary)
  const noTrail = primary.replace(/\/$/, '')
  if (!/\/api$/i.test(noTrail)) {
    push(`${noTrail}/api`)
  }
  push('/om/agentCalldetailList/selectRecordList/api')
  push('/om/agentCalldetailList/selectRecordList')
  push('/om/agentrecordList/api')
  push('/om/agentrecordList')
  return out
}

export type CxccAgentRecordRaw = {
  uuid?: string
  startTime?: string
  endTime?: string
  companyId?: number | string
  companyName?: string | null
  agent?: number | string
  agentName?: string | null
  taskId?: number | string
  callingPhone?: string
  calledPhone?: string
  callDuration?: number | string
  ringingDuration?: number | string
  answerDuration?: number | string
  /** 二十一话单用 callState；二十二录音清单多为 status（客户状态码） */
  callState?: number
  status?: number | string
  statusName?: string
  playUrl?: string
  qualityStatus?: number | string
  cost?: number | string
  callType?: number
  hangUp?: number
  [key: string]: unknown
}

export type FetchAgentRecordListParams = {
  pageNum: number
  pageSize: number
  /** 坐席工号，PDF 为 Integer，可选 */
  agent?: number | string
  projectId?: number
  calledPhone?: string
  callingPhone?: string
  /** 如 2021-08-30 13:57:22 */
  startTime?: string
  endTime?: string
  answerDurationStart?: number
  answerDurationEnd?: number
}

function getCxccEnv(): { baseUrl: string; token: string } {
  const baseUrl = (process.env.CXCC_BASE_URL || '').replace(/\/$/, '')
  const token = process.env.CXCC_AUTH_TOKEN || ''
  return { baseUrl, token }
}

export function assertCxccConfigured(): { baseUrl: string; token: string } {
  const { baseUrl, token } = getCxccEnv()
  if (!baseUrl || !token) {
    throw new Error('请配置 CXCC_BASE_URL 与 CXCC_AUTH_TOKEN（呼叫中心登录 token）')
  }
  return { baseUrl, token }
}

/** 解析 CXCC 返回的 data 块（兼容 records 字段名、嵌套 data） */
export function parseAgentRecordListPayload(json: unknown): {
  records: CxccAgentRecordRaw[]
  total: number
  raw: unknown
} {
  const root = json as Record<string, unknown>
  const code = root.code
  const codeOk =
    code === undefined ||
    code === null ||
    code === 0 ||
    code === '0' ||
    code === 200 ||
    code === '200'
  if (!codeOk) {
    const msg = (root.message as string) || 'CXCC 接口返回错误'
    throw new Error(`${msg} (code=${String(code)})`)
  }

  // 部分现场用 result 代替 data
  let payload = (root.data ?? root.result) as Record<string, unknown> | unknown[] | undefined

  // data 直接为数组
  if (Array.isArray(payload)) {
    const records = payload as CxccAgentRecordRaw[]
    return { records, total: records.length, raw: json }
  }

  if (payload && typeof payload === 'object' && 'data' in payload && !('records' in payload)) {
    const inner = (payload as Record<string, unknown>).data
    if (Array.isArray(inner)) {
      const records = inner as CxccAgentRecordRaw[]
      return { records, total: records.length, raw: json }
    }
    payload = inner as Record<string, unknown>
  }

  // 无 data 时尝试顶层 records/rows/list（部分网关直出）
  if (!payload || typeof payload !== 'object') {
    const top =
      (root.records ?? root.rows ?? root.list ?? root.record) as unknown
    if (Array.isArray(top)) {
      const records = top as CxccAgentRecordRaw[]
      return {
        records,
        total: Number(root.total ?? root.totalCount ?? records.length) || 0,
        raw: json,
      }
    }
    return { records: [], total: 0, raw: json }
  }

  const p = payload as Record<string, unknown>
  let records = (p.records ?? p.record ?? p.list ?? p.rows ?? p.content) as unknown
  if (!Array.isArray(records)) {
    records = []
  }

  const total =
    Number(
      p.total ??
        p.totalCount ??
        p.totalElements ??
        p.count ??
        (records as unknown[]).length
    ) || 0

  return {
    records: records as CxccAgentRecordRaw[],
    total,
    raw: json,
  }
}

/** 对 CXCC 发起 HTTP 请求，支持自签名证书（HTTPS 时跳过证书校验） */
async function cxccFetch(
  url: string,
  opts: { method: string; headers: Record<string, string>; body: string }
): Promise<{ status: number; text: string }> {
  const u = new URL(url)
  const isHttps = u.protocol === 'https:'
  const skipTls = process.env.CXCC_INSECURE_SKIP_TLS !== '0' && isHttps

  if (isHttps && skipTls) {
    const agent = new https.Agent({ rejectUnauthorized: false })
    return new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: opts.method,
          headers: opts.headers,
          agent,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') })
          )
        }
      )
      req.on('error', reject)
      req.write(opts.body)
      req.end()
    })
  }

  const res = await fetch(url, {
    method: opts.method,
    headers: opts.headers,
    body: opts.body,
  })
  const text = await res.text()
  return { status: res.status, text }
}

/**
 * 兼容部分网关返回 "JSON + 额外日志/尾巴" 的情况：
 * 优先按标准 JSON 解析；失败时提取首个完整 JSON 对象/数组再解析。
 */
function safeParseCxccJson(rawText: string): unknown {
  const text = rawText.trim()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    // fallback: 扫描首个完整 JSON 片段（支持字符串与转义）
    const firstBrace = text.search(/[\{\[]/)
    if (firstBrace < 0) {
      throw new Error(`CXCC 返回非 JSON：${text.slice(0, 200)}`)
    }

    const open = text[firstBrace]
    const close = open === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false

    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (ch === '\\') {
          escaped = true
        } else if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === open) depth += 1
      if (ch === close) {
        depth -= 1
        if (depth === 0) {
          const candidate = text.slice(firstBrace, i + 1)
          try {
            return JSON.parse(candidate)
          } catch {
            break
          }
        }
      }
    }

    throw new Error(`CXCC 返回非规范 JSON：${text.slice(0, 200)}`)
  }
}

/**
 * PDF 二十二 selectRecordList：必须带 agent（0=不限）、projectId、应答时长区间、分页；
 * 不要传文档未列出的 agentNo，以免部分后端反序列化异常。
 * PDF 二十一 agentrecordList：字段略有不同。
 */
function buildCxccPostBody(
  path: string,
  params: FetchAgentRecordListParams
): Record<string, unknown> {
  const pageNum = params.pageNum
  const pageSize = params.pageSize
  const select = path.includes('selectRecordList')

  const agentInt = (): number => {
    if (params.agent === undefined || params.agent === '' || params.agent === 'all') return 0
    const n = typeof params.agent === 'string' ? parseInt(params.agent, 10) : Number(params.agent)
    return Number.isNaN(n) ? 0 : n
  }

  const projectInt =
    params.projectId !== undefined && params.projectId !== null && !Number.isNaN(Number(params.projectId))
      ? Number(params.projectId)
      : 0

  if (select) {
    const b: Record<string, unknown> = {
      pageNum,
      pageSize,
    }
    // 现场接口对 0 值较敏感：不传比传 0 更容易命中全量数据
    const ag = agentInt()
    if (ag !== 0) b.agent = ag
    if (projectInt !== 0) b.projectId = projectInt
    if (params.answerDurationStart !== undefined) b.answerDurationStart = params.answerDurationStart
    if (params.answerDurationEnd !== undefined) b.answerDurationEnd = params.answerDurationEnd
    if (params.calledPhone) b.calledPhone = params.calledPhone
    if (params.callingPhone) b.callingPhone = params.callingPhone
    if (params.startTime) b.startTime = params.startTime
    if (params.endTime) b.endTime = params.endTime
    return b
  }

  const b: Record<string, unknown> = { pageNum, pageSize }
  const ag = agentInt()
  if (ag !== 0) b.agent = ag
  if (projectInt !== 0) b.projectId = projectInt
  if (params.calledPhone) b.calledPhone = params.calledPhone
  if (params.callingPhone) b.callingPhone = params.callingPhone
  if (params.startTime) b.startTime = params.startTime
  if (params.endTime) b.endTime = params.endTime
  if (params.answerDurationStart !== undefined) b.answerDurationStart = params.answerDurationStart
  if (params.answerDurationEnd !== undefined) b.answerDurationEnd = params.answerDurationEnd
  return b
}

export async function fetchCxccAgentRecordList(
  params: FetchAgentRecordListParams,
  options?: { primaryPath?: string }
): Promise<{ records: CxccAgentRecordRaw[]; total: number; raw: unknown }> {
  const { baseUrl } = assertCxccConfigured()
  const token = await getValidToken()

  const candidates = buildCxccRecordListPathCandidates(options?.primaryPath)
  let lastError: Error | null = null

  console.log('[CXCC] 开始获取通话清单，尝试路径：', candidates)

  for (const path of candidates) {
    const reqBody = buildCxccPostBody(path, params)

    const url = `${baseUrl}${path}`
    let status: number
    let text: string
    try {
      if (process.env.CXCC_DEBUG_REQUEST === '1') {
        console.log('[CXCC] POST', url, reqBody)
      }
      console.log('[CXCC] 尝试路径：', path)
      const r = await cxccFetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authentication: token,
        },
        body: JSON.stringify(reqBody),
      })
      status = r.status
      text = r.text
      console.log('[CXCC] 路径', path, '返回状态：', status)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      lastError = new Error(`路径 ${path} 请求失败：${errorMsg}`)
      console.log('[CXCC] 路径', path, '请求失败：', errorMsg)
      continue
    }

    const looksLikeHtml = /^\s*</.test(text)

    if (status === 404 || (looksLikeHtml && status !== 200)) {
      lastError = new Error(`CXCC HTTP ${status}（路径 ${path}）：nginx/HTML 响应，多为路径不对`)
      console.log('[CXCC] 路径', path, '返回 404 或 HTML 响应')
      continue
    }

    if (status === 401) {
      // 401 未认证，尝试重新获取token
      console.log('[CXCC] 401未认证，尝试重新获取token...')
      try {
        const newToken = await getValidToken(true) // 强制刷新token
        // 使用新token重新请求
        console.log('[CXCC] 使用新token重新请求路径：', path)
        const r = await cxccFetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authentication: newToken,
          },
          body: JSON.stringify(reqBody),
        })
        status = r.status
        text = r.text
        console.log('[CXCC] 新token请求路径', path, '返回状态：', status)
        
        if (status < 200 || status >= 300) {
          throw new Error(
            `CXCC 请求失败 HTTP ${status}（路径 ${path}）：${text.slice(0, 200)}`
          )
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        throw new Error(
          `CXCC 请求失败 HTTP 401（路径 ${path}）：${errorMsg}`
        )
      }
    } else if (status < 200 || status >= 300) {
      throw new Error(
        `CXCC 请求失败 HTTP ${status}（路径 ${path}）：${text.slice(0, 200)}`
      )
    }

    let json: unknown
    try {
      json = safeParseCxccJson(text)
    } catch (e) {
      if (looksLikeHtml) {
        lastError = new Error(`CXCC 返回 HTML 非 JSON（路径 ${path}）`)
        console.log('[CXCC] 路径', path, '返回 HTML 非 JSON')
        continue
      }
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`CXCC 返回非 JSON：HTTP ${status} ${msg}`)
    }

    const parsed = parseAgentRecordListPayload(json)
    console.log('[CXCC] 路径', path, '请求成功，获取到', parsed.records.length, '条记录')
    return { records: parsed.records, total: parsed.total, raw: parsed.raw }
  }

  const errorMsg = lastError ? lastError.message : `所有路径均失败`
  console.error('[CXCC] 所有路径尝试失败：', errorMsg)
  throw (
    lastError ||
    new Error(
      `CXCC：已尝试路径 ${candidates.join(' → ')} 均失败。请在 .env 设置正确的 CXCC_AGENT_RECORD_LIST_PATH（PDF 二十一为 /om/agentrecordList/api，二十二为 …/selectRecordList/api）。`
    )
  )
}

function num(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** PDF: callState 0 未接 1 未转接 2 呼损 3 接通后挂断 */
export function cxccCallStateToCallStatus(callState: number | undefined): string {
  switch (callState) {
    case 0:
      return '呼出未接'
    case 1:
      return '呼出未接'
    case 2:
      return '呼出呼损'
    case 3:
      return '呼出正常通话'
    default:
      return '未知'
  }
}

export function cxccCallStateToConnectStatus(callState: number | undefined): string {
  if (callState === 3) return '已接通'
  return '未接通'
}

function callTypeLabel(callType: number | undefined): string {
  const map: Record<number, string> = {
    0: '固定并发',
    1: '比例外呼',
    2: '预览外呼',
    3: '智能外呼',
    4: '手拨',
    5: '呼入',
  }
  return callType !== undefined ? map[callType] ?? '外呼' : '外呼'
}

function hangUpLabel(hangUp: number | undefined): string {
  if (hangUp === 1) return '被叫挂断'
  return '主叫挂断'
}

export function mapCxccRecordToCallLog(r: CxccAgentRecordRaw, index: number) {
  const raw = r as Record<string, unknown>
  const callState =
    r.callState !== undefined
      ? num(r.callState)
      : raw.status !== undefined && raw.status !== ''
        ? num(raw.status)
        : undefined
  const id = r.uuid ? String(r.uuid) : `cxcc_${index}_${r.startTime ?? ''}`
  const agentName =
    r.agentName != null && String(r.agentName).trim() ? String(r.agentName) : ''
  return {
    id,
    agentCode: r.agent != null ? String(r.agent) : '',
    callMethod: callTypeLabel(r.callType !== undefined ? num(r.callType) : undefined),
    startTime: formatCxccDateTime(r.startTime),
    endTime: formatCxccDateTime(r.endTime),
    callerNumber: String(r.callingPhone ?? ''),
    calleeNumber: String(r.calledPhone ?? ''),
    callDuration: num(r.callDuration),
    ringDuration: num(r.ringingDuration),
    answerDuration: num(r.answerDuration),
    cost: num(r.cost),
    hangupReason: hangUpLabel(r.hangUp !== undefined ? num(r.hangUp) : undefined),
    callStatus: cxccCallStateToCallStatus(callState),
    trunkName: '',
    keyInfo: '',
    agentName,
    connectStatus: cxccCallStateToConnectStatus(callState),
  }
}

/** 与前端录音清单 statusMap 下标一致（PDF 二十二 status 字段） */
const CUSTOMER_STATUS_LABELS = [
  '未标记',
  '失败客户',
  '成功客户',
  '开场拒访',
  '秒挂无声',
  '办理互斥',
  '语音助手',
  '验证码失败',
  '高频骚扰',
] as const

function mapRecordingRowStatus(r: CxccAgentRecordRaw): { status: number; statusName: string } {
  const raw = r as Record<string, unknown>
  const st = raw.status
  if (st !== undefined && st !== null && st !== '') {
    const n = num(st)
    if (n >= 0 && n < CUSTOMER_STATUS_LABELS.length) {
      const nameFromApi =
        typeof raw.statusName === 'string' && raw.statusName.trim()
          ? String(raw.statusName)
          : CUSTOMER_STATUS_LABELS[n]
      return { status: n, statusName: nameFromApi }
    }
  }
  return mapCallStateToCustomerStatus(r.callState !== undefined ? num(r.callState) : undefined)
}

/** 录音清单页表格行（PDF 二十二：agentName、status、playUrl、qualityStatus） */
export function mapCxccRecordToRecordingRow(r: CxccAgentRecordRaw, index: number) {
  const raw = r as Record<string, unknown>
  const { status, statusName } = mapRecordingRowStatus(r)
  const taskLabel =
    r.companyName != null && String(r.companyName).trim()
      ? String(r.companyName)
      : r.taskId != null && String(r.taskId).trim()
        ? `任务 ${r.taskId}`
        : '-'
  return {
    id: r.uuid ?? `row_${index}`,
    uuid: r.uuid ? String(r.uuid) : '',
    taskName: taskLabel,
    agent: r.agent != null ? String(r.agent) : '',
    agentName: r.agentName != null && String(r.agentName).trim() ? String(r.agentName) : '',
    cityCode: '',
    cityName: '-',
    callingPhone: String(r.callingPhone ?? ''),
    calledPhone: String(r.calledPhone ?? ''),
    startTime: formatCxccDateTime(r.startTime),
    endTime: formatCxccDateTime(r.endTime),
    answerDuration: num(r.answerDuration),
    playUrl: typeof raw.playUrl === 'string' ? raw.playUrl : '',
    status,
    statusName,
    qualityStatus: num(raw.qualityStatus),
  }
}

function mapCallStateToCustomerStatus(callState: number | undefined): {
  status: number
  statusName: string
} {
  switch (callState) {
    case 3:
      return { status: 2, statusName: '接通' }
    case 2:
      return { status: 1, statusName: '呼损' }
    case 0:
    case 1:
      return { status: 3, statusName: '未接' }
    default:
      return { status: 0, statusName: '未标记' }
  }
}

function formatCxccDateTime(s: string | undefined): string {
  if (!s) return ''
  return String(s).replace('T', ' ').substring(0, 19)
}

/** 转换为录音清单格式 */
export function mapCxccRecordToRecording(r: CxccAgentRecordRaw, index: number) {
  const raw = r as Record<string, unknown>
  const { status, statusName } = mapRecordingRowStatus(r)
  const startTime = formatCxccDateTime(r.startTime)
  return {
    uuid: r.uuid ? String(r.uuid) : '',
    company_id: null,
    project_id: r.projectId != null ? Number(r.projectId) : null,
    task_id: r.taskId != null ? Number(r.taskId) : null,
    agent: r.agent != null ? String(r.agent) : null,
    agent_name: r.agentName != null && String(r.agentName).trim() ? String(r.agentName) : null,
    calling_phone: String(r.callingPhone ?? ''),
    called_phone: String(r.calledPhone ?? ''),
    start_time: startTime,
    end_time: formatCxccDateTime(r.endTime),
    answer_duration: num(r.answerDuration),
    play_url: typeof raw.playUrl === 'string' ? raw.playUrl : null,
    status: status,
    status_name: statusName,
    quality_status: num(raw.qualityStatus),
    sync_time: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}
