const fs = require('fs');
const path = require('path');

// 订单数据文件路径
const ordersFilePath = path.join(__dirname, '..', 'data', 'orders.json');

// 读取现有的订单数据
let existingOrders = [];
try {
  const existingData = fs.readFileSync(ordersFilePath, 'utf-8');
  existingOrders = JSON.parse(existingData);
  console.log(`现有订单数量: ${existingOrders.length}`);
} catch (error) {
  console.error('读取现有订单数据失败:', error);
  existingOrders = [];
}

// 生成新订单的起始ID
const startId = existingOrders.length + 1;

// 姓名列表
const names = [
  '尹雅雅', '林康群', '李少霞', '林宇君', '邓清华', '李巧冰', '刘土梅', '黄镇岳', '陈素珍', '李卫红'
];

// 代理商ID列表
const agentIds = [
  '1001', '1051', '1052', '1072', '1096', '1099', '1110', '1146', '1147', '1153'
];

// 团队列表
const teams = [
  '广东升档-诚聚A', '广东升档-诚聚B'
];

// 生成随机手机号码
function generatePhone() {
  const prefixes = ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139', '147', '150', '151', '152', '153', '155', '156', '157', '158', '159', '178', '180', '181', '182', '183', '184', '185', '186', '187', '188', '189'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return `${prefix}${suffix}`;
}

// 生成随机时间
function generateTime() {
  const hour = Math.floor(Math.random() * 10) + 9; // 9-18点
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
}

// 生成指定日期的订单
function generateOrdersForDate(date, startId) {
  const orders = [];
  const orderCount = Math.floor(Math.random() * 10) + 5; // 每天5-