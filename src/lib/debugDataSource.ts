// 数据调试工具 - 检查和修复数据一致性问题
'use client'

/**
 * 检查 localStorage 中保存的数据
 */
export function checkStoredData() {
  if (typeof window === 'undefined') {
    console.log('⚠️ 不在浏览器环境')
    return null
  }
  
  const saved = localStorage.getItem('uploadedDataSources')
  if (!saved) {
    console.log('❌ localStorage 中没有保存的数据')
    return null
  }
  
  try {
    const data = JSON.parse(saved)
    console.log('✅ 找到保存的数据:', data)
    
    data.forEach((source: any, index: number) => {
      console.log(`\n📊 数据源 ${index + 1}:`)
      console.log(`  名称：${source.name}`)
      console.log(`  文件名：${source.filename}`)
      console.log(`  记录数 (records): ${source.records}`)
      console.log(`  fileData.actualRecords: ${source.fileData?.actualRecords}`)
      console.log(`  是否一致：${source.records === source.fileData?.actualRecords ? '✅' : '❌'}`)
      
      if (source.records !== source.fileData?.actualRecords) {
        console.warn(`  ⚠️ 记录数不一致！records=${source.records}, actualRecords=${source.fileData?.actualRecords}`)
      }
    })
    
    return data
  } catch (error) {
    console.error('❌ 解析保存的数据失败:', error)
    return null
  }
}

/**
 * 修复 localStorage 中的数据记录数
 */
export function fixStoredData() {
  if (typeof window === 'undefined') {
    console.log('⚠️ 不在浏览器环境')
    return false
  }
  
  const saved = localStorage.getItem('uploadedDataSources')
  if (!saved) {
    console.log('❌ localStorage 中没有保存的数据')
    return false
  }
  
  try {
    const data = JSON.parse(saved)
    let hasChanges = false
    
    data.forEach((source: any) => {
      // 如果有 fileData.actualRecords，使用它来更新 records
      if (source.fileData?.actualRecords && source.records !== source.fileData.actualRecords) {
        console.log(`🔧 修复 ${source.name}: ${source.records} → ${source.fileData.actualRecords}`)
        source.records = source.fileData.actualRecords
        hasChanges = true
      }
    })
    
    if (hasChanges) {
      localStorage.setItem('uploadedDataSources', JSON.stringify(data))
      console.log('✅ 数据已修复并保存')
      return true
    } else {
      console.log('✅ 所有数据都正确，无需修复')
      return false
    }
  } catch (error) {
    console.error('❌ 修复数据失败:', error)
    return false
  }
}

/**
 * 清除所有数据
 */
export function clearAllData() {
  if (typeof window === 'undefined') {
    console.log('⚠️ 不在浏览器环境')
    return false
  }
  
  localStorage.removeItem('uploadedDataSources')
  console.log('✅ 已清除所有保存的数据')
  return true
}

/**
 * 在浏览器控制台执行
 * 使用方法:
 * 1. 打开浏览器开发者工具
 * 2. 在 Console 中输入:
 *    - checkStoredData() - 检查数据
 *    - fixStoredData() - 修复数据
 *    - clearAllData() - 清除数据
 */
if (typeof window !== 'undefined') {
  ;(window as any).debugDataSource = {
    check: checkStoredData,
    fix: fixStoredData,
    clear: clearAllData
  }
  
  console.log('🔧 数据调试工具已加载')
  console.log('使用方法:')
  console.log('  debugDataSource.check() - 检查数据')
  console.log('  debugDataSource.fix() - 修复数据')
  console.log('  debugDataSource.clear() - 清除数据')
}
