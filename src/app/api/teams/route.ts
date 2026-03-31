import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')

export async function GET(request: NextRequest) {
  try {
    // 首先尝试读取最新的团队数据文件 qms_team_list.json
    const mainTeamFile = path.join(DATA_DIR, 'qms_team_list.json')
    
    try {
      const teamData = await fs.readFile(mainTeamFile, 'utf8')
      const teams = JSON.parse(teamData)
      
      // 转换团队数据格式，使用 skillGroupName 作为团队名称
      const formattedTeams = teams.map((team: any) => ({
        id: team.id.toString(),
        name: team.skillGroupName
      }))
      
      return NextResponse.json({
        code: 0,
        message: 'OK',
        data: formattedTeams
      })
    } catch (error) {
      // 如果 qms_team_list.json 不存在，尝试读取日期命名的团队数据文件
      const files = await fs.readdir(DATA_DIR)
      const teamFiles = files.filter(f => f.startsWith('qms_team_list_') && f.endsWith('.json'))
      
      if (teamFiles.length === 0) {
        // 如果没有团队数据文件，返回默认团队数据
        const defaultTeams = [
          { id: 'T001', name: '登封' },
          { id: 'T002', name: '云晟' },
          { id: 'T003', name: '如皓' },
          { id: 'T004', name: '诚聚' },
          { id: 'T005', name: '佳硕' },
          { id: 'T006', name: '聚能' },
          { id: 'T007', name: '腾飞' },
          { id: 'T008', name: '飞越' },
          { id: 'T009', name: '诚服' },
          { id: 'T010', name: '其他' }
        ]
        
        return NextResponse.json({
          code: 0,
          message: 'OK',
          data: defaultTeams
        })
      }
      
      // 按日期排序，获取最新的团队数据文件
      teamFiles.sort((a, b) => {
        const dateA = a.match(/qms_team_list_(\d{4}-\d{2}-\d{2})\.json/)?.[1]
        const dateB = b.match(/qms_team_list_(\d{4}-\d{2}-\d{2})\.json/)?.[1]
        return dateB.localeCompare(dateA)
      })
      
      const latestTeamFile = path.join(DATA_DIR, teamFiles[0])
      const teamData = await fs.readFile(latestTeamFile, 'utf8')
      const teams = JSON.parse(teamData)
      
      // 转换团队数据格式，使用 skillGroupName 作为团队名称
      const formattedTeams = teams.map((team: any) => ({
        id: team.id.toString(),
        name: team.skillGroupName
      }))
      
      return NextResponse.json({
        code: 0,
        message: 'OK',
        data: formattedTeams
      })
    }
  } catch (error) {
    console.error('获取团队数据失败:', error)
    // 发生错误时返回默认团队数据
    const defaultTeams = [
      { id: 'T001', name: '登封' },
      { id: 'T002', name: '云晟' },
      { id: 'T003', name: '如皓' },
      { id: 'T004', name: '诚聚' },
      { id: 'T005', name: '佳硕' },
      { id: 'T006', name: '聚能' },
      { id: 'T007', name: '腾飞' },
      { id: 'T008', name: '飞越' },
      { id: 'T009', name: '诚服' },
      { id: 'T010', name: '其他' }
    ]
    
    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: defaultTeams
    })
  }
}
