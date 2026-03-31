import { NextRequest, NextResponse } from 'next/server'
import https from 'node:https'

function normalizePath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`
}

function getEnv() {
  const baseUrl = (process.env.CXCC_BASE_URL || '').replace(/\/$/, '')
  const token = process.env.CXCC_AUTH_TOKEN || ''
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

type AgentPayload = {
  list: Record<string, unknown>[]
  total: number
  pages: number
  size: number
  current: number
}

function parseAgentListPayload(json: unknown): AgentPayload {
  const root = json as Record<string, unknown>
  const code = root.code
  if (
    code !== undefined &&
    code !== null &&
    code !== 0 &&
    code !== '0' &&
    code !== 200 &&
    code !== '200'
  ) {
    throw new Error(`${String(root.message || 'CXCC allAgent 接口返回错误')} (code=${String(code)})`)
  }

  const data = (root.data ?? root.result) as unknown
  if (Array.isArray(data)) {
    return {
      list: data as Record<string, unknown>[],
      total: (data as unknown[]).length,
      pages: 1,
      size: (data as unknown[]).length,
      current: 1,
    }
  }
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, pages: 0, size: 0, current: 1 }
  }

  const d = data as Record<string, unknown>
  const list = (d.records ?? d.rows ?? d.list ?? d.content ?? d.data ?? []) as unknown
  const arr = Array.isArray(list) ? (list as Record<string, unknown>[]) : []
  return {
    list: arr,
    total: Number(d.total ?? d.totalCount ?? arr.length) || 0,
    pages: Number(d.pages ?? 1) || 1,
    size: Number(d.size ?? arr.length) || arr.length,
    current: Number(d.current ?? 1) || 1,
  }
}

function containsKeyword(row: Record<string, unknown>, keyword: string): boolean {
  if (!keyword) return true
  const k = keyword.toLowerCase()
  const probes = [
    row.agent,
    row.agentNo,
    row.workNumber,
    row.username,
    row.realname,
    row.name,
    row.agentName,
    row.extension,
  ]
  return probes.some((v) => String(v ?? '').toLowerCase().includes(k))
}

export async function GET(request: NextRequest) {
  try {
    const { baseUrl, token } = getEnv()
    if (!baseUrl || !token) {
      throw new Error('请配置 CXCC_BASE_URL 与 CXCC_AUTH_TOKEN')
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.max(1, Number(searchParams.get('pageSize') || '20'))
    const keyword = (searchParams.get('keyword') || '').trim()

    const path = normalizePath('/am/agent/allAgent')
    const url = `${baseUrl}${path}`

    async function fetchPage(pageNum: number, pageReqSize: number): Promise<AgentPayload> {
      const { status, text } = await postCxcc(
        url,
        {
          pageNum,
          pageSize: pageReqSize,
        },
        token
      )
      if (status < 200 || status >= 300) {
        throw new Error(`CXCC 请求失败 HTTP ${status}: ${text.slice(0, 200)}`)
      }
      let json: unknown
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        throw new Error(`CXCC 返回非 JSON：HTTP ${status} ${text.slice(0, 200)}`)
      }
      return parseAgentListPayload(json)
    }

    // allAgent 默认只返回 10 条，按页拉全量避免“列表不完整”
    const upstreamPageSize = 200
    const first = await fetchPage(1, upstreamPageSize)
    let rows = [...first.list]
    const totalPages = Math.max(1, first.pages)
    if (totalPages > 1) {
      for (let p = 2; p <= totalPages; p++) {
        const item = await fetchPage(p, upstreamPageSize)
        rows.push(...item.list)
      }
    }

    if (keyword) rows = rows.filter((r) => containsKeyword(r, keyword))

    const from = (page - 1) * pageSize
    const paged = rows.slice(from, from + pageSize)

    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data: {
        list: paged,
        total: rows.length,
        page,
        pageSize,
        meta: {
          source: 'cxcc',
          path: '/am/agent/allAgent',
        },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        code: 502,
        error: 'CXCC_AGENTS_FAILED',
        message: msg,
      },
      { status: 502 }
    )
  }
}
