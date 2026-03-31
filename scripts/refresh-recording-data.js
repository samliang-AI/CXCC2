const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5001';
const today = new Date().toISOString().split('T')[0];
const recordingFile = path.join(__dirname, '..', 'data', 'local-sync', `qms_recording_list_${today}.json`);

function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toLocaleString('zh-CN');
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(level === 'ERROR' ? '\x1b[31m%s\x1b[0m' : level === 'SUCCESS' ? '\x1b[32m%s\x1b[0m' : '%s', line);
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

async function refreshRecordingData() {
  writeLog('========================================');
  writeLog(`开始刷新录音清单数据 (${today})`);
  writeLog('========================================');
  
  // 1. 清除当前文件内容
  writeLog('清除当前录音清单数据文件...');
  try {
    fs.writeFileSync(recordingFile, '[]', 'utf8');
    writeLog('文件已清除', 'SUCCESS');
  } catch (error) {
    writeLog(`清除文件失败: ${error.message}`, 'ERROR');
    return false;
  }
  
  // 2. 重新从API获取数据
  writeLog('重新从API获取录音清单数据...');
  try {
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/recordings/date-sync?lookbackMinutes=0&includeHistory=true`);
    
    if (result.code === 200) {
      writeLog('录音清单同步成功', 'SUCCESS');
      writeLog(`  - 获取记录数：${result.data.fetched}`);
      writeLog(`  - 入库记录数：${result.data.upserted}`);
      
      // 3. 验证文件是否已更新
      if (fs.existsSync(recordingFile)) {
        const fileSize = fs.statSync(recordingFile).size;
        writeLog(`  - 文件已保存：${recordingFile}`, 'SUCCESS');
        writeLog(`  - 文件大小：${fileSize} 字节`, 'SUCCESS');
      } else {
        writeLog('  - 文件未找到', 'ERROR');
        return false;
      }
      
      return true;
    } else {
      writeLog(`录音清单同步失败：${result.message}`, 'ERROR');
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR');
      }
      return false;
    }
  } catch (error) {
    writeLog(`录音清单同步异常：${error.message}`, 'ERROR');
    return false;
  }
}

refreshRecordingData().then(success => {
  writeLog('========================================');
  writeLog(success ? '刷新完成' : '刷新失败', success ? 'SUCCESS' : 'ERROR');
  writeLog('========================================');
  process.exit(success ? 0 : 1);
}).catch(err => {
  writeLog(`未捕获的错误：${err.message}`, 'ERROR');
  process.exit(1);
});
