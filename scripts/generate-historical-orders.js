import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取现有订单数据
const ordersPath = path.join(__dirname, '../data/orders.json');
const existingOrders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));

// 提取现有数据中的唯一值
const uniqueNames = [...new Set(existingOrders.map(order => order.name))];
const uniquePhonePrefixes = [...new Set(existingOrders.map(order => order.phone.substring(0, 7)))];
const uniqueAgentIds = [...new Set(existingOrders.map(order => order.agentId))];
const uniqueTeams = [...new Set(existingOrders.map(order => order.team))];

// 生成随机时间
function generateRandomTime() {
  const hour = Math.floor(Math.random() * 9) + 9; // 9-17点
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
}

// 生成随机电话号码
function generateRandomPhone() {
  const prefix = uniquePhonePrefixes[Math.floor(Math.random() * uniquePhonePrefixes.length)];
  const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return prefix + suffix;
}

// 生成随机订单
function generateOrder(date, id) {
  const name = uniqueNames[Math.floor(Math.random() * uniqueNames.length)];
  const phone = generateRandomPhone();
  const agentId = uniqueAgentIds[Math.floor(Math.random() * uniqueAgentIds.length)];
  const team = uniqueTeams[Math.floor(Math.random() * uniqueTeams.length)];
  const time = generateRandomTime();
  
  return {
    date: `${date} ${time}`,
    phone,
    city: "茂名",
    businessType: "套餐升档",
    plan: "裸升",
    presetAmount: 59,
    actualAmount: 89,
    discountAmount: 0,
    difference: 30,
    name,
    agentId,
    team,
    id: id.toString().padStart(4, '0'),
    originalDiscountAmount: 30
  };
}

// 生成历史数据
const historicalOrders = [];
let orderId = 1;

// 生成3月1日到3月28日的数据
for (let day = 1; day <= 28; day++) {
  const date = `2026-03-${day.toString().padStart(2, '0')}`;
  // 每天生成70-80个订单，保持与3月29日相似的数量
  const orderCount = Math.floor(Math.random() * 11) + 70;
  
  for (let i = 0; i < orderCount; i++) {
    historicalOrders.push(generateOrder(date, orderId));
    orderId++;
  }
}

// 合并现有数据（3月29日）到历史数据后面
const allOrders = [...historicalOrders, ...existingOrders];

// 按日期时间排序（最新的在前面）
allOrders.sort((a, b) => {
  return new Date(b.date) - new Date(a.date);
});

// 更新订单ID，确保连续
allOrders.forEach((order, index) => {
  order.id = (index + 1).toString().padStart(4, '0');
});

// 写入文件
fs.writeFileSync(ordersPath, JSON.stringify(allOrders, null, 2), 'utf8');

console.log('历史数据生成完成！');
console.log(`生成了 ${historicalOrders.length} 条历史订单`);
console.log(`总订单数：${allOrders.length} 条`);
console.log(`日期范围：2026-03-01 到 2026-03-29`);
