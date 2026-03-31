const fs = require('fs');
const path = require('path');

// 清理指定日期的录音数据文件
function cleanRecordingData(dateStr) {
  const filePath = path.join(__dirname, '../data/local-sync', `qms_recording_list_${dateStr}.json`);
  
  console.log(`开始清理文件: ${filePath}`);
  
  try {
    // 读取文件
    const data = fs.readFileSync(filePath, 'utf8');
    const recordings = JSON.parse(data);
    
    console.log(`文件包含 ${recordings.length} 条记录`);
    
    // 过滤出指定日期的数据
    const targetDate = dateStr.replace(/-/g, '');
    const filteredRecordings = recordings.filter(recording => {
      if (recording.start_time) {
        // 从开始时间中提取日期部分 (YYYY-MM-DD)
        const recordDate = recording.start_time.substring(0, 10).replace(/-/g, '');
        return recordDate === targetDate;
      }
      return false;
    });
    
    console.log(`过滤后剩余 ${filteredRecordings.length} 条记录`);
    
    // 写回文件
    fs.writeFileSync(filePath, JSON.stringify(filteredRecordings, null, 2));
    console.log(`清理完成，文件已更新`);
  } catch (error) {
    console.error(`处理文件时出错: ${error.message}`);
  }
}

// 检查文件是否存在且有数据
function checkFileData(dateStr) {
  const filePath = path.join(__dirname, '../data/local-sync', `qms_recording_list_${dateStr}.json`);
  
  console.log(`\n检查文件: ${filePath}`);
  
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const recordings = JSON.parse(data);
      console.log(`文件存在，包含 ${recordings.length} 条记录`);
      
      if (recordings.length > 0) {
        console.log('前3条记录示例:');
        recordings.slice(0, 3).forEach((rec, index) => {
          console.log(`  ${index + 1}. start_time: ${rec.start_time}`);
        });
      }
    } else {
      console.log('文件不存在');
    }
  } catch (error) {
    console.error(`检查文件时出错: ${error.message}`);
  }
}

// 执行清理和检查
console.log('=== 清理 qms_recording_list_2026-03-22.json ===');
cleanRecordingData('2026-03-22');

console.log('\n=== 检查 qms_recording_list_2026-03-23.json ===');
checkFileData('2026-03-23');

console.log('\n=== 任务完成 ===');
