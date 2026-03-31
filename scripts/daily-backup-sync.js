const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5001';
const today = new Date().toISOString().split('T')[0];
const logDir = path.join(__dirname, '..', 'data', 'local-sync');
const logFile = path.join(logDir, `backup_sync_${today.replace(/-/g, '')}.log`);
const errorLogFile = path.join(logDir, `backup_sync_error_${today.replace(/-/g, '')}.log`);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toLocaleString('zh-CN');
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(level === 'ERROR' ? '\x1b[31m%s\x1b[0m' : level === 'SUCCESS' ? '\x1b[32m%s\x1b[0m' : '%s', line);
  
  ensureDir(logDir);
  fs.appendFileSync(logFile, line + '\n', 'utf8');
  
  if (level === 'ERROR') {
    fs.appendFileSync(errorLogFile, line + '\n', 'utf8');
  }
}

function sendAlert(message, level = 'ERROR') {
  // 这里可以添加告警通知逻辑，比如发送邮件或消息
  writeLog(`[告警] ${message}`, level);
  // 示例：可以调用第三方API发送通知
  // makeRequest('https://api.example.com/alert', 'POST', { message, level });
}

async function makeRequest(url, method = 'POST', body = null, retries = 3) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const lib = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: method,
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const req = lib.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Failed to parse response: ${data}`));
            }
          });
        });

        req.on('error', reject);
        req.setTimeout(300000); // 5 minutes timeout
        
        if (body) {
          req.write(JSON.stringify(body));
        }
        req.end();
      });
    } catch (error) {
      lastError = error;
      writeLog(`请求失败 (${i + 1}/${retries}): ${error.message}，正在重试...`, 'ERROR');
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒后重试
    }
  }
  
  throw lastError;
}

async function syncRecordings() {
  writeLog('');
  writeLog('[1/4] 同步录音清单数据...');
  const startTime = Date.now();
  
  try {
    // 同步当天数据
    const lookbackDays = 0;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const body = {
      startTime: `${startDateStr} 00:00:00`,
      endTime: `${today} 23:59:59`
    };
    
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/recordings/date-sync?lookbackMinutes=${lookbackDays * 1440}&includeHistory=true&pageSize=200&maxPages=150`, 'POST', body);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.code === 200) {
      writeLog('录音清单同步成功', 'SUCCESS');
      writeLog(`  - 获取记录数：${result.data.fetched}`);
      writeLog(`  - 入库记录数：${result.data.upserted}`);
      writeLog(`  - 失败记录数：${result.data.failed}`);
      writeLog(`  - 历史数据更新数：${result.data.updated || 0}`);
      writeLog(`  - 耗时：${duration}秒`);
      writeLog(`  - 回溯天数：${lookbackDays}天`);
      
      if (result.data.dateDistribution) {
        writeLog('  - 日期分布:');
        Object.entries(result.data.dateDistribution).forEach(([date, count]) => {
          writeLog(`    * ${date}: ${count}条`);
        });
      }
      
      if (result.data.validation) {
        writeLog(`  - 数据校验：${result.data.validation.isValid ? '通过' : '失败'}`);
        if (result.data.validation.details) {
          writeLog(`  - 校验详情：${result.data.validation.details}`);
        }
      }
      
      return true;
    } else {
      writeLog(`录音清单同步失败：${result.message}`, 'ERROR');
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR');
      }
      sendAlert(`录音清单同步失败：${result.message}`);
      return false;
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`录音清单同步异常：${error.message}`, 'ERROR');
    writeLog(`  耗时：${duration}秒`, 'ERROR');
    sendAlert(`录音清单同步异常：${error.message}`);
    return false;
  }
}

async function syncCallLogs() {
  writeLog('');
  writeLog('[2/4] 同步通话清单数据...');
  const startTime = Date.now();
  
  try {
    // 只回溯当天数据
    const lookbackDays = 0;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const body = {
      startTime: `${startDateStr} 00:00:00`,
      endTime: `${today} 23:59:59`
    };
    
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/call-logs?pageSize=200&maxPages=150`, 'POST', body);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.code === 200) {
      writeLog('通话清单同步成功', 'SUCCESS');
      writeLog(`  - 获取记录数：${result.data.fetched}`);
      writeLog(`  - 入库记录数：${result.data.upserted}`);
      writeLog(`  - 失败记录数：0`);
      writeLog(`  - 历史数据更新数：0`);
      writeLog(`  - 耗时：${duration}秒`);
      writeLog(`  - 回溯天数：${lookbackDays}天`);
      return true;
    } else {
      writeLog(`通话清单同步失败：${result.message}`, 'ERROR');
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR');
      }
      sendAlert(`通话清单同步失败：${result.message}`);
      return false;
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`通话清单同步异常：${error.message}`, 'ERROR');
    writeLog(`  耗时：${duration}秒`, 'ERROR');
    sendAlert(`通话清单同步异常：${error.message}`);
    return false;
  }
}

async function syncTeams() {
  writeLog('');
  writeLog('[3/4] 同步外呼团队数据...');
  const startTime = Date.now();
  
  try {
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/teams`);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.code === 200) {
      writeLog('外呼团队数据同步成功', 'SUCCESS');
      writeLog(`  - 同步团队数：${result.data.count}`);
      writeLog(`  - 耗时：${duration}秒`);
      
      // 按日期存储团队数据
      const teamFile = path.join(logDir, `qms_team_list_${today}.json`);
      fs.writeFileSync(teamFile, JSON.stringify(result.data.teams || result.data, null, 2), 'utf8');
      writeLog(`  - 数据已存储到：${teamFile}`, 'SUCCESS');
      
      return true;
    } else {
      writeLog(`外呼团队数据同步失败：${result.message}`, 'ERROR');
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR');
      }
      sendAlert(`外呼团队数据同步失败：${result.message}`);
      return false;
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`外呼团队数据同步异常：${error.message}`, 'ERROR');
    writeLog(`  耗时：${duration}秒`, 'ERROR');
    sendAlert(`外呼团队数据同步异常：${error.message}`);
    return false;
  }
}

async function syncAgents() {
  writeLog('');
  writeLog('[4/4] 同步坐席设置数据...');
  const startTime = Date.now();
  
  try {
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/agents`);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.code === 200) {
      writeLog('坐席设置数据同步成功', 'SUCCESS');
      writeLog(`  - 同步坐席数：${result.data.count}`);
      writeLog(`  - 耗时：${duration}秒`);
      
      // 按日期存储坐席数据
      const agentFile = path.join(logDir, `qms_agent_list_${today}.json`);
      fs.writeFileSync(agentFile, JSON.stringify(result.data.agents || result.data, null, 2), 'utf8');
      writeLog(`  - 数据已存储到：${agentFile}`, 'SUCCESS');
      
      return true;
    } else {
      writeLog(`坐席设置数据同步失败：${result.message}`, 'ERROR');
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR');
      }
      sendAlert(`坐席设置数据同步失败：${result.message}`);
      return false;
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`坐席设置数据同步异常：${error.message}`, 'ERROR');
    writeLog(`  耗时：${duration}秒`, 'ERROR');
    sendAlert(`坐席设置数据同步异常：${error.message}`);
    return false;
  }
}

async function validateData() {
  writeLog('');
  writeLog('验证同步数据完整性...');
  
  try {
    // 检查文件是否存在
    const recordingFile = path.join(logDir, `qms_recording_list_${today}.json`);
    const callLogFile = path.join(logDir, `qms_call_log_list_${today}.json`);
    const teamFile = path.join(logDir, `qms_team_list_${today}.json`);
    const agentFile = path.join(logDir, `qms_agent_list_${today}.json`);
    
    const files = [
      { name: '录音清单', path: recordingFile },
      { name: '通话清单', path: callLogFile },
      { name: '团队数据', path: teamFile },
      { name: '坐席数据', path: agentFile }
    ];
    
    let allValid = true;
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        const stats = fs.statSync(file.path);
        if (stats.size > 0) {
          writeLog(`  ${file.name} 文件存在且有数据`, 'SUCCESS');
        } else {
          writeLog(`  ${file.name} 文件存在但为空`, 'ERROR');
          allValid = false;
        }
      } else {
        writeLog(`  ${file.name} 文件不存在`, 'ERROR');
        allValid = false;
      }
    }
    
    return allValid;
  } catch (error) {
    writeLog(`数据验证异常：${error.message}`, 'ERROR');
    return false;
  }
}

async function main() {
  writeLog('========================================');
  writeLog(`开始每日兜底数据同步 (${today})`);
  writeLog('========================================');
  
  const recordingSuccess = await syncRecordings();
  const callLogSuccess = await syncCallLogs();
  const teamSuccess = await syncTeams();
  const agentSuccess = await syncAgents();
  
  const dataValidation = await validateData();
  
  writeLog('');
  writeLog('========================================');
  writeLog('同步完成总结', 'SUCCESS');
  writeLog('========================================');
  writeLog(`日期：${today}`);
  writeLog(`录音清单：${recordingSuccess ? '完成' : '失败'}`);
  writeLog(`通话清单：${callLogSuccess ? '完成' : '失败'}`);
  writeLog(`外呼团队：${teamSuccess ? '完成' : '失败'}`);
  writeLog(`坐席设置：${agentSuccess ? '完成' : '失败'}`);
  writeLog(`数据验证：${dataValidation ? '通过' : '失败'}`);
  writeLog(`日志文件：${logFile}`);
  if (fs.existsSync(errorLogFile)) {
    writeLog(`错误日志：${errorLogFile}`);
  }
  writeLog('========================================');
  
  const allSuccess = recordingSuccess && callLogSuccess && teamSuccess && agentSuccess && dataValidation;
  
  if (!allSuccess) {
    sendAlert('每日兜底数据同步存在失败项，请检查日志');
  } else {
    writeLog('每日兜底数据同步全部完成', 'SUCCESS');
  }
  
  process.exit(allSuccess ? 0 : 1);
}

main().catch(err => {
  writeLog(`未捕获的错误：${err.message}`, 'ERROR');
  sendAlert(`每日兜底数据同步脚本异常：${err.message}`);
  process.exit(1);
});
