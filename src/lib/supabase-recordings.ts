/**
 * 从 Supabase qms_recording_list / qms_quality_score 查询录音与质检数据
 */
import { getSupabaseClient } from '@/storage/database/supabase-client'

export function parseNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export type RecordingRow = {
  id: number
  uuid: string
  agent: string | null
  agent_name: string | null
  calling_phone: string | null
  called_phone: string | null
  start_time: string | null
  end_time: string | null
  answer_duration: number | string | null
  status: number | null
  status_name: string | null
  city_code?: string | null
  city_name?: string | null
}

const STATUS_NAMES = [
  '成功客户',
  '失败客户',
  '开场拒访',
  '秒挂无声',
  '办理互斥',
  '语音助手',
  '验证码失败',
  '高频骚扰',
  '未标记',
] as const

export async function fetchRecordingsWithCity(params: {
  startDate: Date
  endDate: Date
  cityCode?: string
  agent?: string
  page?: number
  pageSize?: number
}): Promise<{
  rows: RecordingRow[]
  total: number
  cityMap: Map<string, { cityCode: string; cityName: string }>
}> {
  const supabase = getSupabaseClient()
  const startIso = params.startDate.toISOString()
  const endIso = params.endDate.toISOString()

  // 若有 cityCode 筛选，先从 qms_quality_score 取 recording_uuid
  let uuidFilter: string[] | null = null
  if (params.cityCode) {
    const { data: qRows } = await supabase
      .from('qms_quality_score')
      .select('recording_uuid')
      .eq('city_code', params.cityCode)
    uuidFilter = (qRows || []).map((r: { recording_uuid: string }) => r.recording_uuid)
    if (uuidFilter.length === 0) {
      return { rows: [], total: 0, cityMap: new Map() }
    }
  }

  let q = supabase
    .from('qms_recording_list')
    .select('id, uuid, agent, agent_name, calling_phone, called_phone, start_time, end_time, answer_duration, status, status_name', { count: 'exact' })
    .gte('start_time', startIso)
    .lte('start_time', endIso)

  if (params.agent) {
    q = q.eq('agent', params.agent)
  }
  if (uuidFilter && uuidFilter.length > 0) {
    q = q.in('uuid', uuidFilter)
  }

  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  q = q.order('start_time', { ascending: false }).range(from, to)

  const { data: rows, count, error } = await q

  if (error) throw error

  const recs = (rows || []) as Array<Record<string, unknown>>
  const uuids = recs.map((r) => r.uuid as string).filter(Boolean)

  const cityMap = new Map<string, { cityCode: string; cityName: string }>()
  if (uuids.length > 0) {
    const { data: qRows } = await supabase
      .from('qms_quality_score')
      .select('recording_uuid, city_code, city_name')
      .in('recording_uuid', uuids)
    for (const r of qRows || []) {
      const u = (r as { recording_uuid: string; city_code?: string; city_name?: string }).recording_uuid
      if (u) {
        cityMap.set(u, {
          cityCode: (r as { city_code?: string }).city_code || '',
          cityName: (r as { city_name?: string }).city_name || '',
        })
      }
    }
  }

  const enriched: RecordingRow[] = recs.map((r) => {
    const uuid = r.uuid as string
    const city = cityMap.get(uuid)
    return {
      id: parseNum(r.id),
      uuid,
      agent: (r.agent as string) ?? null,
      agent_name: (r.agent_name as string) ?? null,
      calling_phone: (r.calling_phone as string) ?? null,
      called_phone: (r.called_phone as string) ?? null,
      start_time: (r.start_time as string) ?? null,
      end_time: (r.end_time as string) ?? null,
      answer_duration: r.answer_duration as string | number | null,
      status: (r.status as number) ?? null,
      status_name: (r.status_name as string) ?? null,
      city_code: city?.cityCode,
      city_name: city?.cityName,
    }
  })

  return {
    rows: enriched,
    total: count ?? 0,
    cityMap,
  }
}

/** 取全部录音（无分页），用于报表聚合 */
export async function fetchAllRecordingsInRange(params: {
  startDate: Date
  endDate: Date
  cityCode?: string
  agent?: string
}): Promise<RecordingRow[]> {
  const supabase = getSupabaseClient()
  const startIso = params.startDate.toISOString()
  const endIso = params.endDate.toISOString()

  let uuidFilter: string[] | null = null
  if (params.cityCode) {
    const { data: qRows } = await supabase
      .from('qms_quality_score')
      .select('recording_uuid')
      .eq('city_code', params.cityCode)
    uuidFilter = (qRows || []).map((r: { recording_uuid: string }) => r.recording_uuid)
    if (uuidFilter.length === 0) return []
  }

  let q = supabase
    .from('qms_recording_list')
    .select('id, uuid, agent, agent_name, calling_phone, called_phone, start_time, end_time, answer_duration, status, status_name')
    .gte('start_time', startIso)
    .lte('start_time', endIso)

  if (params.agent) q = q.eq('agent', params.agent)
  if (uuidFilter && uuidFilter.length > 0) q = q.in('uuid', uuidFilter)

  const { data: rows, error } = await q.order('start_time', { ascending: false }).limit(5000)

  if (error) throw error

  const recs = (rows || []) as Array<Record<string, unknown>>
  const uuids = recs.map((r) => r.uuid as string).filter(Boolean)
  const cityMap = new Map<string, { cityCode: string; cityName: string }>()

  if (uuids.length > 0) {
    const { data: qRows } = await supabase
      .from('qms_quality_score')
      .select('recording_uuid, city_code, city_name')
      .in('recording_uuid', uuids)
    for (const r of qRows || []) {
      const u = (r as { recording_uuid: string }).recording_uuid
      if (u) {
        cityMap.set(u, {
          cityCode: (r as { city_code?: string }).city_code || '',
          cityName: (r as { city_name?: string }).city_name || '',
        })
      }
    }
  }

  return recs.map((r) => {
    const uuid = r.uuid as string
    const city = cityMap.get(uuid)
    return {
      id: parseNum(r.id),
      uuid,
      agent: (r.agent as string) ?? null,
      agent_name: (r.agent_name as string) ?? null,
      calling_phone: (r.calling_phone as string) ?? null,
      called_phone: (r.called_phone as string) ?? null,
      start_time: (r.start_time as string) ?? null,
      end_time: (r.end_time as string) ?? null,
      answer_duration: r.answer_duration as string | number | null,
      status: (r.status as number) ?? null,
      status_name: (r.status_name as string) ?? null,
      city_code: city?.cityCode,
      city_name: city?.cityName,
    }
  }) as RecordingRow[]
}

export function isConnected(row: RecordingRow): boolean {
  return parseNum(row.answer_duration) > 0
}

export function toConnectStatus(row: RecordingRow): string {
  return isConnected(row) ? '已接通' : '未接通'
}

export function toCallStatus(row: RecordingRow): string {
  if (isConnected(row)) return '呼出正常通话'
  return '呼出未接'
}

/** 从 qms_city_info 取地市列表，失败或空时用默认 */
export async function fetchCities(): Promise<{ code: string; name: string }[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('qms_city_info')
      .select('city_code, city_name')
      .eq('status', 1)
    if (error || !data?.length) return FALLBACK_CITIES
    return data.map((r: { city_code: string; city_name: string }) => ({
      code: r.city_code,
      name: r.city_name,
    }))
  } catch {
    return FALLBACK_CITIES
  }
}

const FALLBACK_CITIES = [
  { code: '4401', name: '广州' }, { code: '4403', name: '深圳' }, { code: '4404', name: '珠海' },
  { code: '4405', name: '汕头' }, { code: '4406', name: '佛山' }, { code: '4407', name: '江门' },
  { code: '4408', name: '湛江' }, { code: '4409', name: '茂名' }, { code: '4412', name: '肇庆' },
  { code: '4413', name: '惠州' }, { code: '4414', name: '梅州' }, { code: '4415', name: '汕尾' },
  { code: '4416', name: '河源' }, { code: '4417', name: '阳江' }, { code: '4418', name: '清远' },
  { code: '4419', name: '东莞' }, { code: '4420', name: '中山' }, { code: '4451', name: '潮州' },
  { code: '4452', name: '揭阳' }, { code: '4453', name: '云浮' }, { code: '4421', name: '韶关' },
]

export const FALLBACK_CITIES_LIST = FALLBACK_CITIES

export const FALLBACK_TEAMS = [
  { id: 'T001', name: '广东升档组-登封' }, { id: 'T002', name: '广东升档组-云晟' },
  { id: 'T003', name: '广东升档组-如皓' }, { id: 'T004', name: '广东升档组-诚聚' },
  { id: 'T005', name: '广东升档组-佳硕' }, { id: 'T006', name: '广东升档组-聚能' },
  { id: 'T007', name: '佛山升档组-腾飞' }, { id: 'T008', name: '深圳升档组-飞越' },
]

export const FALLBACK_AGENTS = [
  { code: 'A001', name: '林宇君', teamId: 'T001' }, { code: 'A002', name: '刘土梅', teamId: 'T001' },
  { code: 'A003', name: '张小明', teamId: 'T002' }, { code: 'A004', name: '李小红', teamId: 'T002' },
  { code: 'A005', name: '王大伟', teamId: 'T003' }, { code: 'A006', name: '陈小芳', teamId: 'T003' },
  { code: 'A007', name: '赵大力', teamId: 'T004' }, { code: 'A008', name: '周小敏', teamId: 'T004' },
  { code: 'A009', name: '吴小华', teamId: 'T005' }, { code: 'A010', name: '郑小强', teamId: 'T005' },
  { code: 'A011', name: '黄小燕', teamId: 'T006' }, { code: 'A012', name: '杨小龙', teamId: 'T006' },
  { code: 'A013', name: '何小军', teamId: 'T007' }, { code: 'A014', name: '罗小玲', teamId: 'T007' },
  { code: 'A015', name: '马小虎', teamId: 'T008' }, { code: 'A016', name: '朱小娟', teamId: 'T008' },
]

/** 按 agent + 日期聚合，用于团队/坐席报表 */
export function aggregateByAgentAndDate(rows: RecordingRow[]) {
  const byAgentDate = new Map<
    string,
    Map<string, { total: number; connected: number; success: number }>
  >()
  for (const r of rows) {
    const agent = (r.agent || r.agent_name || 'unknown').toString()
    const date = r.start_time ? r.start_time.split('T')[0] : ''
    if (!date) continue
    if (!byAgentDate.has(agent)) {
      byAgentDate.set(agent, new Map())
    }
    const dateMap = byAgentDate.get(agent)!
    if (!dateMap.has(date)) dateMap.set(date, { total: 0, connected: 0, success: 0 })
    const b = dateMap.get(date)!
    b.total += 1
    if (parseNum(r.answer_duration) > 0) b.connected += 1
    if (r.status_name === '成功客户') b.success += 1
  }
  return byAgentDate
}
