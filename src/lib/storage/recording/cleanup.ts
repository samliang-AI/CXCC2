// 清理模块
import { unlink } from 'fs/promises'
import { LocalRecordingRow, CleanupResult } from './types'
import { getAllRecordingFiles, readJsonArray } from './core'
import { clearCache } from './cache'

/**
 * 清理指定日期之前的录音文件
 */
export async function cleanupOldRecordings(beforeDate: string): Promise<CleanupResult> {
  const files = await getAllRecordingFiles()
  let deletedFiles = 0
  let deletedRows = 0
  
  for (const file of files) {
    const match = file.match(/qms_recording_list_(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue
    
    const fileDate = match[1]
    
    if (fileDate < beforeDate) {
      const rows = await readJsonArray<LocalRecordingRow>(file, false)
      deletedRows += rows.length
      
      // 删除文件
      await unlink(file)
      
      clearCache(file)
      deletedFiles++
    }
  }
  
  return { deletedFiles, deletedRows }
}

/**
 * 清理空文件
 */
export async function cleanupEmptyFiles(): Promise<number> {
  const files = await getAllRecordingFiles()
  let deletedFiles = 0
  
  for (const file of files) {
    try {
      const rows = await readJsonArray<any>(file, false)
      if (rows.length === 0) {
        await unlink(file)
        clearCache(file)
        deletedFiles++
      }
    } catch {
      // 忽略读取失败的文件
    }
  }
  
  return deletedFiles
}

/**
 * 清理重复文件
 */
export async function cleanupDuplicateFiles(): Promise<number> {
  const files = await getAllRecordingFiles()
  const seenFiles = new Set<string>()
  let deletedFiles = 0
  
  for (const file of files) {
    const fileName = file.split('\\').pop() || file
    if (seenFiles.has(fileName)) {
      await unlink(file)
      clearCache(file)
      deletedFiles++
    } else {
      seenFiles.add(fileName)
    }
  }
  
  return deletedFiles
}