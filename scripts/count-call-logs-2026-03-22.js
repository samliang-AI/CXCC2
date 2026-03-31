const fs = require('fs');
const path = require('path');

// 通话清单文件路径
const CALL_LOG_FILE = path.join(__dirname, '..', 'data', 'local-sync', 'qms_call_log_list_2026-03-22.json');

console.log('正在检查通话清单文件:', CALL_LOG_FILE);

try {
  // 读取文件内容
  const data = fs.readFileSync(CALL_LOG_FILE, 'utf8');
  
  // 解析JSON
  const callLogs = JSON.parse(data);
  
  // 检查数据类型
  if (Array.isArray(callLogs)) {
    console.log('通话清单文件包含', callLogs.length, '条记录');
    
    // 检查前几条记录的结构
    if (callLogs.length > 0) {
      console.log('前3条记录的结构:');
      callLogs.slice(0, 3).forEach((log, index) => {
        console.log(`记录 ${index + 1}:`, {
          id: log.id,
          agentCode: log.agentCode,
          agentName: log.agentName,
          startTime: log.startTime,
          endTime: log.endTime,
          callingPhone: log.callingPhone,
          calledPhone: log.calledPhone,
          callDuration: log.callDuration
        });
      });
    }
  } else {
    console.error('通话清单文件不是有效的JSON数组');
  }
} catch (error) {
  console.error('读取文件失败:', error.message);
}
