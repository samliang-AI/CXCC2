// 同步外呼团队和坐席设置数据
const http = require('http');
const fs = require('fs');
const path = require('path');

// 日志函数
function log(level, message) {
  const timestamp = new Date().toLocaleString('zh-CN');
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  // 写入日志文件
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, 'sync-teams-agents.log');
  fs.appendFileSync(logFile, logMessage + '\n');
}

// HTTP GET 请求函数
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`请求失败: ${error.message}`));
    });
  });
}

// 同步团队数据
async function syncTeams() {
  log('INFO', '开始同步外呼团队数据...');
  
  try {
    const data = await httpGet('http://localhost:3000/api/local/teams');
    
    if (data.code === 200) {
      const teams = data.data.list;
      log('INFO', `获取到 ${teams.length} 个团队数据`);
      
      // 保存到本地文件
      const teamFile = path.join(__dirname, '..', 'data', 'local-sync', 'qms_team_list.json');
      const teamDir = path.dirname(teamFile);
      if (!fs.existsSync(teamDir)) {
        fs.mkdirSync(teamDir, { recursive: true });
      }
      
      // 读取现有数据
      let existingTeams = [];
      if (fs.existsSync(teamFile)) {
        try {
          existingTeams = JSON.parse(fs.readFileSync(teamFile, 'utf-8'));
        } catch (e) {
          log('ERROR', '读取现有团队数据失败，将创建新文件');
          existingTeams = [];
        }
      }
      
      // 合并数据
      const teamMap = new Map();
      
      // 先添加现有数据
      for (const team of existingTeams) {
        const key = team.id || team.skillgroupId || team.teamId || team.name || team.skillGroupName;
        if (key) {
          teamMap.set(key, team);
        }
      }
      
      // 再添加新数据
      for (const team of teams) {
        const key = team.id || team.skillgroupId || team.teamId || team.name || team.skillGroupName;
        if (key) {
          teamMap.set(key, team);
        }
      }
      
      // 保存合并后的数据
      const mergedTeams = Array.from(teamMap.values());
      fs.writeFileSync(teamFile, JSON.stringify(mergedTeams, null, 2));
      
      // 创建带有日期的备份文件
      const today = new Date().toISOString().split('T')[0];
      const datedTeamFile = path.join(__dirname, '..', 'data', 'local-sync', `qms_team_list_${today}.json`);
      fs.writeFileSync(datedTeamFile, JSON.stringify(mergedTeams, null, 2));
      
      log('SUCCESS', `成功同步 ${mergedTeams.length} 个团队数据到本地文件`);
      log('INFO', `创建团队数据备份文件: ${datedTeamFile}`);
      
      return mergedTeams.length;
    } else {
      log('ERROR', `获取团队数据失败: ${data.message}`);
      return 0;
    }
  } catch (error) {
    log('ERROR', `同步团队数据时发生错误: ${error.message}`);
    return 0;
  }
}

// 同步坐席数据
async function syncAgents() {
  log('INFO', '开始同步坐席设置数据...');
  
  try {
    const data = await httpGet('http://localhost:3000/api/local/agents?pageSize=1000');
    
    if (data.code === 200) {
      const agents = data.data.list;
      log('INFO', `获取到 ${agents.length} 个坐席数据`);
      
      // 保存到本地文件
      const agentFile = path.join(__dirname, '..', 'data', 'local-sync', 'qms_agent_list.json');
      const agentDir = path.dirname(agentFile);
      if (!fs.existsSync(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true });
      }
      
      // 读取现有数据
      let existingAgents = [];
      if (fs.existsSync(agentFile)) {
        try {
          existingAgents = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));
        } catch (e) {
          log('ERROR', '读取现有坐席数据失败，将创建新文件');
          existingAgents = [];
        }
      }
      
      // 合并数据
      const agentMap = new Map();
      
      // 先添加现有数据
      for (const agent of existingAgents) {
        const key = agent.agent || agent.agentNo || agent.username || agent.workNumber || agent.id;
        if (key) {
          agentMap.set(key, agent);
        }
      }
      
      // 再添加新数据
      for (const agent of agents) {
        const key = agent.agent || agent.agentNo || agent.username || agent.workNumber || agent.id;
        if (key) {
          agentMap.set(key, agent);
        }
      }
      
      // 保存合并后的数据
      const mergedAgents = Array.from(agentMap.values());
      fs.writeFileSync(agentFile, JSON.stringify(mergedAgents, null, 2));
      
      // 创建带有日期的备份文件
      const today = new Date().toISOString().split('T')[0];
      const datedAgentFile = path.join(__dirname, '..', 'data', 'local-sync', `qms_agent_list_${today}.json`);
      fs.writeFileSync(datedAgentFile, JSON.stringify(mergedAgents, null, 2));
      
      log('SUCCESS', `成功同步 ${mergedAgents.length} 个坐席数据到本地文件`);
      log('INFO', `创建坐席数据备份文件: ${datedAgentFile}`);
      
      return mergedAgents.length;
    } else {
      log('ERROR', `获取坐席数据失败: ${data.message}`);
      return 0;
    }
  } catch (error) {
    log('ERROR', `同步坐席数据时发生错误: ${error.message}`);
    return 0;
  }
}

// 主函数
async function main() {
  log('INFO', '========================================');
  log('INFO', '开始外呼团队和坐席设置数据同步');
  log('INFO', '========================================');
  
  const teamCount = await syncTeams();
  const agentCount = await syncAgents();
  
  log('INFO', '========================================');
  log('INFO', `同步完成：团队 ${teamCount} 个，坐席 ${agentCount} 个`);
  log('INFO', '========================================');
}

// 执行同步
main().catch(error => {
  log('ERROR', `同步过程中发生错误: ${error.message}`);
  process.exit(1);
});
