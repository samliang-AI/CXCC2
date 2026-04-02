import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data', 'project-revenues')

// 确保数据目录存在
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

// 获取指定月份的文件路径
function getRevenueFilePath(month: string) {
  return path.join(DATA_DIR, `project-revenues-${month}.json`)
}

// GET - 获取项目收益配置数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    
    console.log('[项目收益 API-GET] 请求月份:', month)
    
    if (!month) {
      return NextResponse.json({ code: 400, message: '缺少月份参数' }, { status: 400 })
    }
    
    await ensureDataDir()
    
    const filePath = getRevenueFilePath(month)
    console.log('[项目收益 API-GET] 文件路径:', filePath)
    
    try {
      const data = await readFile(filePath, 'utf-8')
      const revenues = JSON.parse(data)
      console.log('[项目收益 API-GET] 读取到', revenues.length, '条数据')
      return NextResponse.json({
        code: 0,
        message: 'OK',
        data: revenues
      })
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[项目收益 API-GET] 文件不存在，返回空数组')
        // 文件不存在，返回空数组
        return NextResponse.json({
          code: 0,
          message: 'OK',
          data: []
        })
      }
      throw error
    }
  } catch (error: any) {
    console.error('[项目收益 API-GET] 获取失败:', error)
    return NextResponse.json(
      { code: 500, message: error?.message || '服务器错误' },
      { status: 500 }
    )
  }
}

// POST - 保存项目收益配置数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[项目收益 API] 接收到的数据:', body)
    
    const { cityKey, cityName, projectKey, projectName, teamKey, teamName, month, revenuePerSuccess } = body
    
    // 支持 cityKey 或 projectKey 作为地市键
    const effectiveProjectKey = cityKey || projectKey
    const effectiveProjectName = cityName || projectName || ''
    
    console.log('[项目收益 API] 处理后的数据:', {
      effectiveProjectKey,
      effectiveProjectName,
      teamKey,
      teamName,
      month,
      revenuePerSuccess
    })
    
    if (!effectiveProjectKey || !teamKey || !month) {
      console.error('[项目收益 API] 缺少必要参数:', { effectiveProjectKey, teamKey, month })
      return NextResponse.json({ code: 400, message: '缺少必要参数' }, { status: 400 })
    }
    
    await ensureDataDir()
    
    const filePath = getRevenueFilePath(month)
    console.log('[项目收益 API] 文件路径:', filePath)
    
    // 读取现有数据
    let revenues: any[] = []
    try {
      const data = await readFile(filePath, 'utf-8')
      revenues = JSON.parse(data)
      console.log('[项目收益 API] 读取到现有数据:', revenues.length, '条')
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[项目收益 API] 文件不存在，创建新文件')
      } else {
        throw error
      }
    }
    
    // 查找是否已存在该项目配置
    const existingIndex = revenues.findIndex(
      r => r.projectKey === effectiveProjectKey && r.teamKey === teamKey
    )
    
    console.log('[项目收益 API] 查找结果:', existingIndex >= 0 ? '找到已有配置' : '未找到，将添加新配置')
    
    const revenueData = {
      projectKey: effectiveProjectKey,
      projectName: effectiveProjectName,
      teamKey,
      teamName: teamName || '',
      month,
      revenuePerSuccess: Number(revenuePerSuccess) || 0,
      targetSuccess: Number(0) || 0
    }
    
    if (existingIndex >= 0) {
      // 更新现有配置
      console.log('[项目收益 API] 更新第', existingIndex, '条记录')
      revenues[existingIndex] = revenueData
    } else {
      // 添加新配置
      console.log('[项目收益 API] 添加新记录')
      revenues.push(revenueData)
    }
    
    console.log('[项目收益 API] 准备写入', revenues.length, '条数据')
    
    // 写入文件
    await writeFile(filePath, JSON.stringify(revenues, null, 2), 'utf-8')
    console.log('[项目收益 API] 写入成功')
    
    return NextResponse.json({
      code: 0,
      message: '保存成功',
      data: revenues
    })
  } catch (error: any) {
    console.error('[项目收益 API] 保存失败:', error)
    return NextResponse.json(
      { code: 500, message: error?.message || '服务器错误' },
      { status: 500 }
    )
  }
}
