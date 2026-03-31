import https from 'node:https'
import { getValidToken } from '@/lib/cxcc-auth'

type PagedPayload = {
  list: Record<string, unknown>[]
  pages: number
}

function normalizePath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`
}

export function getCxccEnv() {
  const baseUrl = (process.env.CXCC_BASE_URL || '').replace(/\/$/, '')
  const token = process.env.CXCC_AUTH_TOKEN || ''
  if (!baseUrl || !token) {
    throw new Error('请配置 CXCC_BASE_URL 与 CXCC_AUTH_TOKEN')
  }
  return { baseUrl, token }
}

export async function postCxcc(url: string, body: Record<string, unknown>, token: string) {
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
  if (Array.isArray(data)) return { list: data as Record<string, unknown>[], pages: 1 }
  if (!data || typeof data !== 'object') return { list: [], pages: 0 }
  const d = data as Record<string, unknown>
  const list = (d.records ?? d.rows ?? d.list ?? d.content ?? d.data ?? []) as unknown
  const arr = Array.isArray(list) ? (list as Record<string, unknown>[]) : []
  const pages = Number(d.pages ?? 1) || 1
  return { list: arr, pages }
}

export async function fetchAllCxccTeamsRaw(maxPages = 20, pageSize = 100): Promise<Record<string, unknown>[]> {
  const { baseUrl } = getCxccEnv()
  const token = await getValidToken()
  const url = `${baseUrl}${normalizePath('/am/skillGroup/selectPage')}`
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
  return rows
}

export async function fetchAllCxccAgentsRaw(maxPages = 30, pageSize = 200): Promise<Record<string, unknown>[]> {
  const { baseUrl } = getCxccEnv()
  const token = await getValidToken()
  const url = `${baseUrl}${normalizePath('/am/agent/allAgent')}`
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
  return rows
}
