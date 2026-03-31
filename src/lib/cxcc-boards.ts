import https from 'node:https'
import { CxccAgentRecordRaw, fetchCxccAgentRecordList } from '@/lib/cxcc-agent-record-list'
import { getValidToken } from '@/lib/cxcc-auth'

type PagedPayload = {
  list: Record<string, unknown>[]
  total: number
  pages: number
  current: number
  size: number
}

export type CxccAgentDim = {
  agentCode: string
  agentName: string
  teamId: string
  teamName: string
}

export type CxccTeamDim = {
  teamId: string
  teamName: string
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalizePath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`
}

function getEnv() {
  const baseUrl = (process.env.CXCC_BASE_URL || '').replace(/\/$/, '')
  const token = process.env.CXCC_AUTH_TOKEN || ''
  if (!baseUrl || !token) {
    throw new Error('请配置 CXCC_BASE_URL 与 CXCC_AUTH_TOKEN')
  }
  return { baseUrl, token }
}

async function postCxcc(url: string, body: Record<string, unknown>, token: string) {
  const isHttps = url.startsWith('https://')
  const skipTls = process.env.CXCC_INSECURE_SKIP_TLS !== '0' && isHttps

  if (skipTls) {
    const agent = new https.Agent({ rejectUnauthorized: false })
    return new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authentication: token,
          },
          agent,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              text: Buffer.concat(chunks).toString('utf8'),
            })
          )
        }
      )
      req.on('error', reject)
      req.write(JSON.stringify(body))
      req.end()
    })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authentication: token,
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, text: await res.text() }
}

function parsePagedPayload(json: unknown): PagedPayload {
  const root = json as Record<string, unknown>
  const code = root.code
  if (code !== undefined && code !== null && code !== 0 && code !== '0' && code !== 200 && code !== '200') {
    throw new Error(`${String(root.message || 'CXCC 接口返回错误')} (code=${String(code)})`)
  }
  const data = (root.data ?? root.result) as unknown
  if (Array.isArray(data)) {
    return {
      list: data as Record<string, unknown>[],
      total: data.length,
      pages: 1,
      current: 1,
      size: data.length,
    }
  }
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, pages: 0, current: 1, size: 0 }
  }
  const d = data as Record<string, unknown>
  const list = (d.records ?? d.rows ?? d.list ?? d.content ?? d.data ?? []) as unknown
  const arr = Array.isArray(list) ? (list as Record<string, unknown>[]) : []
  const total = Number(d.total ?? d.totalCount ?? arr.length) || 0
  const pages = Number(d.pages ?? (d.size ? Math.ceil(total / Number(d.size)) : 1)) || 1
  const current = Number(d.current ?? 1) || 1
  const size = Number(d.size ?? arr.length) || arr.length
  return { list: arr, total, pages, current, size }
}

export async function fetchAllCxccRecordsInRange(input: {
  startTime: string
  endTime: string
  primaryPath?: string
  pageSize?: number
  maxPages?: number
}): Promise<CxccAgentRecordRaw[]> {
  const pageSize = input.pageSize ?? 200
  const maxPages = input.maxPages ?? 20
  const first = await fetchCxccAgentRecordList(
    {
      pageNum: 1,
      pageSize,
      startTime: input.startTime,
      endTime: input.endTime,
    },
    input.primaryPath ? { primaryPath: input.primaryPath } : undefined
  )
  const all = [...first.records]
  const totalPages = Math.max(1, Math.ceil((first.total || first.records.length) / pageSize))
  const cappedPages = Math.min(totalPages, maxPages)
  for (let p = 2; p <= cappedPages; p++) {
    const part = await fetchCxccAgentRecordList(
      {
        pageNum: p,
        pageSize,
        startTime: input.startTime,
        endTime: input.endTime,
      },
      input.primaryPath ? { primaryPath: input.primaryPath } : undefined
    )
    all.push(...part.records)
  }
  return all
}

export async function fetchAllCxccAgents(maxPages = 20): Promise<CxccAgentDim[]> {
  const { baseUrl } = getEnv()
  const token = await getValidToken()
  const url = `${baseUrl}${normalizePath('/am/agent/allAgent')}`
  const pageSize = 200
  const firstResp = await postCxcc(url, { pageNum: 1, pageSize }, token)
  if (firstResp.status < 200 || firstResp.status >= 300) {
    throw new Error(`CXCC allAgent 请求失败 HTTP ${firstResp.status}: ${firstResp.text.slice(0, 200)}`)
  }
  const first = parsePagedPayload(JSON.parse(firstResp.text || '{}'))
  const rows = [...first.list]
  const cappedPages = Math.min(Math.max(1, first.pages), maxPages)
  for (let p = 2; p <= cappedPages; p++) {
    const resp = await postCxcc(url, { pageNum: p, pageSize }, token)
    if (resp.status < 200 || resp.status >= 300) break
    const page = parsePagedPayload(JSON.parse(resp.text || '{}'))
    rows.push(...page.list)
  }

  return rows.map((r) => {
    const agentCode = String(r.username ?? r.agent ?? r.agentNo ?? r.workNumber ?? '').trim()
    const teamId = String(r.skillgroupId ?? r.teamId ?? '').trim()
    return {
      agentCode,
      agentName: String(r.name ?? r.agentName ?? r.realname ?? agentCode).trim(),
      teamId,
      teamName: String(r.skillGroupName ?? r.teamName ?? teamId).trim(),
    }
  })
}

export async function fetchAllCxccTeams(maxPages = 10): Promise<CxccTeamDim[]> {
  const { baseUrl } = getEnv()
  const token = await getValidToken()
  const url = `${baseUrl}${normalizePath('/am/skillGroup/selectPage')}`
  const pageSize = 100
  const firstResp = await postCxcc(url, { pageNum: 1, pageSize }, token)
  if (firstResp.status < 200 || firstResp.status >= 300) {
    throw new Error(`CXCC skillGroup 请求失败 HTTP ${firstResp.status}: ${firstResp.text.slice(0, 200)}`)
  }
  const first = parsePagedPayload(JSON.parse(firstResp.text || '{}'))
  const rows = [...first.list]
  const cappedPages = Math.min(Math.max(1, first.pages), maxPages)
  for (let p = 2; p <= cappedPages; p++) {
    const resp = await postCxcc(url, { pageNum: p, pageSize }, token)
    if (resp.status < 200 || resp.status >= 300) break
    const page = parsePagedPayload(JSON.parse(resp.text || '{}'))
    rows.push(...page.list)
  }
  return rows.map((r) => ({
    teamId: String(r.id ?? r.skillgroupId ?? r.teamId ?? '').trim(),
    teamName: String(r.skillGroupName ?? r.name ?? r.teamName ?? '').trim(),
  }))
}

export function normalizeDateRange(startDate: Date, endDate: Date): { startTime: string; endTime: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return {
    startTime: `${fmt(startDate)} 00:00:00`,
    endTime: `${fmt(endDate)} 23:59:59`,
  }
}

export function dateKey(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

export function extractAgentCode(r: Record<string, unknown>): string {
  return String(r.agent ?? r.agentNo ?? r.username ?? r.workNumber ?? '').trim()
}

export function extractStatusName(r: Record<string, unknown>): string {
  return String(r.statusName ?? r.status_name ?? '').trim()
}

export function isSuccessRecord(r: Record<string, unknown>): boolean {
  const sName = extractStatusName(r)
  if (sName.includes('成功')) return true
  const status = toNum(r.status)
  return status === 2
}

export function isConnectedRecord(r: Record<string, unknown>): boolean {
  const state = toNum(r.callState)
  if (state === 3) return true
  return toNum(r.answerDuration) > 0 || toNum(r.answer_duration) > 0
}

export function qualityBucket(r: Record<string, unknown>): '优秀' | '良好' | '合格' | '不合格' {
  const q = toNum(r.qualityStatus ?? r.quality_status ?? r.qualityResult)
  if (q >= 3) return '优秀'
  if (q >= 2) return '良好'
  if (q >= 1) return '合格'
  return '不合格'
}
