import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取订单数据
const ordersPath = path.join(__dirname, '../data/orders.json');
const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));

// 读取录音清单数据
const dataDir = path.join(__dirname, '../data/local-sync');
let allRecordings = [];

// 读取3月1日到3月28日的录音文件
for (let day = 1; day <= 28; day++) {
  const date = `2026-03-${day.toString().padStart(2, '0')}`;
  const filePath = path.join(dataDir, `qms_recording_list_${date}.json`);
  try {
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(fileData)) {
      allRecordings = allRecordings.concat(fileData);
    }
  } catch (error) {
    console.log(`文件不存在或无法读取: ${filePath}`);
  }
}

console.log(`共读取 ${allRecordings.length} 条录音记录`);

// 分析3月订单数据
const marchOrders = orders.filter(order => order.date.startsWith('2026-03-'));
console.log('=== 3月业务订单数据 ===');
console.log(`总订单数: ${marchOrders.length}`);

// 按日期分组统计订单
const ordersByDate = {};
marchOrders.forEach(order => {
  const date = order.date.substring(0, 10);
  ordersByDate[date] = (ordersByDate[date] || 0) + 1;
});

console.log('\n每日订单数量:');
Object.entries(ordersByDate).sort().forEach(([date, count]) => {
  console.log(`${date}: ${count} 条`);
});

// 分析录音清单中的成功客户数据
console.log('\n=== 3月录音清单数据 ===');
console.log(`总录音数: ${allRecordings.length}`);

// 过滤成功的录音（状态为6表示成功）
const successfulRecordings = allRecordings.filter(recording => 
  recording.status === 6
);

console.log(`成功录音数: ${successfulRecordings.length}`);

// 按日期分组统计成功录音
const recordingsByDate = {};
successfulRecordings.forEach(recording => {
  if (recording.start_time || recording.startTime) {
    const date = (recording.start_time || recording.startTime).substring(0, 10);
    if (date.startsWith('2026-03-')) {
      recordingsByDate[date] = (recordingsByDate[date] || 0) + 1;
    }
  }
});

console.log('\n每日成功录音数量:');
Object.entries(recordingsByDate).sort().forEach(([date, count]) => {
  console.log(`${date}: ${count} 条`);
});

// 对比分析
console.log('\n=== 数据对比分析 ===');
const allDates = [...new Set([...Object.keys(ordersByDate), ...Object.keys(recordingsByDate)])].sort();

console.log('日期\t\t订单数\t成功录音数\t差异');
console.log('=' .repeat(60));

allDates.forEach(date => {
  const orderCount = ordersByDate[date] || 0;
  const recordingCount = recordingsByDate[date] || 0;
  const diff = orderCount - recordingCount;
  console.log(`${date}\t${orderCount}\t\t${recordingCount}\t\t${diff >= 0 ? '+' : ''}${diff}`);
});

// 计算总差异
const totalOrders = Object.values(ordersByDate).reduce((sum, count) => sum + count, 0);
const totalRecordings = Object.values(recordingsByDate).reduce((sum, count) => sum + count, 0);
const totalDiff = totalOrders - totalRecordings;

console.log('=' .repeat(60));
console.log(`总计\t\t${totalOrders}\t\t${totalRecordings}\t\t${totalDiff >= 0 ? '+' : ''}${totalDiff}`);

// 分析可能的原因
console.log('\n=== 可能的原因分析 ===');
if (totalDiff > 0) {
  console.log('订单数大于成功录音数，可能原因:');
  console.log('1. 部分订单可能不是通过录音转化的');
  console.log('2. 录音数据可能不完整或有遗漏');
  console.log('3. 成功录音的判断标准可能不准确');
} else if (totalDiff < 0) {
  console.log('成功录音数大于订单数，可能原因:');
  console.log('1. 部分成功录音可能未转化为订单');
  console.log('2. 订单数据可能不完整或有遗漏');
  console.log('3. 订单日期与录音日期可能不一致');
} else {
  console.log('订单数与成功录音数一致，数据匹配良好');
}
