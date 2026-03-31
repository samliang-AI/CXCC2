import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')

// 文件缓存
const fileCache = new Map()

// 将日期字符串转换为本地日期（YYYY-MM-DD）
function toLocalDateString(dateStr: string): string {
  const date = new Date(dateStr)
  // 使用本地时区格式化日期，避免时区问题
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 生成日期范围内的所有日期（使用本地时区）
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  
  // 确保输入日期格式正确
  const localStartDate = toLocalDateString(startDate)
  const localEndDate = toLocalDateString(endDate)
  
  // 创建本地日期对象，避免时区问题
  const [startYear, startMonth, startDay] = localStartDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = localEndDate.split('-').map(Number)
  
  const currentDate = new Date(startYear, startMonth - 1, startDay)
  const lastDate = new Date(endYear, endMonth - 1, endDay)
  
  console.log(`生成日期范围: ${localStartDate} 到 ${localEndDate}`)
  
  while (currentDate <= lastDate) {
    const dateStr = toLocalDateString(currentDate.toISOString())
    dates.push(dateStr)
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  console.log(`需要读取的日期文件: ${dates.join(', ')}`)
  return dates
}

// 读取文件并缓存结果
async function readFileWithCache(filePath: string): Promise<any[]> {
  // 检查缓存
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
    console.error(`读取文件失败: ${filePath}`, error)
    return []
  }
}

// 读取本地录音清单数据
async function readLocalRecordings(startDateTime: string, endDateTime: string) {
  try {
    console.log(`开始读取录音数据，时间范围: ${startDateTime} 到 ${endDateTime}`)
    
    // 生成日期范围内的所有日期
    const dateRange = generateDateRange(startDateTime, endDateTime)
    
    // 并行读取所有日期文件
    const filePromises = dateRange.map(date => {
      const filePath = path.join(DATA_DIR, `qms_recording_list_${date}.json`)
      console.log(`尝试读取录音文件: ${filePath}`)
      return readFileWithCache(filePath)
    })
    
    const results = await Promise.all(filePromises)
    let allRecordings: any[] = []
    let filesRead = 0
    const loadedFiles: string[] = []
    
    // 合并所有文件数据
    results.forEach((records, index) => {
      if (records.length > 0) {
        allRecordings = allRecordings.concat(records)
        filesRead++
        loadedFiles.push(dateRange[index])
      }
    })
    
    console.log(`成功读取 ${filesRead} 个文件，共 ${allRecordings.length} 条记录`)
    console.log(`加载的文件: ${loadedFiles.join(', ')}`)
    
    // 精确过滤时间范围内的数据（包括具体时间）
    const filterStartTime = new Date(startDateTime).getTime()
    const filterEndTime = new Date(endDateTime).getTime()
    
    console.log(`时间过滤范围: ${new Date(filterStartTime).toISOString()} 到 ${new Date(filterEndTime).toISOString()}`)
    
    const filteredRecordings = allRecordings.filter(recording => {
      if (!recording.start_time) {
        return false
      }
      
      try {
        const recordingTime = new Date(recording.start_time).getTime()
        return recordingTime >= filterStartTime && recordingTime <= filterEndTime
      } catch (error) {
        console.warn(`无效的录音时间: ${recording.start_time}`, error)
        return false
      }
    })
    
    console.log(`过滤后剩余 ${filteredRecordings.length} 条记录`)
    
    return {
      recordings: filteredRecordings,
      loadedFiles: loadedFiles
    }
  } catch (error) {
    console.error('读取录音清单数据失败:', error)
    return {
      recordings: [],
      loadedFiles: []
    }
  }
}

// GET - 获取本地录音清单数据
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    
    console.log('接收到的参数:', {
      date,
      startTime,
      endTime,
      startDate,
      endDate,
      page,
      pageSize
    })
    
    // 确定时间范围
    let targetStartTime, targetEndTime
    if (startTime && endTime) {
      // 使用完整的时间范围（包括具体时间）
      targetStartTime = startTime
      targetEndTime = endTime
    } else if (startDate && endDate) {
      // 只使用日期部分
      targetStartTime = startDate
      targetEndTime = endDate
    } else if (date) {
      // 使用单个日期
      targetStartTime = date
      targetEndTime = date
    } else {
      // 如果没有提供日期，使用今天的日期
      const now = new Date()
      const today = toLocalDateString(now.toISOString())
      targetStartTime = today
      targetEndTime = today
    }
    
    console.log('最终使用的时间范围:', { targetStartTime, targetEndTime })
    
    const { recordings, loadedFiles } = await readLocalRecordings(targetStartTime, targetEndTime)
    
    // 计算分页
    const total = recordings.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedRecordings = recordings.slice(startIndex, endIndex)
    
    console.log('返回的记录数:', paginatedRecordings.length, '总记录数:', total, '当前页:', page, '每页大小:', pageSize)
    
    // 计算本地累计录音数量（只读取当天的日期文件）
    let rawTotal = 0
    try {
      const today = toLocalDateString(new Date().toISOString())
      const dateFilePath = path.join(DATA_DIR, `qms_recording_list_${today}.json`)
      console.log('尝试读取当天日期文件:', dateFilePath)
      
      try {
        const dateData = await readFile(dateFilePath, 'utf-8')
        const dateRecordings = JSON.parse(dateData)
        rawTotal = dateRecordings.length
        console.log('成功读取当天日期文件，本地累计录音数量:', rawTotal)
      } catch (error) {
        console.error(`读取 ${today} 的录音清单文件失败:`, error)
        // 只读取日期文件，不回退到主文件
        rawTotal = 0
        console.log('未找到当天日期文件，本地累计录音数量:', rawTotal)
      }
    } catch (error) {
      console.error('读取文件计算本地累计数量失败:', error)
      rawTotal = 0
    }
    
    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: {
        records: paginatedRecordings,
        total: total,
        page: page,
        pageSize: pageSize
      },
      rows: paginatedRecordings,
      total: total,
      page: page,
      pageSize: pageSize,
      rawTotal: rawTotal,
      loadedFiles: loadedFiles
    })
  } catch (error) {
    console.error('获取本地录音清单数据失败:', error)
    return NextResponse.json(
      { error: 'Failed to get local recordings data' },
      { status: 500 }
    )
  }
}
