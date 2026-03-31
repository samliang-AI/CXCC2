#!/usr/bin/env node

/**
 * 录音数据迁移脚本 - 独立版本
 * 不依赖 TypeScript，直接执行迁移
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')
const RECORDING_FILE = path.join(DATA_DIR, 'qms_recording_list.json')

/**
 * 从录音时间提取日期部分 (YYYY-MM-DD)
 */
function extractDateFromStartTime(startTime) {
  if (!startTime) return null
  const match = startTime.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * 获取指定日期的文件路径
 */
function getRecordingFilePath(date) {
  if (!date) {
    return RECORDING_FILE
  }
  return path.join(DATA_DIR, `qms_recording_list_${date}.json`)
}

/**
 * 确保目录存在
 */
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * 读取 JSON 数组文件
 */
function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return []
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    if (!content.trim()) {
      return []
    }
    return JSON.parse(content)
  } catch (error) {
    console.error(`读取文件失败 ${filePath}:`, error.message)
    return []
  }
}

/**
 * 写入 JSON 数组文件
 */
function writeJsonArray(filePath, rows) {
  ensureDir()
  const tmpPath = `${filePath}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(rows, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
}

/**
 * 按日期分组录音数据
 */
function groupByDate(rows) {
  const grouped = new Map()
  
  for (const row of rows) {
    const date = extractDateFromStartTime(row.start_time)
    if (!date) continue
    
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date).push(row)
  }
  
  return grouped
}

/**
 * 主迁移函数
 */
async function migrateOldRecordingData() {
  console.log('检查旧数据文件...')
  
  if (!fs.existsSync(RECORDING_FILE)) {
    console.log('旧文件不存在，无需迁移')
    return { migrated: false, fileCount: 0, totalRows: 0 }
  }
  
  console.log('读取旧数据文件...')
  const oldRows = readJsonArray(RECORDING_FILE)
  
  if (oldRows.length === 0) {
    console.log('旧文件为空，无需迁移')
    return { migrated: false, fileCount: 0, totalRows: 0 }
  }
  
  console.log(`找到 ${oldRows.length} 条记录`)
  
  // 按日期分组
  console.log('按日期分组数据...')
  const grouped = groupByDate(oldRows)
  console.log(`分为 ${grouped.size} 个日期文件`)
  
  // 写入新文件
  console.log('写入新文件...')
  let totalWritten = 0
  
  for (const [date, rows] of grouped.entries()) {
    const filePath = getRecordingFilePath(date)
    const fileName = path.basename(filePath)
    
    // 读取现有数据（如果有）
    const existing = readJsonArray(filePath)
    console.log(`  - ${fileName}: 现有 ${existing.length} 条，新增 ${rows.length} 条`)
    
    // 建立索引并合并
    const byUuid = new Map()
    for (const row of existing) {
      if (row.uuid) {
        byUuid.set(row.uuid, row)
      }
    }
    for (const row of rows) {
      byUuid.set(row.uuid, row)
    }
    
    // 按时间排序
    const merged = Array.from(byUuid.values()).sort((a, b) => {
      const t1 = a.start_time ? new Date(a.start_time).getTime() : 0
      const t2 = b.start_time ? new Date(b.start_time).getTime() : 0
      return t2 - t1
    })
    
    // 写入文件
    writeJsonArray(filePath, merged)
    totalWritten += rows.length
    
    console.log(`    ✓ 写入完成，共 ${merged.length} 条`)
  }
  
  // 备份旧文件
  const backupPath = `${RECORDING_FILE}.backup.${Date.now()}`
  console.log(`\n备份旧文件到：${path.basename(backupPath)}`)
  fs.renameSync(RECORDING_FILE, backupPath)
  
  return {
    migrated: true,
    fileCount: grouped.size,
    totalRows: oldRows.length,
  }
}

/**
 * 获取存储统计信息
 */
function getRecordingStorageStats() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('qms_recording_list_') && f.endsWith('.json'))
    .map(f => path.join(DATA_DIR, f))
  
  let totalRows = 0
  let totalSize = 0
  let earliest = null
  let latest = null
  
  for (const file of files) {
    const match = file.match(/qms_recording_list_(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue
    
    const fileDate = match[1]
    
    if (!earliest || fileDate < earliest) earliest = fileDate
    if (!latest || fileDate > latest) latest = fileDate
    
    const stat = fs.statSync(file)
    totalSize += stat.size
    
    const rows = readJsonArray(file)
    totalRows += rows.length
  }
  
  return {
    totalFiles: files.length,
    totalRows,
    dateRange: { earliest, latest },
    fileSize: totalSize,
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('  开始迁移录音数据...')
  console.log('========================================\n')
  
  try {
    // 执行迁移
    const result = await migrateOldRecordingData()
    
    if (result.migrated) {
      console.log('\n✓ 迁移成功！')
      console.log(`  - 创建文件数：${result.fileCount}`)
      console.log(`  - 迁移记录数：${result.totalRows}`)
      
      // 显示统计信息
      const stats = getRecordingStorageStats()
      console.log('\n当前存储状态:')
      console.log(`  - 总文件数：${stats.totalFiles}`)
      console.log(`  - 总记录数：${stats.totalRows}`)
      console.log(`  - 日期范围：${stats.dateRange.earliest} 至 ${stats.dateRange.latest}`)
      console.log(`  - 总大小：${(stats.fileSize / 1024 / 1024).toFixed(2)} MB`)
      
      console.log('\n========================================')
      console.log('  迁移完成！')
      console.log('========================================\n')
    } else {
      console.log('\n⚠ 无需迁移或迁移失败')
      console.log('  可能原因：')
      console.log('  1. 旧文件不存在')
      console.log('  2. 旧文件为空')
      console.log('  3. 已经使用新格式')
      
      console.log('\n========================================\n')
    }
  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    console.error('\n错误详情:', error.message)
    console.log('\n========================================\n')
    process.exit(1)
  }
}

main()
