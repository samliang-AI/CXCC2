import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')

// 文件缓存
const fileCache = new Map()

// 生成日期范围内的所有日期
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const currentDate = new Date(startDate)
  const lastDate = new Date(endDate)
  
  while (currentDate <= lastDate) {
    dates.push(currentDate.toISOString().split('T')[0])
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
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

// 读取本地通话清单数据
async function readLocalCallLogs(startDate: string, endDate: string) {
  try {
    // 生成日期范围内的所有日期
    const dateRange = generateDateRange(startDate, endDate)
    
    // 并行读取所有日期文件
    const filePromises = dateRange.map(date => {
      const filePath = path.join(DATA_DIR, `qms_call_log_list_${date}.json`)
      return readFileWithCache(filePath)
    })
    
    const results = await Promise.all(filePromises)
    let allLogs: any[] = []
    let filesRead = 0
    
    // 合并所有文件数据
    results.forEach((records, index) => {
      if (records.length > 0) {
        allLogs = allLogs.concat(records)
        filesRead++
      }
    })
    
    // 如果没有读取到任何日期文件，尝试读取主文件
    if (filesRead === 0) {
      const mainFilePath = path.join(DATA_DIR, 'qms_call_log_list.json')
      const mainLogs = await readFileWithCache(mainFilePath)
      allLogs = mainLogs
    }
    
    // 过滤时间范围内的数据
    return allLogs.filter(log => {
      if (!log.startTime) return false
      const logDate = log.startTime.split(' ')[0]
      return logDate >= startDate && logDate <= endDate
    })
  } catch (error) {
    console.error('读取通话清单数据失败:', error)
    return []
  }
}

// GET - 获取本地通话清单数据
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // 确定时间范围
    let targetStartDate, targetEndDate
    if (startDate && endDate) {
      targetStartDate = startDate
      targetEndDate = endDate
    } else if (date) {
      targetStartDate = date
      targetEndDate = date
    } else {
      // 如果没有提供日期，使用今天的日期
      const today = new Date().toISOString().split('T')[0]
      targetStartDate = today
      targetEndDate = today
    }
    
    const callLogs = await readLocalCallLogs(targetStartDate, targetEndDate)
    
    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: callLogs,
      total: callLogs.length
    })
  } catch (error) {
    console.error('获取本地通话清单数据失败:', error)
    return NextResponse.json(
      { error: 'Failed to get local call logs data' },
      { status: 500 }
    )
  }
}
