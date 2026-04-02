import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')

// 文件缓存
const fileCache = new Map()

// 将日期字符串转换为本地日期（YYYY-MM-DD）
function toLocalDateString(dateStr: string): string {
  try {
    if (!dateStr) return ''
    
    // 处理多种日期格式，统一转换为 YYYY-MM-DD
    let cleanDateStr = dateStr.trim()
    
    // 如果包含时间部分，只取日期部分
    // 支持格式：2026-03-02 00:00:00, 2026-03-02T00:00:00, 2026-03-02 00:00
    if (cleanDateStr.includes(' ') || cleanDateStr.includes('T')) {
      cleanDateStr = cleanDateStr.split(/[ T]/)[0]
    }
    
    // 验证格式是否为 YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (dateRegex.test(cleanDateStr)) {
      return cleanDateStr
    }
    
    // 如果无法解析，返回空字符串
    console.warn('日期格式不正确，应为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss:', dateStr)
    return ''
  } catch (error) {
    console.error('日期转换失败:', dateStr, error)
    return ''
  }
}

// 解析日期时间字符串，统一格式为 YYYY-MM-DD HH:mm:ss
function parseDateTime(dateTimeStr: string): string {
  try {
    if (!dateTimeStr) return ''
    
    const cleanStr = dateTimeStr.trim()
    
    // 如果已经是标准格式，直接返回
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cleanStr)) {
      return cleanStr
    }
    
    // 如果只有日期部分，添加默认时间 00:00:00
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      return `${cleanStr} 00:00:00`
    }
    
    // 如果包含 T，替换为空格
    if (cleanStr.includes('T')) {
      const normalized = cleanStr.replace('T', ' ')
      return parseDateTime(normalized)
    }
    
    // 如果只有 HH:mm，添加 :00 秒
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(cleanStr)) {
      return `${cleanStr}:00`
    }
    
    // 尝试使用 Date 对象解析
    const date = new Date(cleanStr)
    if (isNaN(date.getTime())) {
      console.warn('无法解析日期时间:', dateTimeStr)
      return cleanStr
    }
    
    // 格式化为 YYYY-MM-DD HH:mm:ss
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (error) {
    console.error('日期时间解析失败:', dateTimeStr, error)
    return dateTimeStr
  }
}

// 生成日期范围内的所有日期
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  
  const localStartDate = toLocalDateString(startDate)
  const localEndDate = toLocalDateString(endDate)
  
  console.log('[generateDateRange] 输入:', { startDate, endDate, localStartDate, localEndDate })
  
  const [startYear, startMonth, startDay] = localStartDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = localEndDate.split('-').map(Number)
  
  // 使用本地时间而不是 UTC 时间
  const currentDate = new Date(startYear, startMonth - 1, startDay)
  const lastDate = new Date(endYear, endMonth - 1, endDay)
  
  console.log('[generateDateRange] 日期对象:', { currentDate, lastDate })
  
  while (currentDate <= lastDate) {
    // 直接使用本地日期，避免时区转换
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    dates.push(dateStr)
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  console.log('[generateDateRange] 生成的日期:', dates)
  
  return dates
}

// 读取文件并缓存结果
async function readFileWithCache(filePath: string): Promise<any[]> {
  const cacheKey = filePath
  if (fileCache.has(cacheKey)) {
    return fileCache.get(cacheKey)
  }
  
  try {
    const data = await readFile(filePath, 'utf-8')
    const records = JSON.parse(data)
    // 设置缓存，缓存5分钟
    fileCache.set(cacheKey, records)
    setTimeout(() => {
      fileCache.delete(cacheKey)
    }, 5 * 60 * 1000)
    return records
  } catch (error) {
    return []
  }
}

// 读取本地录音清单数据（优化版）
async function readLocalRecordings(startDateTime: string, endDateTime: string, page: number, pageSize: number) {
  try {
    console.log('[readLocalRecordings] 输入参数:', {
      startDateTime,
      endDateTime,
      page,
      pageSize
    })
    
    // 生成日期范围内的所有日期
    const dateRange = generateDateRange(startDateTime, endDateTime)
    
    console.log('[readLocalRecordings] 生成的日期范围:', dateRange)
    
    // 确定目标日期
    const targetDateStr = toLocalDateString(startDateTime)
    
    console.log('[readLocalRecordings] 目标日期:', targetDateStr)
    
    // 计算分页参数
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    
    // 并行读取所有日期文件
    const filePromises = dateRange.map(date => {
      const filePath = path.join(DATA_DIR, `qms_recording_list_${date}.json`)
      console.log('[readLocalRecordings] 准备读取文件:', filePath)
      return readFileWithCache(filePath)
    })
    
    const results = await Promise.all(filePromises)
    let allRecordings: any[] = []
    let totalRecords = 0
    let filteredCount = 0
    const loadedFiles: string[] = []
    
    console.log('[readLocalRecordings] 文件读取结果数量:', results.length)
    
    // 合并所有文件数据并同时计算总数
    results.forEach((records, index) => {
      if (records.length > 0) {
        totalRecords += records.length
        const fileName = `qms_recording_list_${dateRange[index]}.json`
        loadedFiles.push(fileName)
        console.log('[readLocalRecordings] 加载文件:', fileName, '记录数:', records.length)
        
        // 只按日期过滤，不按具体时间
        const filtered = records.filter(recording => {
          if (!recording.start_time) return false
          try {
            const recordingDate = toLocalDateString(recording.start_time)
            return recordingDate === targetDateStr
          } catch {
            return false
          }
        })
        
        console.log('[readLocalRecordings] 文件', fileName, '过滤后记录数:', filtered.length)
        
        filteredCount += filtered.length
        allRecordings = allRecordings.concat(filtered)
      } else {
        console.log('[readLocalRecordings] 文件', `qms_recording_list_${dateRange[index]}.json`, '无数据或不存在')
      }
    })
    
    console.log('[readLocalRecordings] 最终结果:', {
      totalRecords,
      filteredCount,
      allRecordingsCount: allRecordings.length,
      loadedFiles
    })
    
    // 计算分页
    const paginatedRecordings = allRecordings.slice(startIndex, endIndex)
    
    return {
      recordings: paginatedRecordings,
      total: filteredCount,
      loadedFiles: loadedFiles,
      totalRecords: totalRecords
    }
  } catch (error) {
    console.error('[readLocalRecordings] 错误:', error)
    return {
      recordings: [],
      total: 0,
      loadedFiles: [],
      totalRecords: 0
    }
  }
}

// GET - 获取本地录音清单数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    
    console.log('[本地录音 API] 请求参数:', {
      date,
      startTime,
      endTime,
      startDate,
      endDate,
      page,
      pageSize
    })
    
    // 确定时间范围，统一日期时间格式
    let targetStartTime, targetEndTime
    if (startTime && endTime) {
      // 统一格式为 YYYY-MM-DD HH:mm:ss
      targetStartTime = parseDateTime(startTime)
      targetEndTime = parseDateTime(endTime)
    } else if (startDate && endDate) {
      targetStartTime = parseDateTime(startDate)
      targetEndTime = parseDateTime(endDate)
    } else if (date) {
      targetStartTime = parseDateTime(date)
      targetEndTime = parseDateTime(date)
    } else {
      const now = new Date()
      const today = toLocalDateString(now.toISOString())
      targetStartTime = `${today} 00:00:00`
      targetEndTime = `${today} 23:59:59`
    }
    
    console.log('[本地录音 API] 查询时间范围（已统一格式）:', {
      targetStartTime,
      targetEndTime
    })
    
    const { recordings, total, loadedFiles, totalRecords } = await readLocalRecordings(targetStartTime, targetEndTime, page, pageSize)
    
    console.log('[本地录音 API] 返回结果:', {
      total,
      loadedFiles,
      totalRecords
    })
    
    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: {
        records: recordings,
        total: total,
        page: page,
        pageSize: pageSize
      },
      rows: recordings,
      total: total,
      page: page,
      pageSize: pageSize,
      rawTotal: totalRecords,
      loadedFiles: loadedFiles
    })
  } catch (error: any) {
    console.error('[本地录音 API] 错误详情:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    return NextResponse.json(
      { 
        error: 'Failed to get local recordings data',
        message: error?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}