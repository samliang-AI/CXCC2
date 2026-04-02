import { NextRequest, NextResponse } from 'next/server'
import https from 'node:https'
import { loginToCxcc, getValidToken, clearTokenCache } from '@/lib/cxcc-auth'
import {
  fetchCxccAgentRecordList,
  mapCxccRecordToCallLog,
  mapCxccRecordToRecordingRow,
  mapCxccRecordToRecording
} from '@/lib/cxcc-agent-record-list'
import { upsertLocalCallLogs } from '@/lib/local-call-log-store-optimized'
import { upsertLocalRecordings } from '@/lib/local-recording-store-optimized'

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

async function handleAgents(request: NextRequest) {
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

async function handleTeams(request: NextRequest) {
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

async function handleLogin(request: NextRequest, method: string) {
  try {
    if (method === 'POST') {
      const body = await request.json()
      const { username, password, companyName } = body

      const loginUsername = username || process.env.CXCC_USERNAME || 'admin'
      const loginPassword = password || process.env.CXCC_PASSWORD || 'gzxr147++'
      const loginCompanyName = companyName || process.env.CXCC_COMPANY_NAME || '广州新瑞'

      const baseUrl = (process.env.CXCC_BASE_URL || 'https://1.14.207.148:9526').replace(/\/$/, '')
      const loginUrl = `${baseUrl}/system/login`

      const loginBody = {
        companyName: loginCompanyName,
        password: loginPassword,
        username: loginUsername,
      }

      console.log('[API] /api/cxcc?action=login 正在调用 CXCC 登录接口...')

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginBody),
      })

      const text = await response.text()

      if (!response.ok) {
        console.error('[API] /api/cxcc?action=login 登录失败:', response.status, text)
        return NextResponse.json(
          { success: false, error: `登录失败: HTTP ${response.status}`, details: text },
          { status: response.status }
        )
      }

      let data: { code?: number; msg?: string; data?: { token?: string } }
      try {
        data = JSON.parse(text)
      } catch {
        return NextResponse.json(
          { success: false, error: '登录响应解析失败', raw: text },
          { status: 500 }
        )
      }

      if (data.code !== 0 && data.code !== 200) {
        return NextResponse.json(
          { success: false, error: data.msg || '登录失败', code: data.code },
          { status: 400 }
        )
      }

      if (!data.data?.token) {
        return NextResponse.json(
          { success: false, error: '登录响应中未找到 token', raw: data },
          { status: 500 }
        )
      }

      await loginToCxcc()

      return NextResponse.json({
        success: true,
        message: '登录成功',
        token: data.data.token,
      })
    } else if (method === 'GET') {
      const token = await getValidToken(false)
      return NextResponse.json({
        success: true,
        authenticated: true,
        hasToken: !!token,
        token: token ? token.substring(0, 20) + '...' : null,
      })
    } else if (method === 'DELETE') {
      clearTokenCache()
      return NextResponse.json({
        success: true,
        message: '已清除 token 缓存',
      })
    }
  } catch (error: any) {
    console.error('[API] /api/cxcc?action=login error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '登录失败' },
      { status: 500 }
    )
  }
}

async function handleCallLogs(request: NextRequest, method: string) {
  try {
    if (method === 'POST') {
      const body = await request.json()

      const {
        pageNum = 1,
        pageSize = 20,
        agentNo = '',
        projectId = '',
        startTime = '',
        endTime = '',
        callingPhone = '',
        calledPhone = '',
      } = body

      const { records, total } = await fetchCxccAgentRecordList({
        pageNum,
        pageSize,
        agent: agentNo || undefined,
        projectId:
          projectId !== '' && projectId !== null && projectId !== undefined
            ? Number(projectId)
            : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        callingPhone: callingPhone || undefined,
        calledPhone: calledPhone || undefined,
      }, {
        primaryPath: '/om/agentrecordList/api'
      })

      const callLogs = records.map((record, index) => mapCxccRecordToCallLog(record, index))

      return NextResponse.json({
        code: 0,
        message: 'OK',
        rows: callLogs,
        total,
        page: pageNum,
        pageSize,
      })
    }
  } catch (error) {
    console.error('[API] /api/cxcc?action=call-logs error:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      {
        code: 500,
        message: `查询失败：${errorMessage}`,
        rows: [],
        total: 0,
      },
      { status: 500 }
    )
  }
}

async function handleRecordings(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const agent = searchParams.get('agent')
    const projectId = searchParams.get('projectId')
    const calledPhone = searchParams.get('calledPhone')
    const callingPhone = searchParams.get('callingPhone')
    
    let targetStartTime, targetEndTime
    if (startTime && endTime) {
      targetStartTime = startTime
      targetEndTime = endTime
    } else if (date) {
      targetStartTime = `${date} 00:00:00`
      targetEndTime = `${date} 23:59:59`
    } else {
      const today = new Date().toISOString().split('T')[0]
      targetStartTime = `${today} 00:00:00`
      targetEndTime = `${today} 23:59:59`
    }
    
    const params: {
      pageNum: number;
      pageSize: number;
      startTime: string;
      endTime: string;
      agent?: string;
      projectId?: number;
      calledPhone?: string;
      callingPhone?: string;
    } = {
      pageNum: page,
      pageSize: pageSize,
      startTime: targetStartTime,
      endTime: targetEndTime
    }
    
    if (agent) {
      params.agent = agent
    }
    
    if (projectId) {
      params.projectId = parseInt(projectId)
    }
    
    if (calledPhone) {
      params.calledPhone = calledPhone
    }
    
    if (callingPhone) {
      params.callingPhone = callingPhone
    }
    
    const { records, total } = await fetchCxccAgentRecordList(params)
    const processedRecords = records.map((record: any, index: number) => mapCxccRecordToRecordingRow(record, index))
    
    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: {
        records: processedRecords,
        total,
        page,
        pageSize,
        dataSource: 'CXCC API 实时查询'
      },
      rows: processedRecords,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('实时查询录音清单数据失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      {
        code: 500,
        message: `实时查询失败：${errorMessage}`,
        data: {
          records: [],
          total: 0,
          page: 1,
          pageSize: 10
        },
        rows: [],
        total: 0,
        page: 1,
        pageSize: 10,
      },
      { status: 500 }
    )
  }
}

async function handleCallLogsUpdateLocal(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      pageNum = 1,
      pageSize = 100000,
      agentNo = '',
      projectId = '',
      startTime = '',
      endTime = '',
      callingPhone = '',
      calledPhone = '',
    } = body

    const { records, total } = await fetchCxccAgentRecordList({
      pageNum,
      pageSize,
      agent: agentNo || undefined,
      projectId:
        projectId !== '' && projectId !== null && projectId !== undefined
          ? Number(projectId)
          : undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      callingPhone: callingPhone || undefined,
      calledPhone: calledPhone || undefined,
    }, {
      primaryPath: '/om/agentrecordList/api'
    })

    const callLogs = records.map((record, index) => mapCxccRecordToCallLog(record, index))

    const upsertedCount = await upsertLocalCallLogs(callLogs, {
      batchSize: 10000
    })

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: {
        total: total,
        upserted: upsertedCount,
        message: `成功更新本地文件，共处理 ${callLogs.length} 条记录，写入 ${upsertedCount} 条记录`
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('通话清单（CXCC）更新本地文件错误:', error)
    return NextResponse.json(
      {
        code: -1,
        error: 'CXCC_CALL_LOGS_UPDATE_FAILED',
        message: msg,
        details: msg,
      },
      { status: 502 }
    )
  }
}

async function handleRecordingsUpdateLocal(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      pageNum = 1,
      pageSize = 100000,
      agentNo = '',
      projectId = '',
      startTime = '',
      endTime = '',
      callingPhone = '',
      calledPhone = '',
    } = body

    const { records, total } = await fetchCxccAgentRecordList({
      pageNum,
      pageSize,
      agent: agentNo || undefined,
      projectId:
        projectId !== '' && projectId !== null && projectId !== undefined
          ? Number(projectId)
          : undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      callingPhone: callingPhone || undefined,
      calledPhone: calledPhone || undefined,
    }, {
      primaryPath: '/om/agentCalldetailList/selectRecordList/api'
    })

    const recordings = records.map((record, index) => mapCxccRecordToRecording(record, index))

    console.log(`[录音清单更新] 开始更新本地文件，获取到 ${recordings.length} 条记录`);
    
    const upsertedCount = await upsertLocalRecordings(recordings, {
      batchSize: 10000,
      onlyAddNew: true
    })
    
    console.log(`[录音清单更新] 完成更新，新增 ${upsertedCount} 条记录`);

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: {
        total: total,
        upserted: upsertedCount,
        message: `成功更新本地文件，新增 ${upsertedCount} 条记录（只添加新录音，不覆盖已有数据）`
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('录音清单（CXCC）更新本地文件错误:', error)
    return NextResponse.json(
      {
        code: -1,
        error: 'CXCC_RECORDINGS_UPDATE_FAILED',
        message: msg,
        details: msg,
      },
      { status: 502 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  switch (action) {
    case 'agents':
      return handleAgents(request)
    case 'teams':
      return handleTeams(request)
    case 'login':
      return handleLogin(request, 'GET')
    case 'recordings':
      return handleRecordings(request)
    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: agents, teams, login, recordings' },
        { status: 400 }
      )
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  switch (action) {
    case 'login':
      return handleLogin(request, 'POST')
    case 'call-logs':
      return handleCallLogs(request, 'POST')
    case 'call-logs-update':
      return handleCallLogsUpdateLocal(request)
    case 'recordings-update':
      return handleRecordingsUpdateLocal(request)
    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: login, call-logs, call-logs-update, recordings-update' },
        { status: 400 }
      )
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'login') {
    return handleLogin(request, 'DELETE')
  }

  return NextResponse.json(
    { error: 'Invalid action. Only login action supports DELETE method' },
    { status: 400 }
  )
}
