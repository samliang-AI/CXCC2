#!/usr/bin/env node

/**
 * 计算通话记录文件中的数据条数
 */

const fs = require('fs')
const path = require('path')

const FILE_PATH = path.join(process.cwd(), 'data', 'local-sync', 'qms_call_log_list_2026-03-22.json')

function countCallLogs() {
  try {
    console.log('读取文件中...')
    const content = fs.readFileSync(FILE_PATH, 'utf-8')
    
    console.log('解析 JSON...')
    const data = JSON.parse(content)
    
    if (Array.isArray(data)) {
      console.log(`文件中共有 ${data.length} 条数据`)
      return data.length
    } else {
      console.error('文件内容不是 JSON 数组')
      return 0
    }
  } catch (error) {
    console.error('读取或解析文件失败:', error.message)
    return 0
  }
}

countCallLogs()
