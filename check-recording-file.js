const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'local-sync', 'qms_recording_list_2026-03-23.json');

try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  console.log('File size:', content.length, 'characters');
  console.log('Record count:', data.length);
  console.log('First record start_time:', data[0]?.start_time);
  console.log('Last record start_time:', data[data.length - 1]?.start_time);
  console.log('First record sync_time:', data[0]?.sync_time);
  console.log('Last record sync_time:', data[data.length - 1]?.sync_time);
  
  // 检查是否有重复的 uuid
  const uuids = new Set();
  let duplicates = 0;
  for (const record of data) {
    if (uuids.has(record.uuid)) {
      duplicates++;
    } else {
      uuids.add(record.uuid);
    }
  }
  console.log('Unique UUIDs:', uuids.size);
  console.log('Duplicate UUIDs:', duplicates);
  
} catch (error) {
  console.error('Error parsing JSON:', error.message);
  
  // 尝试查找 JSON 错误位置
  if (error instanceof SyntaxError) {
    const match = error.message.match(/at position (\d+)/);
    if (match) {
      const position = parseInt(match[1]);
      const context = content.substring(Math.max(0, position - 100), position + 100);
      console.log('Error context:', context);
    }
  }
}