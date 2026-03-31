import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取订单数据
const ordersPath = path.join(__dirname, '../data/orders.json');
const data = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));

// 统计每日订单数量
const dailyCounts = {};
data.forEach(order => {
  const date = order.date.substring(0, 10);
  dailyCounts[date] = (dailyCounts[date] || 0) + 1;
});

// 按日期排序并输出
console.log('每日订单数量:');
Object.entries(dailyCounts)
  .sort()
  .forEach(([date, count]) => {
    console.log(`${date}: ${count} 条`);
  });

console.log(`\n总订单数: ${data.length} 条`);
console.log(`日期范围: ${Object.keys(dailyCounts).sort()[0]} 到 ${Object.keys(dailyCounts).sort().pop()}`);
