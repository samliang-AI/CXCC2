const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5000';
const today = new Date().toISOString().split('T')[0];
const logDir = path.join(__dirname, '..', 'data', 'local-sync');
const logFile = path.join(logDir, `sync_today_${today.replace(/-/g, '')}.log`);

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
}

async function makeRequest(url, method = 'POST', body = null) {
  return new Promise((resolve, reject) => {
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
}

async function syncRecordings() {
  writeLog('');
  writeLog('[1/2] 同步录音清单数据...');
  const startTime = Date.now();
  
  try {
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/recordings/date-sync?lookbackMinutes=1440`);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.code === 200) {
      writeLog('录音清单同步成功', 'SUCCESS');
      writeLog(`  - 获取记录数：${result.data.fetched}`);
      writeLog(`  - 入库记录数：${result.data.upserted}`);
      writeLog(`  - 失败记录数：${result.data.failed}`);
      writeLog(`  - 耗时：${duration}秒`);
      
      if (result.data.dateDistribution) {
        writeLog('  - 日期分布:');
        Object.entries(result.data.dateDistribution).forEach(([date, count]) => {
          writeLog(`    * ${date}: ${count}条`);
        });
      }
      
      if (result.data.validation) {
        writeLog(`  - 数据校验：${result.data.validation.isValid ? '通过' : '失败'}`);
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
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`录音清单同步异常：${error.message}`, 'ERROR');
    writeLog(`  耗时：${duration}秒`, 'ERROR');
    return false;
  }
}

async function syncCallLogs() {
  writeLog('');
  writeLog('[2/2] 同步通话清单数据...');
  const startTime = Date.now();
  
  try {
    const body = {
      startTime: `${today} 00:00:00`,
      endTime: `${today} 23:59:59`,
      sliceMinutes: 60,
      pageSize: 200,
      maxPagesPerSlice: 150,
    };
    
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/call-logs/backfill`, 'POST', body);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.code === 200) {
      writeLog('通话清单同步成功', 'SUCCESS');
      writeLog(`  - 获取记录数：${result.data.fetched}`);
      writeLog(`  - 入库记录数：${result.data.upserted}`);
      writeLog(`  - 失败记录数：${result.data.failed}`);
      writeLog(`  - 时间窗口数：${result.data.slices}`);
      writeLog(`  - 耗时：${duration}秒`);
      return true;
    } else {
      writeLog(`通话清单同步失败：${result.message}`, 'ERROR');
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR');
      }
      return false;
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`通话清单同步异常：${error.message}`, 'ERROR');
    writeLog(`  耗时：${duration}秒`, 'ERROR');
    return false;
  }
}

async function main() {
  writeLog('========================================');
  writeLog(`开始同步今日数据 (${today})`);
  writeLog('========================================');
  
  const recordingSuccess = await syncRecordings();
  const callLogSuccess = await syncCallLogs();
  
  writeLog('');
  writeLog('========================================');
  writeLog('同步完成总结', 'SUCCESS');
  writeLog('========================================');
  writeLog(`日期：${today}`);
  writeLog(`录音清单：${recordingSuccess ? '完成' : '失败'}`);
  writeLog(`通话清单：${callLogSuccess ? '完成' : '失败'}`);
  writeLog(`日志文件：${logFile}`);
  writeLog('========================================');
  
  process.exit(recordingSuccess && callLogSuccess ? 0 : 1);
}

main().catch(err => {
  writeLog(`未捕获的错误：${err.message}`, 'ERROR');
  process.exit(1);
});
