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

function parseListPayload(json: unknown): { list: Record<string, unknown>[]; total: number } {
  const root = json as Record<string, unknown>
  const code = root.code
  if (code !== undefined && code !== null && code !== 0 && code !== '0' && code !== 200 && code !== '200') {
    throw new Error(`${String(root.message || 'CXCC skillGroup 接口返回错误')} (code=${String(code)})`)
  }

  const data = (root.data ?? root.result) as Record<string, unknown> | unknown[] | undefined
  if (Array.isArray(data)) {
    return { list: data as Record<string, unknown>[], total: data.length }
  }
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0 }
  }

  const d = data as Record<string, unknown>
  const list = (d.records ?? d.rows ?? d.list ?? d.content ?? []) as unknown
  const arr = Array.isArray(list) ? (list as Record<string, unknown>[]) : []
  const total = Number(d.total ?? d.totalCount ?? d.totalElements ?? d.count ?? arr.length) || 0
  return { list: arr, total }
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

    const path = normalizePath('/am/skillGroup/selectPage')
    const url = `${baseUrl}${path}`
    const body: Record<string, unknown> = {
      pageNum: page,
      pageSize,
    }
    if (keyword) body.name = keyword

    const { status, text } = await postCxcc(url, body, token)
    if (status < 200 || status >= 300) {
      throw new Error(`CXCC 请求失败 HTTP ${status}: ${text.slice(0, 200)}`)
    }

    let json: unknown
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      throw new Error(`CXCC 返回非 JSON：HTTP ${status} ${text.slice(0, 200)}`)
    }

    const parsed = parseListPayload(json)
    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data: {
        list: parsed.list,
        total: parsed.total,
        page,
        pageSize,
        meta: {
          source: 'cxcc',
          path: '/am/skillGroup/selectPage',
        },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        code: 502,
        error: 'CXCC_TEAMS_FAILED',
        message: msg,
      },
      { status: 502 }
    )
  }
}
