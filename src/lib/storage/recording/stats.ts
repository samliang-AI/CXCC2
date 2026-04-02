// 统计模块
import { stat } from 'fs/promises'
import { RecordingStorageStats } from './types'
import { getAllRecordingFiles, readJsonArray } from './core'

/**
 * 获取存储统计信息
 */
export async function getRecordingStorageStats(): Promise<RecordingStorageStats> {
  const files = await getAllRecordingFiles()
  let totalRows = 0
  let totalSize = 0
  let earliest: string | null = null
  let latest: string | null = null
  
  for (const file of files) {
    const match = file.match(/qms_recording_list_(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue
    
    const fileDate = match[1]
    
    if (!earliest || fileDate < earliest) earliest = fileDate
    if (!latest || fileDate > latest) latest = fileDate
    
    try {
      const fileStat = await stat(file)
      totalSize += fileStat.size
      
      const rows = await readJsonArray<any>(file, false)
      totalRows += rows.length
    } catch {
      // 忽略读取失败的文件
    }
  }
  
  return {
    totalFiles: files.length,
    totalRows,
    dateRange: { earliest, latest },
    fileSize: totalSize,
  }
}

/**
 * 获取文件大小的人类可读格式
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 生成存储报告
 */
export async function generateStorageReport(): Promise<string> {
  const stats = await getRecordingStorageStats()
  
  return `
存储统计报告
=============

总文件数: ${stats.totalFiles}
总记录数: ${stats.totalRows.toLocaleString()}
总大小: ${formatFileSize(stats.fileSize)}
日期范围: ${stats.dateRange.earliest} 至 ${stats.dateRange.latest}
平均每条记录大小: ${stats.totalRows > 0 ? formatFileSize(stats.fileSize / stats.totalRows) : 'N/A'}
`
}