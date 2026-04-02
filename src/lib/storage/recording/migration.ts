// 数据迁移模块
import { rename } from 'fs/promises'
import path from 'path'
import { LocalRecordingRow, MigrationResult } from './types'
import { readJsonArray, upsertLocalRecordings, groupByDate } from './core'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')
const RECORDING_FILE = path.join(DATA_DIR, 'qms_recording_list_2026-03-22.json')

/**
 * 迁移旧版数据到按日期分文件
 */
export async function migrateOldRecordingData(): Promise<MigrationResult> {
  try {
    const oldRows = await readJsonArray<LocalRecordingRow>(RECORDING_FILE, false)
    
    if (oldRows.length === 0) {
      return { migrated: false, fileCount: 0, totalRows: 0 }
    }
    
    // 按日期分组并写入新文件
    await upsertLocalRecordings(oldRows)
    
    // 备份旧文件
    const backupPath = `${RECORDING_FILE}.backup.${Date.now()}`
    await rename(RECORDING_FILE, backupPath)
    
    const grouped = groupByDate(oldRows)
    
    return {
      migrated: true,
      fileCount: grouped.size,
      totalRows: oldRows.length,
    }
  } catch (error) {
    console.error('Migration failed:', error)
    return { migrated: false, fileCount: 0, totalRows: 0 }
  }
}

/**
 * 检查是否需要迁移
 */
export async function checkMigrationNeeded(): Promise<boolean> {
  try {
    const oldRows = await readJsonArray<LocalRecordingRow>(RECORDING_FILE, false)
    return oldRows.length > 0
  } catch {
    return false
  }
}

/**
 * 执行迁移（如果需要）
 */
export async function runMigrationIfNeeded(): Promise<MigrationResult> {
  const needsMigration = await checkMigrationNeeded()
  if (!needsMigration) {
    return { migrated: false, fileCount: 0, totalRows: 0 }
  }
  return migrateOldRecordingData()
}