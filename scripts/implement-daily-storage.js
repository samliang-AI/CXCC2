import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 主数据文件路径
const agentListPath = path.join(__dirname, '../data/local-sync/qms_agent_list.json');
const teamListPath = path.join(__dirname, '../data/local-sync/qms_team_list.json');

// 目标存储目录
const storageDir = path.join(__dirname, '../data/daily-configs');

// 确保存储目录存在
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
  console.log(`创建存储目录: ${storageDir}`);
}

// 生成日期字符串 (YYYY-MM-DD)
function getDateString(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// 读取当前主数据
function readCurrentData() {
  try {
    const agents = JSON.parse(fs.readFileSync(agentListPath, 'utf8'));
    const teams = JSON.parse(fs.readFileSync(teamListPath, 'utf8'));
    return { agents, teams };
  } catch (error) {
    console.error('读取主数据文件失败:', error.message);
    return { agents: [], teams: [] };
  }
}

// 保存数据到按日文件
function saveDailyData(dateString, data) {
  const agentFile = path.join(storageDir, `qms_agent_list_${dateString}.json`);
  const teamFile = path.join(storageDir, `qms_team_list_${dateString}.json`);
  
  // 保存坐席数据
  fs.writeFileSync(agentFile, JSON.stringify(data.agents, null, 2), 'utf8');
  console.log(`保存坐席数据到: ${agentFile}`);
  
  // 保存团队数据
  fs.writeFileSync(teamFile, JSON.stringify(data.teams, null, 2), 'utf8');
  console.log(`保存团队数据到: ${teamFile}`);
  
  return { agentFile, teamFile };
}

// 检查是否已经存在当天的数据文件
function checkExistingDailyData(dateString) {
  const agentFile = path.join(storageDir, `qms_agent_list_${dateString}.json`);
  const teamFile = path.join(storageDir, `qms_team_list_${dateString}.json`);
  
  return {
    agentExists: fs.existsSync(agentFile),
    teamExists: fs.existsSync(teamFile)
  };
}

// 生成历史数据（如果需要）
function generateHistoricalData(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dateString = getDateString(currentDate);
    const existing = checkExistingDailyData(dateString);
    
    if (!existing.agentExists || !existing.teamExists) {
      console.log(`生成 ${dateString} 的数据文件...`);
      // 使用当前数据作为历史数据（实际应用中应该从备份或其他来源获取）
      const currentData = readCurrentData();
      saveDailyData(dateString, currentData);
    } else {
      console.log(`${dateString} 的数据文件已存在，跳过`);
    }
    
    // 增加一天
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

// 主函数
function main() {
  console.log('=== 实施按日独立存储机制 ===');
  
  // 获取当前日期
  const today = getDateString();
  console.log(`当前日期: ${today}`);
  
  // 检查是否已有当天的数据文件
  const existing = checkExistingDailyData(today);
  
  if (existing.agentExists && existing.teamExists) {
    console.log('当天的数据文件已存在');
  } else {
    console.log('创建当天的数据文件...');
    const currentData = readCurrentData();
    const savedFiles = saveDailyData(today, currentData);
    console.log('数据文件创建完成');
  }
  
  // 生成历史数据（可选）
  // 例如：生成3月1日到今天的历史数据
  const startOfMonth = '2026-03-01';
  console.log(`\n生成 ${startOfMonth} 到 ${today} 的历史数据...`);
  generateHistoricalData(startOfMonth, today);
  
  console.log('\n=== 按日独立存储机制实施完成 ===');
  
  // 统计生成的文件
  const agentFiles = fs.readdirSync(storageDir).filter(file => file.startsWith('qms_agent_list_'));
  const teamFiles = fs.readdirSync(storageDir).filter(file => file.startsWith('qms_team_list_'));
  
  console.log(`\n生成的文件统计:`);
  console.log(`坐席配置文件: ${agentFiles.length} 个`);
  console.log(`团队配置文件: ${teamFiles.length} 个`);
  
  // 显示最近的几个文件
  console.log(`\n最近的文件:`);
  agentFiles.sort().reverse().slice(0, 5).forEach(file => {
    console.log(`  - ${file}`);
  });
}

// 执行主函数
main();
