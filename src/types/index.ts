// 用户相关类型
export interface User {
  id: number
  username: string
  realName: string
  phone?: string
  email?: string
  cityCode?: string
  cityName?: string
  roleId: number
  status: number
  lastLoginTime?: string
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: number
  roleName: string
  roleCode: string
  roleLevel: number
  description?: string
  status: number
}

export interface Permission {
  id: number
  permissionName: string
  permissionCode: string
  permissionType?: number
  parentId?: number
  path?: string
  icon?: string
  sort?: number
  status: number
}

// 录音相关类型
export interface Recording {
  id: number
  uuid: string
  companyId?: number
  projectId?: number
  taskId?: number
  batchId?: number
  agent?: string
  agentName?: string
  callingPhone?: string
  calledPhone?: string
  startTime?: string
  endTime?: string
  answerDuration?: number
  playUrl?: string
  status?: number
  statusName?: string
  qualityStatus: number
  remark?: string
  syncTime: string
  createdAt: string
  updatedAt: string
}

// 质检相关类型
export interface QualityScore {
  id: number
  recordingId: number
  recordingUuid: string
  projectId?: number
  agent?: string
  agentName?: string
  qualityUserId?: number
  qualityUserName?: string
  cityCode?: string
  cityName?: string
  greetingScore: number
  professionalScore: number
  attitudeScore: number
  accuracyScore: number
  overallScore: number
  qualityResult?: string
  qualityComment?: string
  improvementSuggestion?: string
  qualityStatus: number
  qualityTime?: string
  createdAt: string
  updatedAt: string
}

// 地市信息类型
export interface CityInfo {
  id: number
  cityCode: string
  cityName: string
  provinceCode?: string
  provinceName?: string
  level: number
  sort: number
  status: number
}

// 数据看板统计类型
export interface DashboardStats {
  overview: {
    totalCalls: number
    connectedCalls: number
    successCalls: number
    qualityRate: number
  }
  trendData: Array<{
    date: string
    calls: number
    success: number
    rate: number
  }>
  cityRanking: Array<{
    cityName: string
    successCalls: number
    rate: number
  }>
  agentRanking: Array<{
    agentName: string
    successCalls: number
    rate: number
  }>
}

// API响应类型
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp?: number
}

// 分页类型
export interface PageResult<T> {
  records: T[]
  total: number
  pageNum: number
  pageSize: number
}
