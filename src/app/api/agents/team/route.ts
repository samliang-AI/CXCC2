import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const agentName = searchParams.get('agentName')

    if (!agentId && !agentName) {
      return NextResponse.json({
        code: 1,
        message: '缺少坐席工号或坐席名称参数',
        data: null
      })
    }

    // 读取坐席数据文件
    const agentFile = path.join(DATA_DIR, 'qms_agent_list.json')
    let agentData
    
    try {
      agentData = await fs.readFile(agentFile, 'utf8')
    } catch (error) {
      console.error('读取坐席数据文件失败:', error)
      // 如果坐席数据文件不存在，返回默认值
      return NextResponse.json({
        code: 0,
        message: 'OK',
        data: {
          teamName: '诚服'
        }
      })
    }

    const agents = JSON.parse(agentData)
    
    // 查找匹配的坐席
    let matchedAgent = null
    
    if (agentId) {
      matchedAgent = agents.find((agent: any) => agent.username.toString() === agentId)
    }
    
    if (!matchedAgent && agentName) {
      // 这里可以根据实际情况调整匹配逻辑
      matchedAgent = agents.find((agent: any) => agent.name === agentName)
    }

    if (matchedAgent) {
      return NextResponse.json({
        code: 0,
        message: 'OK',
        data: {
          teamName: matchedAgent.skillGroupName || '诚服'
        }
      })
    } else {
      // 如果没有找到匹配的坐席，返回默认值
      return NextResponse.json({
        code: 0,
        message: 'OK',
        data: {
          teamName: '诚服'
        }
      })
    }
  } catch (error) {
    console.error('获取坐席团队失败:', error)
    return NextResponse.json({
      code: 1,
      message: '获取坐席团队失败',
      data: null
    })
  }
}
