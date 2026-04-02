import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data', 'team-targets')

// 确保数据目录存在
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

// 获取指定月份的文件路径
function getTargetFilePath(month: string) {
  return path.join(DATA_DIR, `team-targets-${month}.json`)
}

// GET - 获取团队目标数据
export async function GET(request: NextRequest) {
  try {
    // 使用 request.nextUrl.searchParams 直接获取查询参数，避免使用 request.url
    const month = request.nextUrl.searchParams.get('month')
    
    if (!month) {
      return NextResponse.json({ code: 400, message: '缺少月份参数' }, { status: 400 })
    }
    
    await ensureDataDir()
    
    const filePath = getTargetFilePath(month)
    
    try {
      const data = await readFile(filePath, 'utf-8')
      const targets = JSON.parse(data)
      return NextResponse.json({
        code: 0,
        message: 'OK',
        data: targets
      })
    } catch (error: any) {
      if (error.code === 'ENOENT') {
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
    console.error('获取团队目标数据失败:', error)
    return NextResponse.json(
      { code: 500, message: error?.message || '服务器错误' },
      { status: 500 }
    )
  }
}

// POST - 保存团队目标数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamKey, teamName, month, targetCalls, targetConnected, targetSuccess, revenuePerSuccess } = body
    
    if (!teamKey || !month) {
      return NextResponse.json({ code: 400, message: '缺少必要参数' }, { status: 400 })
    }
    
    await ensureDataDir()
    
    const filePath = getTargetFilePath(month)
    
    // 读取现有数据
    let targets: any[] = []
    try {
      const data = await readFile(filePath, 'utf-8')
      targets = JSON.parse(data)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
    
    // 查找是否已存在该团队的目标
    const existingIndex = targets.findIndex(t => t.teamKey === teamKey)
    
    const targetData = {
      teamKey,
      teamName: teamName || '',
      month,
      targetCalls: Number(targetCalls) || 0,
      targetConnected: Number(targetConnected) || 0,
      targetSuccess: Number(targetSuccess) || 0,
      revenuePerSuccess: Number(revenuePerSuccess) || 0
    }
    
    if (existingIndex >= 0) {
      // 更新现有目标
      targets[existingIndex] = targetData
    } else {
      // 添加新目标
      targets.push(targetData)
    }
    
    // 写入文件
    await writeFile(filePath, JSON.stringify(targets, null, 2), 'utf-8')
    
    return NextResponse.json({
      code: 0,
      message: '保存成功',
      data: targets
    })
  } catch (error: any) {
    console.error('保存团队目标数据失败:', error)
    return NextResponse.json(
      { code: 500, message: error?.message || '服务器错误' },
      { status: 500 }
    )
  }
}
