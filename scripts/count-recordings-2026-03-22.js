const fs = require('fs');
const path = require('path');

// 录音清单文件路径
const RECORDING_FILE = path.join(__dirname, '..', 'data', 'local-sync', 'qms_recording_list_2026-03-22.json');

console.log('正在检查录音清单文件:', RECORDING_FILE);

try {
  // 读取文件内容
  const data = fs.readFileSync(RECORDING_FILE, 'utf8');
  
  // 解析JSON
  const recordings = JSON.parse(data);
  
  // 检查数据类型
  if (Array.isArray(recordings)) {
    console.log('录音清单文件包含', recordings.length, '条记录');
    
    // 检查前几条记录的结构
    if (recordings.length > 0) {
      console.log('前3条记录的结构:');
      recordings.slice(0, 3).forEach((recording, index) => {
        console.log(`记录 ${index + 1}:`, {
          id: recording.id,
          uuid: recording.uuid,
          agent: recording.agent,
          agentName: recording.agentName,
          callingPhone: recording.callingPhone,
          calledPhone: recording.calledPhone,
          startTime: recording.startTime,
          endTime: recording.endTime,
          answerDuration: recording.answerDuration,
          playUrl: recording.playUrl,
          status: recording.status,
          statusName: recording.statusName
        });
      });
    }
  } else {
    console.error('录音清单文件不是有效的JSON数组');
  }
} catch (error) {
  console.error('读取文件失败:', error.message);
}
