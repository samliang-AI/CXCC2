// 录音清单数据重新同步脚本
// 重新同步3月2日至3月24日的数据到本地

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:5000';
const LOG_DIR = path.join(process.cwd(), 'data', 'local-sync');
const logFile = path.join(LOG_DIR, `resync_recordings_${Date.now()}.log`);

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + '\n');
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  const lastDate = new Date(endDate);
  
  while (currentDate <= lastDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

async function syncDate(date) {
  const dateStr = formatDate(date);
  writeLog(`开始同步 ${dateStr} 的数据...`);
  
  try {
    const body = {
      startTime: `${dateStr} 00:00:00`,
      endTime: `${dateStr} 23:59:59`
    };
    
    writeLog(`  发送API请求，时间范围：${body.startTime} 至 ${body.endTime}`);
    const response = await fetch(`${API_BASE_URL}/api/internal/sync/recordings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const result = await response.json();
    
    if (result.code === 200) {
      writeLog(` ${dateStr} 同步成功`, 'SUCCESS');
      writeLog(`  - 获取记录数：${result.data.fetched}`);
      writeLog(`  - 入库记录数：${result.data.upserted}`);
      writeLog(`  - 失败记录数：${result.data.failed}`);
      writeLog(`  - 存储模式：${result.data.storageMode}`);
      
      if (result.data.localFiles) {
        writeLog(`  - 本地文件：${result.data.localFiles.join(', ')}`);
      }
      
      return true;
    } else {
      writeLog(` ${dateStr} 同步失败：${result.message}`, 'ERROR');
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR');
      }
      return false;
    }
  } catch (error) {
    writeLog(` ${dateStr} 同步异常：${error.message}`, 'ERROR');
    return false;
  }
}

async function validateLocalData(date) {
  const dateStr = formatDate(date);
  const filePath = path.join(LOG_DIR, `qms_recording_list_${dateStr}.json`);
  
  writeLog(`验证 ${dateStr} 的本地数据...`);
  
  if (!fs.existsSync(filePath)) {
    writeLog(`验证失败：${filePath} 不存在`, 'ERROR');
    return false;
  } else {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) {
        writeLog(`验证通过：${filePath} 包含 ${data.length} 条记录`, 'SUCCESS');
        return true;
      } else {
        writeLog(`验证失败：${filePath} 为空或格式错误`, 'ERROR');
        return false;
      }
    } catch (error) {
      writeLog(`验证失败：${filePath} 读取或解析失败: ${error.message}`, 'ERROR');
      return false;
    }
  }
}

async function main() {
  writeLog('========================================');
  writeLog('开始录音清单数据重新同步');
  writeLog('日期范围：2026-03-02 至 2026-03-24');
  writeLog('========================================');
  
  const startDate = new Date('2026-03-02');
  const endDate = new Date('2026-03-24');
  const dates = getDateRange(startDate, endDate);
  writeLog(`共需同步 ${dates.length} 天的数据`);
  
  let successCount = 0;
  let failCount = 0;
  let validationSuccessCount = 0;
  let validationFailCount = 0;
  
  for (const date of dates) {
    writeLog(`\n处理日期：${formatDate(date)}`);
    
    // 执行同步
    const syncSuccess = await syncDate(date);
    if (syncSuccess) {
      successCount++;
      
      // 验证本地数据
      const validationSuccess = await validateLocalData(date);
      if (validationSuccess) {
        validationSuccessCount++;
      } else {
        validationFailCount++;
      }
    } else {
      failCount++;
      validationFailCount++;
    }
    
    // 避免请求过于频繁
    writeLog('等待1秒后继续...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  writeLog('');
  writeLog('========================================');
  writeLog('同步任务完成总结', 'SUCCESS');
  writeLog('========================================');
  writeLog(`日期范围：2026-03-02 至 2026-03-24`);
  writeLog(`总天数：${dates.length}`);
  writeLog(`同步成功：${successCount}`);
  writeLog(`同步失败：${failCount}`);
  writeLog(`数据验证成功：${validationSuccessCount}`);
  writeLog(`数据验证失败：${validationFailCount}`);
  writeLog(`日志文件：${logFile}`);
  writeLog('========================================');
  
  if (failCount > 0 || validationFailCount > 0) {
    writeLog('录音清单数据重新同步存在失败项，请检查日志', 'ERROR');
    process.exit(1);
  } else {
    writeLog('录音清单数据重新同步全部完成', 'SUCCESS');
    process.exit(0);
  }
}

main().catch(err => {
  writeLog(`未捕获的错误：${err.message}`, 'ERROR');
  process.exit(1);
});