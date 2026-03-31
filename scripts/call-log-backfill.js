const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5000';
const startDate = new Date('2023-03-01');
const endDate = new Date('2023-03-05');
const logDir = path.join(__dirname, '..', 'data', 'local-sync');
const logFile = path.join(logDir, `call_log_backfill_${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}_${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}.log`);
const errorLogFile = path.join(logDir, `call_log_backfill_error_${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}_${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}.log`);

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
  writeLog(`[告警] ${message}`, level);
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

        writeLog(`发送请求: ${method} ${url}`, 'INFO');
        writeLog(`请求参数: ${JSON.stringify(body)}`, 'INFO');

        const req = lib.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              writeLog(`响应状态码: ${res.statusCode}`, 'INFO');
              writeLog(`响应数据: ${data.substring(0, 500)}${data.length > 500 ? '...' : ''}`, 'INFO');
              resolve(JSON.parse(data));
            } catch (e) {
              const errorMsg = `Failed to parse response: ${data}`;
              writeLog(errorMsg, 'ERROR');
              // 即使解析失败，也返回原始数据，以便脚本能够继续执行
              resolve({ code: res.statusCode, message: 'Response parse error', data: data });
            }
          });
        });

        req.on('error', (error) => {
          const errorMsg = `Request error: ${error.message || JSON.stringify(error)}`;
          writeLog(errorMsg, 'ERROR');
          reject(new Error(errorMsg));
        });
        req.setTimeout(600000); // 10 minutes timeout
        
        if (body) {
          req.write(JSON.stringify(body));
        }
        req.end();
      });
    } catch (error) {
      lastError = error;
      const errorMsg = error.message || JSON.stringify(error);
      writeLog(`请求失败 (${i + 1}/${retries}): ${errorMsg}，正在重试...`, 'ERROR');
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒后重试
    }
  }
  
  throw lastError;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(start, end) {
  const dates = [];
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

async function syncCallLogDataForDate(date) {
  const dateStr = formatDate(date);
  writeLog(`同步 ${dateStr} 的通话清单数据...`);
  
  try {
    // 构建请求参数
    const body = {
      startTime: `${dateStr} 00:00:00`,
      endTime: `${dateStr} 23:59:59`,
      sliceMinutes: 60,
      pageSize: 200,
      maxPagesPerSlice: 150,
    };
    
    // 调用API获取通话清单数据
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/call-logs/backfill`, 'POST', body);
    
    if (result.code === 200) {
      writeLog(` ${dateStr} 通话清单同步成功`, 'SUCCESS');
      writeLog(`  - 获取记录数：${result.data.fetched}`);
      writeLog(`  - 入库记录数：${result.data.upserted}`);
      writeLog(`  - 失败记录数：${result.data.failed}`);
      writeLog(`  - 时间窗口数：${result.data.slices}`);
      
      return true;
    } else {
      writeLog(` ${dateStr} 通话清单同步失败：${result.message}`, 'ERROR');
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR');
      }
      sendAlert(` ${dateStr} 通话清单同步失败：${result.message}`);
      return false;
    }
  } catch (error) {
    writeLog(` ${dateStr} 通话清单同步异常：${error.message}`, 'ERROR');
    sendAlert(` ${dateStr} 通话清单同步异常：${error.message}`);
    return false;
  }
}

async function validateCallLogDataFiles(dates) {
  writeLog('');
  writeLog('验证通话清单数据文件...');
  
  let allValid = true;
  
  for (const date of dates) {
    const dateStr = formatDate(date);
    const callLogFile = path.join(logDir, `qms_call_log_list_${dateStr}.json`);
    
    if (fs.existsSync(callLogFile)) {
      try {
        const stats = fs.statSync(callLogFile);
        if (stats.size > 0) {
          const data = JSON.parse(fs.readFileSync(callLogFile, 'utf8'));
          if (Array.isArray(data) || typeof data === 'object') {
            writeLog(`  ${dateStr} 文件存在且数据格式正确`, 'SUCCESS');
          } else {
            writeLog(`  ${dateStr} 文件存在但数据格式异常`, 'ERROR');
            allValid = false;
          }
        } else {
          writeLog(`  ${dateStr} 文件存在但为空`, 'ERROR');
          allValid = false;
        }
      } catch (error) {
        writeLog(`  ${dateStr} 文件读取或解析失败：${error.message}`, 'ERROR');
        allValid = false;
      }
    } else {
      writeLog(`  ${dateStr} 文件不存在`, 'ERROR');
      allValid = false;
    }
  }
  
  return allValid;
}

async function main() {
  writeLog('========================================');
  writeLog(`开始通话清单数据回溯同步`);
  writeLog(`日期范围：${formatDate(startDate)} 至 ${formatDate(endDate)}`);
  writeLog('========================================');
  
  const dates = getDateRange(startDate, endDate);
  writeLog(`共需同步 ${dates.length} 天的数据`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const date of dates) {
    const success = await syncCallLogDataForDate(date);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // 避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const validationResult = await validateCallLogDataFiles(dates);
  
  writeLog('');
  writeLog('========================================');
  writeLog('同步完成总结', 'SUCCESS');
  writeLog('========================================');
  writeLog(`日期范围：${formatDate(startDate)} 至 ${formatDate(endDate)}`);
  writeLog(`总天数：${dates.length}`);
  writeLog(`成功：${successCount}`);
  writeLog(`失败：${failCount}`);
  writeLog(`数据验证：${validationResult ? '通过' : '失败'}`);
  writeLog(`日志文件：${logFile}`);
  if (fs.existsSync(errorLogFile)) {
    writeLog(`错误日志：${errorLogFile}`);
  }
  writeLog('========================================');
  
  if (failCount > 0 || !validationResult) {
    sendAlert('通话清单数据回溯同步存在失败项，请检查日志');
    process.exit(1);
  } else {
    writeLog('通话清单数据回溯同步全部完成', 'SUCCESS');
    process.exit(0);
  }
}

main().catch(err => {
  writeLog(`未捕获的错误：${err.message}`, 'ERROR');
  sendAlert(`通话清单数据回溯同步脚本异常：${err.message}`);
  process.exit(1);
});
