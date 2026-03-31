#!/usr/bin/env node

/**
 * 通话清单数据迁移脚本 - 独立版本
 * 不依赖 TypeScript，直接执行迁移
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')
const CALL_LOG_FILE = path.join(DATA_DIR, 'qms_call_log_list.json')

/**
 * 从通话时间提取日期部分 (YYYY-MM-DD)
 */
function extractDateFromStartTime(startTime) {
  if (!startTime) return null
  const match = String(startTime).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * 获取指定日期的文件路径
 */
function getCallLogFilePath(date) {
  if (!date) {
    return CALL_LOG_FILE
  }
  return path.join(DATA_DIR, `qms_call_log_list_${date}.json`)
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
 * 读取 JSON 数组文件（容错版本）
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
    try {
      return JSON.parse(content)
    } catch (parseError) {
      console.warn(`JSON 解析失败 ${filePath}，尝试修复...`)
      // 尝试只读取有效的 JSON 数组部分
      const match = content.match(/^\s*\[([\s\S]*)\]\s*$/)
      if (match) {
        // 尝试逐行解析
        const lines = content.split('\n')
        const validRows = []
        let currentRow = ''
        let depth = 0
        let inString = false
        let escaped = false

        for (const line of lines) {
          for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (inString) {
              if (escaped) {
                escaped = false
              } else if (ch === '\\') {
                escaped = true
              } else if (ch === '"') {
                inString = false
              }
              currentRow += ch
              continue
            }
            if (ch === '"') {
              inString = true
              currentRow += ch
              continue
            }
            if (ch === '{') {
              depth++
              currentRow += ch
            } else if (ch === '}') {
              depth--
              currentRow += ch
              if (depth === 0 && currentRow.trim()) {
                try {
                  const obj = JSON.parse(currentRow.trim())
                  validRows.push(obj)
                } catch (e) {
                  // 跳过无效对象
                }
                currentRow = ''
              }
            } else if (depth > 0) {
              currentRow += ch
            }
          }
          if (depth === 0) {
            currentRow = ''
          }
        }

        console.log(`成功恢复 ${validRows.length} 条记录`)
        return validRows
      }
      return []
    }
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
 * 提取第一个非空文本作为唯一键
 */
function firstNonEmptyText(values) {
  for (const v of values) {
    if (v != null && String(v).trim().length > 0) {
      return String(v).trim()
    }
  }
  return null
}

/**
 * 按日期分组通话数据
 */
function groupByDate(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const date = extractDateFromStartTime(row.startTime)
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
async function migrateOldCallLogData() {
  console.log('检查旧数据文件...')

  if (!fs.existsSync(CALL_LOG_FILE)) {
    console.log('旧文件不存在，无需迁移')
    return { migrated: false, fileCount: 0, totalRows: 0 }
  }

  console.log('读取旧数据文件...')
  const oldRows = readJsonArray(CALL_LOG_FILE)

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
    const filePath = getCallLogFilePath(date)
    const fileName = path.basename(filePath)

    // 读取现有数据（如果有）
    const existing = readJsonArray(filePath)
    console.log(`  - ${fileName}: 现有 ${existing.length} 条，新增 ${rows.length} 条`)

    // 建立索引并合并
    const byKey = new Map()
    for (const row of existing) {
      const key = firstNonEmptyText([row.id, row.uuid])
      if (key) {
        byKey.set(key, row)
      }
    }
    for (const row of rows) {
      const key = firstNonEmptyText([row.id, row.uuid])
      if (key) {
        byKey.set(key, row)
      }
    }

    // 按时间排序
    const merged = Array.from(byKey.values()).sort((a, b) => {
      const ta = new Date(String(a.startTime ?? '')).getTime()
      const tb = new Date(String(b.startTime ?? '')).getTime()
      const na = Number.isFinite(ta) ? ta : 0
      const nb = Number.isFinite(tb) ? tb : 0
      return nb - na
    })

    // 写入文件
    writeJsonArray(filePath, merged)
    totalWritten += rows.length

    console.log(`    ✓ 写入完成，共 ${merged.length} 条`)
  }

  // 备份旧文件
  const backupPath = `${CALL_LOG_FILE}.backup.${Date.now()}`
  console.log(`\n备份旧文件到：${path.basename(backupPath)}`)
  fs.renameSync(CALL_LOG_FILE, backupPath)

  return {
    migrated: true,
    fileCount: grouped.size,
    totalRows: oldRows.length,
  }
}

/**
 * 获取存储统计信息
 */
function getCallLogStorageStats() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('qms_call_log_list_') && f.endsWith('.json'))
    .map(f => path.join(DATA_DIR, f))

  let totalRows = 0
  let totalSize = 0
  let earliest = null
  let latest = null

  for (const file of files) {
    const match = file.match(/qms_call_log_list_(\d{4}-\d{2}-\d{2})\.json$/)
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
  console.log('  开始迁移通话清单数据...')
  console.log('========================================\n')

  try {
    // 执行迁移
    const result = await migrateOldCallLogData()

    if (result.migrated) {
      console.log('\n✓ 迁移成功！')
      console.log(`  - 创建文件数：${result.fileCount}`)
      console.log(`  - 迁移记录数：${result.totalRows}`)

      // 显示统计信息
      const stats = getCallLogStorageStats()
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
