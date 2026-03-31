const fs = require('fs');
const path = require('path');

// 读取录音文件
const filePath = path.join(__dirname, 'data', 'local-sync', 'qms_recording_list_2026-03-23.json');

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('读取文件失败:', err);
    return;
  }
  
  try {
    const records = JSON.parse(data);
    if (Array.isArray(records)) {
      console.log(`qms_recording_list_2026-03-23.json 文件中有 ${records.length} 条数据`);
    } else {
      console.error('文件内容不是有效的JSON数组');
    }
  } catch (parseError) {
    console.error('解析JSON失败:', parseError);
  }
});
