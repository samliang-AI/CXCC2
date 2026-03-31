// 文件解析工具 - 解析用户上传的 Excel/CSV 文件
'use client'

import * as XLSX from 'xlsx'

/** 最大保留行数，避免 localStorage 过大 */
const MAX_ROWS = 50000

function toRow(headers: string[], values: string[]): Record<string, string> {
  const row: Record<string, string> = {}
  headers.forEach((h, i) => { row[h] = values[i] || '' })
  return row
}

/**
 * 解析 CSV 文件内容（返回全部数据）
 */
export function parseCSV(content: string): {
  previewRows: Record<string, string>[]
  allRows: Record<string, string>[]
  columns: string[]
  actualRecords: number
} {
  try {
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
    const lines = content.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) {
      return { previewRows: [], allRows: [], columns: [], actualRecords: 0 }
    }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const allRows: Record<string, string>[] = []
    const dataLines = lines.slice(1)
    for (let i = 0; i < Math.min(dataLines.length, MAX_ROWS); i++) {
      const values = dataLines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v =>
        v.trim().replace(/^"|"$/g, '')
      )
      allRows.push(toRow(headers, values))
    }
    return {
      previewRows: allRows.slice(0, 5),
      allRows,
      columns: headers,
      actualRecords: dataLines.length
    }
  } catch (error) {
    console.error('CSV 解析失败:', error)
    return { previewRows: [], allRows: [], columns: [], actualRecords: 0 }
  }
}

/**
 * 解析 Excel 文件 (.xlsx/.xls)，返回全部数据
 */
export async function parseExcel(file: File): Promise<{
  previewRows: Record<string, string>[]
  allRows: Record<string, string>[]
  columns: string[]
  actualRecords: number
}> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result as ArrayBuffer
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet)
          if (jsonData.length === 0) {
            resolve({ previewRows: [], allRows: [], columns: [], actualRecords: 0 })
            return
          }
          const columns = Object.keys(jsonData[0])
          const toStr = (v: unknown): string => {
            if (v instanceof Date) return v.toLocaleDateString('zh-CN')
            if (typeof v === 'number') return v.toString()
            if (v === null || v === undefined) return ''
            return String(v)
          }
          const allRows = jsonData.slice(0, MAX_ROWS).map(row => {
            const parsed: Record<string, string> = {}
            columns.forEach(col => { parsed[col] = toStr(row[col]) })
            return parsed
          })
          resolve({
            previewRows: allRows.slice(0, 5),
            allRows,
            columns,
            actualRecords: jsonData.length
          })
        } catch (error) {
          console.error('Excel 文件解析失败:', error)
          reject(error)
        }
      }
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }
      
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Excel 解析错误:', error)
      reject(error)
    }
  })
}

/**
 * 解析 JSON 文件，返回全部数据
 */
export function parseJSON(content: string): {
  previewRows: Record<string, string>[]
  allRows: Record<string, string>[]
  columns: string[]
  actualRecords: number
} {
  try {
    const data = JSON.parse(content)
    const array = Array.isArray(data) ? data : [data]
    if (array.length === 0) {
      return { previewRows: [], allRows: [], columns: [], actualRecords: 0 }
    }
    const columns = Object.keys(array[0])
    const allRows = array.slice(0, MAX_ROWS).map((row: Record<string, unknown>) => {
      const parsed: Record<string, string> = {}
      columns.forEach(col => {
        const v = row[col]
        parsed[col] = v === null || v === undefined ? '' : String(v)
      })
      return parsed
    })
    return {
      previewRows: allRows.slice(0, 5),
      allRows,
      columns,
      actualRecords: array.length
    }
  } catch (error) {
    console.error('JSON 解析失败:', error)
    return { previewRows: [], allRows: [], columns: [], actualRecords: 0 }
  }
}

/**
 * 根据文件类型选择解析方法，返回全部数据（最多 MAX_ROWS 行）
 */
export async function parseFile(file: File): Promise<{
  previewRows: Record<string, string>[]
  allRows: Record<string, string>[]
  columns: string[]
  actualRecords: number
}> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  try {
    if (extension === 'csv') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string
            resolve(parseCSV(content))
          } catch (error) {
            reject(error)
          }
        }
        reader.onerror = () => reject(new Error('文件读取失败'))
        reader.readAsText(file, 'UTF-8')
      })
    } else if (extension === 'json') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string
            resolve(parseJSON(content))
          } catch (error) {
            reject(error)
          }
        }
        reader.onerror = () => reject(new Error('文件读取失败'))
        reader.readAsText(file, 'UTF-8')
      })
    } else if (extension === 'xlsx' || extension === 'xls') {
      return await parseExcel(file)
    } else {
      throw new Error(`不支持的文件格式：.${extension}`)
    }
  } catch (error: any) {
    console.error('文件解析失败:', error)
    throw error
  }
}
