const fs = require('fs');
const path = require('path');
const http = require('http');

// 配置
const API_URL = 'http://localhost:5001/api/cxcc/recordings/update-local';
const LOG_FILE = path.join(__dirname, '..', 'logs', 'sync-today-recordings.log');

// 确保日志目录存在
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 写日志函数
function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}`;
  console.log(logEntry);
  fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

// 发送HTTP POST请求
function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data))
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

// 同步今天的录音数据
async function syncTodayRecordings() {
  writeLog('开始同步今天的录音数据');
  
  try {
    // 获取今天的日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const startTime = `${todayStr} 00:00:00`;
    const endTime = `${todayStr} 23:59:59`;
    
    writeLog(`同步日期: ${todayStr}`);
    writeLog(`时间范围: ${startTime} 到 ${endTime}`);
    
    // 调用API更新本地文件
    writeLog('调用API更新本地录音清单文件');
    
    const response = await postRequest(API_URL, {
      pageNum: 1,
      pageSize: 100000,
      agentNo: '',
      projectId: '',
      startTime: startTime,
      endTime: endTime
    });
    
    if (response.code === 0) {
      writeLog(`录音清单同步成功: ${response.data.message}`, 'SUCCESS');
    } else {
      writeLog(`录音清单同步失败: ${response.message}`, 'ERROR');
    }
    
  } catch (error) {
    writeLog(`同步过程中出错: ${error.message}`, 'ERROR');
  }
  
  writeLog('录音清单同步任务完成');
}

// 执行同步
syncTodayRecordings();
