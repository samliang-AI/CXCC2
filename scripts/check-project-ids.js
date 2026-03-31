import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(process.cwd(), 'data', 'local-sync');
const projectIds = new Set();

// 读取3月1日至3月28日的录音清单文件
for (let day = 1; day <= 28; day++) {
  const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
  const filePath = path.join(dataDir, `qms_recording_list_${dateStr}.json`);
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    data.forEach(record => {
      if (record.project_id !== undefined) {
        projectIds.add(String(record.project_id));
      }
    });
    console.log(`${dateStr}: 读取成功`);
  } catch (error) {
    console.log(`${dateStr}: 文件不存在或读取失败`);
  }
}

console.log('\n所有project_ids:', Array.from(projectIds).sort());
