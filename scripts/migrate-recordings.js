#!/usr/bin/env node

/**
 * 录音数据迁移脚本
 * 将旧版单文件数据迁移到按日期分文件存储
 */

// 使用动态导入处理 TypeScript 模块
async function main() {
  console.log('========================================')
  console.log('  开始迁移录音数据...')
  console.log('========================================\n')
  
  try {
    // 动态导入 TypeScript 模块
    const module = await import('../src/lib/local-recording-store-optimized.js')
    const { migrateOldRecordingData, getRecordingStorageStats } = module
    
    // 执行迁移
    const result = await migrateOldRecordingData()
    
    if (result.migrated) {
      console.log('✓ 迁移成功！')
      console.log(`  - 创建文件数：${result.fileCount}`)
      console.log(`  - 迁移记录数：${result.totalRows}`)
      
      // 显示统计信息
      const stats = await getRecordingStorageStats()
      console.log('\n当前存储状态:')
      console.log(`  - 总文件数：${stats.totalFiles}`)
      console.log(`  - 总记录数：${stats.totalRows}`)
      console.log(`  - 日期范围：${stats.dateRange.earliest} 至 ${stats.dateRange.latest}`)
      console.log(`  - 总大小：${(stats.fileSize / 1024 / 1024).toFixed(2)} MB`)
      
      console.log('\n========================================')
      console.log('  迁移完成！')
      console.log('========================================\n')
    } else {
      console.log('⚠ 无需迁移或迁移失败')
      console.log('  可能原因：')
      console.log('  1. 旧文件不存在')
      console.log('  2. 旧文件为空')
      console.log('  3. 已经使用新格式')
      
      console.log('\n========================================\n')
    }
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    console.error('\n错误详情:', error instanceof Error ? error.message : String(error))
    console.log('\n========================================\n')
    process.exit(1)
  }
}

main()
