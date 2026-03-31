'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  ClipboardCheck,
  Star,
  Sparkles,
  Loader2,
  Check,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react'
import { maskPhone } from '@/lib/utils/mask'

// 客户状态映射
const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: '未标记', color: 'bg-gray-500' },
  1: { label: '失败客户', color: 'bg-red-500' },
  2: { label: '成功客户', color: 'bg-green-500' },
  3: { label: '开场拒访', color: 'bg-orange-500' },
  4: { label: '秒挂无声', color: 'bg-yellow-500' },
  5: { label: '办理互斥', color: 'bg-purple-500' },
  6: { label: '语音助手', color: 'bg-blue-500' },
  7: { label: '验证码失败', color: 'bg-pink-500' },
  8: { label: '高频骚扰', color: 'bg-red-700' }
}

// 质检状态映射
const qualityStatusMap: Record<number, { label: string; color: string }> = {
  0: { label: '未质检', color: 'secondary' },
  1: { label: '已质检', color: 'default' },
  2: { label: '质检中', color: 'outline' }
}

// 任务名称列表
const tasks = [
  { id: '1', name: '宽带升级营销' },
  { id: '2', name: '5G套餐推广' },
  { id: '3', name: '流量包销售' }
]



const qualityResultMap: Record<string, { label: string; color: string }> = {
  '优秀': { label: '优秀', color: 'bg-green-500 text-white' },
  '良好': { label: '良好', color: 'bg-blue-500 text-white' },
  '合格': { label: '合格', color: 'bg-yellow-500 text-white' },
  '不合格': { label: '不合格', color: 'bg-red-500 text-white' }
}

interface AIQualityResult {
  greetingScore: number
  professionalScore: number
  attitudeScore: number
  accuracyScore: number
  overallScore: number
  qualityResult: string
  qualityComment: string
  improvementSuggestion: string
  analysis: string
}

interface Recording {
  uuid: string
  company_id: string | null
  project_id: number
  task_id: number
  agent: string
  agent_name: string
  calling_phone: string
  called_phone: string
  start_time: string
  end_time: string
  answer_duration: number
  play_url: string
  status: number
  status_name: string
  quality_status: number
  sync_time: string
  updated_at: string
  id?: number
  agentName?: string
  calledPhone?: string
  projectId?: string
  taskName?: string
  cityCode?: string
  cityName?: string
  statusName?: string
  qualityStatus?: number
  startTime?: string
  answerDuration?: number
  playUrl?: string
  customerInfo?: {
    customerName: string
    customerPhone: string
    customerStatus: string
    mainPackageName: string
    mainPackageFee: string
    packageMinutes: string
    packageData: string
    mainStrategy: string
    subStrategy: string
    recentConsumption: string
    hasBroadband: string
    upgradeDiff: string
    cityArea: string
    remark: string
  }
}

export default function QualityPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [qualityScores, setQualityScores] = useState<any[]>([])
  const [pendingRecordings, setPendingRecordings] = useState<Recording[]>([])
  const [showScoreDialog, setShowScoreDialog] = useState(false)
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [selectedRecording, setSelectedRecording] = useState<any>(null)
  const [scoreForm, setScoreForm] = useState({
    greetingScore: 8,
    professionalScore: 8,
    attitudeScore: 8,
    accuracyScore: 8,
    qualityComment: '',
    improvementSuggestion: ''
  })
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [pagination, setPagination] = useState({
    pageNum: 1,
    pageSize: 10,
    total: 0
  })
  
  // 状态选项
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  
  // 时间范围快速选择类型
  type QuickRangeKey = 'today' | '7days' | '15days' | 'month'
  
  // 时间范围辅助函数（只接受 Date 参数，不直接调用 new Date()）
  function toDateTimeLocalValue(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
  }
  
  function getRangeValues(type: QuickRangeKey, now: Date): { startTime: string; endTime: string } {
    const end = new Date(now)
    end.setHours(23, 59, 0, 0)
    const start = new Date(now)

    if (type === 'today') {
      start.setHours(0, 0, 0, 0)
    } else if (type === '7days') {
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
    } else if (type === '15days') {
      start.setDate(start.getDate() - 14)
      start.setHours(0, 0, 0, 0)
    } else {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
    }

    return {
      startTime: toDateTimeLocalValue(start),
      endTime: toDateTimeLocalValue(end),
    }
  }
  
  // 筛选条件状态
  const [filters, setFilters] = useState(() => {
    return {
      projectName: 'all',
      status: 'all',
      qualityStatus: 'all',
      qualityResult: 'all',
      qualityUser: 'all',
      startTime: '',
      endTime: ''
    };
  })
  
  // 在组件挂载时初始化时间范围（只在浏览器端执行）
  useEffect(() => {
    const now = new Date()
    const todayRange = getRangeValues('today', now)
    setFilters(prev => ({
      ...prev,
      startTime: todayRange.startTime,
      endTime: todayRange.endTime
    }))
    // 标记初始化完成
    setIsInitialized(true)
  }, [])
  
  // AI质检相关状态
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiContent, setAiContent] = useState('')
  const [aiResult, setAiResult] = useState<AIQualityResult | null>(null)
  const [aiIssues, setAiIssues] = useState<string[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // 本地暂存状态
  const [localStorageKey] = useState('quality-inspection-draft')
  
  // 导出相关状态
  const [exporting, setExporting] = useState(false)
  
  // 标记是否已完成初始化
  const [isInitialized, setIsInitialized] = useState(false)

  // 加载真实录音数据
  useEffect(() => {
    // 页面加载时执行查询，使用默认的今天时间范围
    // 只有在初始化完成后才执行查询
    if (isInitialized) {
      handleQuery();
    }
    
    // 加载本地暂存的质检数据
    loadDraftData();
  }, [isInitialized])

  // 分页变化时重新加载数据
  useEffect(() => {
    if (isInitialized) {
      handleQuery();
    }
  }, [pagination.pageNum, pagination.pageSize, isInitialized])

  // 筛选待质检录音数据
  const filteredRecordings = pendingRecordings.filter(recording => {
    // 项目名称筛选
    if (filters.projectName !== 'all' && recording.project_id !== parseInt(filters.projectName)) {
      return false
    }
    // 客户状态筛选
    if (filters.status !== 'all') {
      const statusNum = parseInt(filters.status)
      const statusNameValue = String(recording.status_name ?? recording.statusName ?? '').trim()
      const statusNameMatch = statusNameValue === filters.status
      const statusMatch = !isNaN(statusNum) && recording.status === statusNum
      
      // 尝试将status作为状态名称，然后匹配对应的数字
      let statusNumMatch = false
      if (isNaN(statusNum)) {
        // 状态映射，与前端保持一致
        const statusMap: Record<string, number> = {
          '未标记': 0,
          '失败客户': 1,
          '成功客户': 2,
          '开场拒访': 3,
          '秒挂无声': 4,
          '办理互斥': 5,
          '语音助手': 6,
          '验证码失败': 7,
          '高频骚扰': 8
        }
        const statusNumFromName = statusMap[filters.status]
        if (statusNumFromName !== undefined) {
          statusNumMatch = recording.status === statusNumFromName
        }
      }
      
      if (!statusNameMatch && !statusMatch && !statusNumMatch) {
        return false
      }
    }
    // 质检状态筛选
    if (filters.qualityStatus !== 'all' && recording.quality_status !== parseInt(filters.qualityStatus)) {
      return false
    }
    // 时间范围筛选
    if (filters.startTime && filters.startTime !== '' && recording.start_time) {
      const recordingDate = new Date(recording.start_time)
      const startDate = new Date(filters.startTime)
      if (recordingDate < startDate) {
        return false
      }
    }
    if (filters.endTime && filters.endTime !== '' && recording.start_time) {
      const recordingDate = new Date(recording.start_time)
      const endDate = new Date(filters.endTime)
      endDate.setHours(23, 59, 59, 999)
      if (recordingDate > endDate) {
        return false
      }
    }
    return true
  })

  // 筛选质检记录数据
  const filteredQualityScores = qualityScores.filter(score => {
    // 质检结果筛选
    if (filters.qualityResult !== 'all' && score.qualityResult !== filters.qualityResult) {
      return false
    }
    // 质检人员筛选
    if (filters.qualityUser !== 'all' && score.qualityUserName !== filters.qualityUser) {
      return false
    }
    // 时间范围筛选
    if (filters.startTime && score.qualityTime) {
      const scoreDate = new Date(score.qualityTime)
      const startDate = new Date(filters.startTime)
      if (scoreDate < startDate) {
        return false
      }
    }
    if (filters.endTime && score.qualityTime) {
      const scoreDate = new Date(score.qualityTime)
      const endDate = new Date(filters.endTime)
      endDate.setHours(23, 59, 59, 999)
      if (scoreDate > endDate) {
        return false
      }
    }
    return true
  })

  // 重置筛选条件
  const handleResetFilters = () => {
    const now = new Date()
    const todayRange = getRangeValues('today', now)
    setFilters({
      projectName: 'all',
      status: 'all',
      qualityStatus: 'all',
      qualityResult: 'all',
      qualityUser: 'all',
      startTime: todayRange.startTime,
      endTime: todayRange.endTime
    })
  }
  
  // 快速时间范围选择
  const handleQuickRange = (range: QuickRangeKey) => {
    const now = new Date()
    const quickRange = getRangeValues(range, now)
    setFilters({
      ...filters,
      startTime: quickRange.startTime,
      endTime: quickRange.endTime
    })
    // 使用 setTimeout 确保 filters 更新后再触发查询
    setTimeout(() => {
      handleQuery()
    }, 0)
  }

  // 处理查询按钮点击
  const handleQuery = async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      
      // 使用 API 读取本地录音文件
      const params = new URLSearchParams({
        pageNum: pagination.pageNum.toString(),
        pageSize: pagination.pageSize.toString(),
      })
      
      // 添加时间范围参数
      if (filters.startTime) {
        params.set('startTime', filters.startTime.replace('T', ' '))
      }
      if (filters.endTime) {
        params.set('endTime', filters.endTime.replace('T', ' '))
      }
      
      // 添加其他筛选条件
      if (filters.projectName && filters.projectName !== 'all') {
        params.set('projectName', filters.projectName)
      }
      if (filters.status && filters.status !== 'all') {
        params.set('status', filters.status)
      }
      if (filters.qualityStatus && filters.qualityStatus !== 'all') {
        params.set('qualityStatus', filters.qualityStatus)
      }
      
      const response = await fetch(`/api/local/recordings?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`加载失败: ${response.status}`)
      }
      
      const data = await response.json()
      const rows = data.rows || data.list || data.data?.records || []
      const total = data.total || rows.length
      
      // 从API响应中获取状态选项
      if (data.statusOptions) {
        setStatusOptions(data.statusOptions)
      }
      
      var allRecordings = rows
      
      // 转换数据格式以匹配组件期望的结构，保持字段名称与录音清单一致
      const formattedRecordings = allRecordings.map((recording: any, index: number) => ({
        id: index + 1,
        uuid: recording.uuid,
        company_id: recording.company_id,
        project_id: recording.project_id || recording.projectId,
        task_id: recording.task_id,
        agent: recording.agent,
        agent_name: recording.agent_name || recording.agentName,
        calling_phone: recording.calling_phone,
        called_phone: recording.called_phone || recording.calledPhone,
        start_time: recording.start_time || recording.startTime,
        end_time: recording.end_time,
        answer_duration: recording.answer_duration || recording.answerDuration,
        play_url: recording.play_url || recording.playUrl,
        status: recording.status,
        status_name: recording.status_name || recording.statusName,
        quality_status: recording.quality_status || recording.qualityStatus,
        sync_time: recording.sync_time,
        updated_at: recording.updated_at,
        // 兼容现有组件的字段名称
        agentName: recording.agentName || recording.agent_name,
        calledPhone: recording.calledPhone || recording.called_phone,
        projectName: recording.projectName || recording.project_id,
        statusName: recording.statusName || recording.status_name,
        qualityStatus: recording.qualityStatus || recording.quality_status,
        startTime: recording.startTime || recording.start_time,
        answerDuration: recording.answerDuration || recording.answer_duration,
        playUrl: recording.playUrl || recording.play_url
      }))
      
      setPendingRecordings(formattedRecordings)
      setPagination(prev => ({
        ...prev,
        total
      }))
    } catch (error: any) {
      setErrorMessage('加载录音数据失败: ' + error.message)
      console.error('Error loading recordings:', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存草稿数据到本地存储
  const saveDraftData = () => {
    if (selectedRecording && scoreForm) {
      const draftData = {
        recording: selectedRecording,
        scoreForm: scoreForm,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(localStorageKey, JSON.stringify(draftData));
    }
  }

  // 加载本地存储的草稿数据
  const loadDraftData = () => {
    const savedDraft = localStorage.getItem(localStorageKey);
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        setSelectedRecording(draftData.recording);
        setScoreForm(draftData.scoreForm);
      } catch (error) {
        console.error('Error loading draft data:', error);
      }
    }
  }

  // 清除草稿数据
  const clearDraftData = () => {
    localStorage.removeItem(localStorageKey);
  }

  const handleStartQuality = (recording: any) => {
    setSelectedRecording(recording)
    setScoreForm({
      greetingScore: 8,
      professionalScore: 8,
      attitudeScore: 8,
      accuracyScore: 8,
      qualityComment: '',
      improvementSuggestion: ''
    })
    setShowScoreDialog(true)
  }

  const handleStartAIQuality = async (recording: any) => {
    setSelectedRecording(recording)
    setAiContent('')
    setAiResult(null)
    setAiIssues([])
    setShowAIDialog(true)
    setAiAnalyzing(true)
    
    // 创建AbortController用于取消请求
    abortControllerRef.current = new AbortController()
    
    try {
      // 模拟AI质检分析过程
      // 实际项目中应该调用真实的AI质检API
      setAiContent('正在分析录音内容...\n')
      
      // 模拟分析过程
      setTimeout(() => {
        setAiContent(prev => prev + '识别通话意图...\n')
      }, 1000)
      
      setTimeout(() => {
        setAiContent(prev => prev + '分析服务态度...\n')
      }, 2000)
      
      setTimeout(() => {
        setAiContent(prev => prev + '检查信息准确性...\n')
      }, 3000)
      
      setTimeout(() => {
        setAiContent(prev => prev + '生成质检报告...\n')
        
        // 模拟AI分析结果
        const mockAiResult: AIQualityResult = {
          greetingScore: 9.0,
          professionalScore: 8.5,
          attitudeScore: 9.2,
          accuracyScore: 8.8,
          overallScore: 8.9,
          qualityResult: '优秀',
          qualityComment: '坐席服务态度良好，专业能力强，信息传达准确',
          improvementSuggestion: '建议在通话结束时主动询问客户是否还有其他需求',
          analysis: '通话过程中，坐席能够准确识别客户需求，提供专业的解决方案，服务态度热情友好。'
        }
        
        const mockIssues = [
          '通话开始时未主动自我介绍',
          '未完全解答客户的所有问题'
        ]
        
        setAiResult(mockAiResult)
        setAiIssues(mockIssues)
        setAiAnalyzing(false)
      }, 4000)
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setAiContent('AI质检分析失败: ' + error.message)
      }
      setAiAnalyzing(false)
    }
  }

  const handleApplyAIResult = () => {
    if (aiResult) {
      setScoreForm({
        greetingScore: aiResult.greetingScore,
        professionalScore: aiResult.professionalScore,
        attitudeScore: aiResult.attitudeScore,
        accuracyScore: aiResult.accuracyScore,
        qualityComment: aiResult.qualityComment,
        improvementSuggestion: aiResult.improvementSuggestion
      })
      setShowAIDialog(false)
      setShowScoreDialog(true)
    }
  }

  const calculateOverallScore = () => {
    const avg = (scoreForm.greetingScore + scoreForm.professionalScore + 
                 scoreForm.attitudeScore + scoreForm.accuracyScore) / 4
    return avg.toFixed(2)
  }

  const getQualityResult = (score: number) => {
    if (score >= 9) return '优秀'
    if (score >= 8) return '良好'
    if (score >= 7) return '合格'
    return '不合格'
  }

  const handleSubmitScore = () => {
    try {
      const overallScore = parseFloat(calculateOverallScore())
      const result = getQualityResult(overallScore)
      
      const newScore = {
        id: qualityScores.length + 1,
        recordingId: selectedRecording.id,
        recordingUuid: selectedRecording.uuid,
        agent: selectedRecording.agent,
        agentName: selectedRecording.agentName,
        qualityUserName: '当前质检员',
        greetingScore: scoreForm.greetingScore,
        professionalScore: scoreForm.professionalScore,
        attitudeScore: scoreForm.attitudeScore,
        accuracyScore: scoreForm.accuracyScore,
        overallScore,
        qualityResult: result,
        qualityComment: scoreForm.qualityComment,
        improvementSuggestion: scoreForm.improvementSuggestion,
        qualityTime: new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
      
      setQualityScores([newScore, ...qualityScores])
      setShowScoreDialog(false)
      setSuccessMessage('质检评分已成功提交!')
      clearDraftData()
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
    } catch (error: any) {
      setErrorMessage('提交质检评分失败: ' + error.message)
      setTimeout(() => {
        setErrorMessage('')
      }, 3000)
    }
  }

  // 导出质检结果为Excel
  const handleExportExcel = () => {
    try {
      setExporting(true)
      
      // 模拟导出过程
      setTimeout(() => {
        setSuccessMessage('质检结果已成功导出!')
        setExporting(false)
        
        // 3秒后清除成功消息
        setTimeout(() => {
          setSuccessMessage('')
        }, 3000)
      }, 1500)
    } catch (error: any) {
      setErrorMessage('导出失败: ' + error.message)
      setExporting(false)
      setTimeout(() => {
        setErrorMessage('')
      }, 3000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">质检管理</h1>
        <p className="text-gray-500">对外呼录音进行质检评分（支持AI智能质检）</p>
      </div>

      {/* 消息提示 */}
      {(successMessage || errorMessage) && (
        <div className={`p-4 rounded-lg ${successMessage ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {successMessage ? (
                <Check className="h-5 w-5" />
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                {successMessage || errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 标签切换 */}
      <div className="flex gap-4 border-b">
        <button
          className={`pb-2 px-4 font-medium ${
            activeTab === 'pending'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('pending')}
        >
          待质检录音
        </button>
        <button
          className={`pb-2 px-4 font-medium ${
            activeTab === 'history'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('history')}
        >
          质检记录
        </button>
      </div>

      {activeTab === 'pending' && (
        <>
          {/* 筛选条件 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-5 w-5" />
                筛选条件
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <div>
                  <label className="text-sm font-medium mb-2 block">项目名称</label>
                  <Select value={filters.projectName} onValueChange={(v) => setFilters({ ...filters, projectName: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部项目" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部项目</SelectItem>
                      <SelectItem value="4">茂名 (4)</SelectItem>
                      <SelectItem value="5">茂名 (5)</SelectItem>
                      <SelectItem value="6">茂名 (6)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">客户状态</label>
                  <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      {statusOptions.map((statusName) => (
                        <SelectItem key={statusName} value={statusName}>{statusName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">质检状态</label>
                  <Select value={filters.qualityStatus} onValueChange={(v) => setFilters({ ...filters, qualityStatus: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      {Object.entries(qualityStatusMap).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">开始时间</label>
                  <Input
                    type="datetime-local"
                    value={filters.startTime}
                    onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">结束时间</label>
                  <Input
                    type="datetime-local"
                    value={filters.endTime}
                    onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleQuickRange('today')}>
                  今天
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickRange('7days')}>
                  7 天
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickRange('15days')}>
                  15 天
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickRange('month')}>
                  本月
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">操作</label>
                  <div className="flex gap-2">
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleQuery}>
                      <Search className="h-4 w-4 mr-2" />
                      查询
                    </Button>
                    <Button variant="outline" onClick={handleResetFilters}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      重置
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 待质检录音列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                待质检录音
              </CardTitle>
              <CardDescription>共 {pagination.total} 条待质检录音</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">加载录音数据中...</span>
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                    <TableRow>
                      <TableHead>uuid</TableHead>
                      <TableHead>projectId</TableHead>
                      <TableHead>agent</TableHead>
                      <TableHead>agentName</TableHead>
                      <TableHead>calledPhone</TableHead>
                      <TableHead>statusName</TableHead>
                      <TableHead>qualityStatus</TableHead>
                      <TableHead>startTime</TableHead>
                      <TableHead>answerDuration</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecordings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                          暂无符合条件的录音数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecordings.map((recording) => (
                        <TableRow key={recording.uuid}>
                          <TableCell className="font-medium">{recording.uuid}</TableCell>
                          <TableCell>{recording.projectId || recording.project_id}</TableCell>
                          <TableCell>{recording.agent}</TableCell>
                          <TableCell>{recording.agentName || recording.agent_name}</TableCell>
                          <TableCell>{maskPhone(recording.calledPhone || recording.called_phone)}</TableCell>
                          <TableCell>
                            <Badge className="bg-gray-500 text-white">
                              {recording.statusName || recording.status_name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={qualityStatusMap[recording.qualityStatus || recording.quality_status!]?.color as any}>
                              {qualityStatusMap[recording.qualityStatus || recording.quality_status!]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{recording.startTime || recording.start_time}</TableCell>
                          <TableCell>{(recording.answerDuration || recording.answer_duration) ? `${recording.answerDuration || recording.answer_duration}秒` : '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleStartQuality(recording)}
                              >
                                手动质检
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
                                onClick={() => handleStartAIQuality(recording)}
                              >
                                <Sparkles className="h-4 w-4 mr-1" />
                                AI质检
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  </Table>
                  
                  {/* 分页控件 */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-500">
                      第 {pagination.pageNum} / {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))} 页
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="px-2 py-1 border rounded"
                        value={pagination.pageSize}
                        onChange={(e) =>
                          setPagination((prev) => ({
                            ...prev,
                            pageSize: Number(e.target.value),
                            pageNum: 1,
                          }))
                        }
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pagination.pageNum <= 1 || loading}
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            pageNum: Math.max(1, prev.pageNum - 1)
                          }))
                        }
                      >
                        上一页
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pagination.pageNum >= Math.ceil(pagination.total / pagination.pageSize) || loading}
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            pageNum: Math.min(Math.ceil(pagination.total / pagination.pageSize), prev.pageNum + 1)
                          }))
                        }
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </>
        )}

      {activeTab === 'history' && (
        <>
          {/* 质检记录筛选条件 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-5 w-5" />
                质检记录筛选
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <div>
                  <label className="text-sm font-medium mb-2 block">质检结果</label>
                  <Select value={filters.qualityResult} onValueChange={(v) => setFilters({ ...filters, qualityResult: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部结果" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部结果</SelectItem>
                      <SelectItem value="优秀">优秀</SelectItem>
                      <SelectItem value="良好">良好</SelectItem>
                      <SelectItem value="合格">合格</SelectItem>
                      <SelectItem value="不合格">不合格</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">质检人员</label>
                  <Select value={filters.qualityUser} onValueChange={(v) => setFilters({ ...filters, qualityUser: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部人员" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部人员</SelectItem>
                      <SelectItem value="当前质检员">当前质检员</SelectItem>
                      <SelectItem value="管理员">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">开始时间</label>
                  <Input
                    type="datetime-local"
                    value={filters.startTime}
                    onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">结束时间</label>
                  <Input
                    type="datetime-local"
                    value={filters.endTime}
                    onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleQuickRange('today')}>
                  今天
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickRange('7days')}>
                  7 天
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickRange('15days')}>
                  15 天
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickRange('month')}>
                  本月
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 质检记录列表 */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  质检记录
                </CardTitle>
                <CardDescription>共 {filteredQualityScores.length} 条质检记录</CardDescription>
              </div>
              <Button 
                className="bg-green-600 hover:bg-green-700" 
                onClick={handleExportExcel}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    导出中...
                  </>
                ) : (
                  '导出Excel'
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>录音UUID</TableHead>
                    <TableHead>坐席工号</TableHead>
                    <TableHead>坐席姓名</TableHead>
                    <TableHead>质检人</TableHead>
                    <TableHead>问候语</TableHead>
                    <TableHead>专业能力</TableHead>
                    <TableHead>服务态度</TableHead>
                    <TableHead>信息准确性</TableHead>
                    <TableHead>综合评分</TableHead>
                    <TableHead>质检结果</TableHead>
                    <TableHead>质检时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQualityScores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-gray-500 py-8">
                        暂无质检记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQualityScores.map((score) => (
                      <TableRow key={score.id}>
                        <TableCell className="font-medium">{score.recordingUuid}</TableCell>
                        <TableCell>{score.agent}</TableCell>
                        <TableCell>{score.agentName}</TableCell>
                        <TableCell>{score.qualityUserName}</TableCell>
                        <TableCell>{score.greetingScore}</TableCell>
                        <TableCell>{score.professionalScore}</TableCell>
                        <TableCell>{score.attitudeScore}</TableCell>
                        <TableCell>{score.accuracyScore}</TableCell>
                        <TableCell className="font-bold">{score.overallScore}</TableCell>
                        <TableCell>
                          <Badge className={qualityResultMap[score.qualityResult]?.color}>
                            {score.qualityResult}
                          </Badge>
                        </TableCell>
                        <TableCell>{score.qualityTime}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* 手动质检对话框 */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="max-w-fit max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>手动质检评分</DialogTitle>
            <DialogDescription>
              录音UUID: {selectedRecording?.uuid} | 坐席: {selectedRecording?.agentName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-6 py-4">
            {/* 左侧：录音信息 */}
            <div className="space-y-4 border-r pr-6">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                录音信息
              </h3>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">坐席工号</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.agent || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">坐席姓名</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.agent_name || selectedRecording?.agentName || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">被叫号码</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {maskPhone(selectedRecording?.called_phone || selectedRecording?.calledPhone || '-')}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">客户状态</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    <Badge className={`${statusMap[selectedRecording?.status || selectedRecording?.statusName]?.color} text-white`}>
                      {statusMap[selectedRecording?.status || selectedRecording?.statusName]?.label || selectedRecording?.status_name || selectedRecording?.statusName || '-'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">开始时间</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.start_time || selectedRecording?.startTime || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">结束时间</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.end_time || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">通话时长</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.answer_duration || selectedRecording?.answerDuration ? `${selectedRecording?.answer_duration || selectedRecording?.answerDuration}秒` : '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">质检状态</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    <Badge variant={qualityStatusMap[selectedRecording?.quality_status || selectedRecording?.qualityStatus!]?.color as any}>
                      {qualityStatusMap[selectedRecording?.quality_status || selectedRecording?.qualityStatus!]?.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 右侧：录音播放和评分 */}
            <div className="space-y-4">
              {/* 音频播放 */}
              <div>
                <Label className="text-base font-semibold">录音播放</Label>
                <audio
                  controls
                  className="w-full mt-2"
                  src={selectedRecording?.playUrl}
                >
                  您的浏览器不支持音频播放
                </audio>
              </div>

              {/* 评分维度 */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <Label>问候语评分</Label>
                    <span className="font-bold">{scoreForm.greetingScore} 分</span>
                  </div>
                  <Slider
                    value={[scoreForm.greetingScore]}
                    onValueChange={(value) => setScoreForm({ ...scoreForm, greetingScore: value[0] })}
                    max={10}
                    min={0}
                    step={0.5}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <Label>专业能力评分</Label>
                    <span className="font-bold">{scoreForm.professionalScore} 分</span>
                  </div>
                  <Slider
                    value={[scoreForm.professionalScore]}
                    onValueChange={(value) => setScoreForm({ ...scoreForm, professionalScore: value[0] })}
                    max={10}
                    min={0}
                    step={0.5}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <Label>服务态度评分</Label>
                    <span className="font-bold">{scoreForm.attitudeScore} 分</span>
                  </div>
                  <Slider
                    value={[scoreForm.attitudeScore]}
                    onValueChange={(value) => setScoreForm({ ...scoreForm, attitudeScore: value[0] })}
                    max={10}
                    min={0}
                    step={0.5}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <Label>信息准确性评分</Label>
                    <span className="font-bold">{scoreForm.accuracyScore} 分</span>
                  </div>
                  <Slider
                    value={[scoreForm.accuracyScore]}
                    onValueChange={(value) => setScoreForm({ ...scoreForm, accuracyScore: value[0] })}
                    max={10}
                    min={0}
                    step={0.5}
                  />
                </div>
              </div>

              {/* 综合评分 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">综合评分</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600">
                      {calculateOverallScore()}
                    </span>
                    <span>分</span>
                    <Badge className={qualityResultMap[getQualityResult(parseFloat(calculateOverallScore()))]?.color}>
                      {getQualityResult(parseFloat(calculateOverallScore()))}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* 质检评语 */}
              <div>
                <Label className="text-sm">质检评语</Label>
                <Textarea
                  placeholder="请输入质检评语"
                  value={scoreForm.qualityComment}
                  onChange={(e) => setScoreForm({ ...scoreForm, qualityComment: e.target.value })}
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* 改进建议 */}
              <div>
                <Label className="text-sm">改进建议</Label>
                <Textarea
                  placeholder="请输入改进建议"
                  value={scoreForm.improvementSuggestion}
                  onChange={(e) => setScoreForm({ ...scoreForm, improvementSuggestion: e.target.value })}
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScoreDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitScore}>
              提交评分
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI质检对话框 */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI智能质检
            </DialogTitle>
            <DialogDescription>
              录音UUID: {selectedRecording?.uuid} | 坐席: {selectedRecording?.agentName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* 分析进度 */}
            {aiAnalyzing && (
              <div className="flex items-center gap-2 text-purple-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">AI正在分析中...</span>
              </div>
            )}
            
            {/* AI分析内容 */}
            <ScrollArea className="h-[400px] w-full rounded border p-4 bg-gray-50 dark:bg-gray-900">
              <pre className="text-sm whitespace-pre-wrap font-sans">
                {aiContent || '等待AI分析...'}
              </pre>
            </ScrollArea>
            
            {/* 问题标记 */}
            {aiIssues.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 flex items-center gap-2 mb-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.667-1.964-.667-2.732 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  问题标记
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {aiIssues.map((issue, index) => (
                    <li key={index} className="text-yellow-800 dark:text-yellow-200">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* AI分析结果 */}
            {aiResult && (
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  AI质检结果
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">问候语评分：</span>
                    <span className="font-bold">{aiResult.greetingScore} 分</span>
                  </div>
                  <div>
                    <span className="text-gray-500">专业能力评分：</span>
                    <span className="font-bold">{aiResult.professionalScore} 分</span>
                  </div>
                  <div>
                    <span className="text-gray-500">服务态度评分：</span>
                    <span className="font-bold">{aiResult.attitudeScore} 分</span>
                  </div>
                  <div>
                    <span className="text-gray-500">信息准确性评分：</span>
                    <span className="font-bold">{aiResult.accuracyScore} 分</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                  <span className="text-gray-500">综合评分：</span>
                  <span className="text-2xl font-bold text-purple-600">{aiResult.overallScore} 分</span>
                  <Badge className={qualityResultMap[aiResult.qualityResult]?.color}>
                    {aiResult.qualityResult}
                  </Badge>
                </div>
                {aiResult.analysis && (
                  <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                    <span className="text-gray-500 block mb-1">分析总结：</span>
                    <p className="text-sm">{aiResult.analysis}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDialog(false)}>
              关闭
            </Button>
            {aiResult && (
              <Button onClick={handleApplyAIResult}>
                应用AI结果
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 手动质检对话框 */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="max-w-fit max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>手动质检评分</DialogTitle>
            <DialogDescription>
              录音UUID: {selectedRecording?.uuid} | 坐席: {selectedRecording?.agentName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-6 py-4">
            {/* 左侧：录音信息 */}
            <div className="space-y-4 border-r pr-6">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                录音信息
              </h3>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">坐席工号</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.agent || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">坐席姓名</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.agent_name || selectedRecording?.agentName || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">被叫号码</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {maskPhone(selectedRecording?.called_phone || selectedRecording?.calledPhone || '-')}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">客户状态</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    <Badge className={`${statusMap[selectedRecording?.status || selectedRecording?.statusName]?.color} text-white`}>
                      {statusMap[selectedRecording?.status || selectedRecording?.statusName]?.label || selectedRecording?.status_name || selectedRecording?.statusName || '-'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">开始时间</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.start_time || selectedRecording?.startTime || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">结束时间</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.end_time || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">通话时长</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    {selectedRecording?.answer_duration || selectedRecording?.answerDuration ? `${selectedRecording?.answer_duration || selectedRecording?.answerDuration}秒` : '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-500 text-xs">质检状态</label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                    <Badge variant={qualityStatusMap[selectedRecording?.quality_status || selectedRecording?.qualityStatus!]?.color as any}>
                      {qualityStatusMap[selectedRecording?.quality_status || selectedRecording?.qualityStatus!]?.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 右侧：录音播放和评分 */}
            <div className="space-y-4">
              {/* 音频播放 */}
              <div>
                <Label className="text-base font-semibold">录音播放</Label>
                <audio
                  controls
                  className="w-full mt-2"
                  src={selectedRecording?.playUrl}
                >
                  您的浏览器不支持音频播放
                </audio>
              </div>

              {/* 评分维度 */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <Label>问候语评分</Label>
                    <span className="font-bold">{scoreForm.greetingScore} 分</span>
                  </div>
                  <Slider
                    value={[scoreForm.greetingScore]}
                    onValueChange={(value) => {
                      const newScoreForm = { ...scoreForm, greetingScore: value[0] };
                      setScoreForm(newScoreForm);
                      saveDraftData();
                    }}
                    max={10}
                    min={0}
                    step={0.5}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <Label>专业能力评分</Label>
                    <span className="font-bold">{scoreForm.professionalScore} 分</span>
                  </div>
                  <Slider
                    value={[scoreForm.professionalScore]}
                    onValueChange={(value) => {
                      const newScoreForm = { ...scoreForm, professionalScore: value[0] };
                      setScoreForm(newScoreForm);
                      saveDraftData();
                    }}
                    max={10}
                    min={0}
                    step={0.5}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <Label>服务态度评分</Label>
                    <span className="font-bold">{scoreForm.attitudeScore} 分</span>
                  </div>
                  <Slider
                    value={[scoreForm.attitudeScore]}
                    onValueChange={(value) => {
                      const newScoreForm = { ...scoreForm, attitudeScore: value[0] };
                      setScoreForm(newScoreForm);
                      saveDraftData();
                    }}
                    max={10}
                    min={0}
                    step={0.5}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <Label>信息准确性评分</Label>
                    <span className="font-bold">{scoreForm.accuracyScore} 分</span>
                  </div>
                  <Slider
                    value={[scoreForm.accuracyScore]}
                    onValueChange={(value) => {
                      const newScoreForm = { ...scoreForm, accuracyScore: value[0] };
                      setScoreForm(newScoreForm);
                      saveDraftData();
                    }}
                    max={10}
                    min={0}
                    step={0.5}
                  />
                </div>
              </div>

              {/* 综合评分 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">综合评分</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600">
                      {calculateOverallScore()}
                    </span>
                    <span>分</span>
                    <Badge className={qualityResultMap[getQualityResult(parseFloat(calculateOverallScore()))]?.color}>
                      {getQualityResult(parseFloat(calculateOverallScore()))}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* 质检评语 */}
              <div>
                <Label className="text-sm">质检评语</Label>
                <Textarea
                  placeholder="请输入质检评语"
                  value={scoreForm.qualityComment}
                  onChange={(e) => {
                    const newScoreForm = { ...scoreForm, qualityComment: e.target.value };
                    setScoreForm(newScoreForm);
                    saveDraftData();
                  }}
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* 改进建议 */}
              <div>
                <Label className="text-sm">改进建议</Label>
                <Textarea
                  placeholder="请输入改进建议"
                  value={scoreForm.improvementSuggestion}
                  onChange={(e) => {
                    const newScoreForm = { ...scoreForm, improvementSuggestion: e.target.value };
                    setScoreForm(newScoreForm);
                    saveDraftData();
                  }}
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScoreDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitScore}>
              提交评分
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
