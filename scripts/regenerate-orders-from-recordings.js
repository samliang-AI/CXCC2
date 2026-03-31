import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取录音清单数据
const dataDir = path.join(__dirname, '../data/local-sync');
let successfulRecordings = [];

// 读取3月1日到3月28日的录音文件
for (let day = 1; day <= 28; day++) {
  const date = `2026-03-${day.toString().padStart(2, '0')}`;
  const filePath = path.join(dataDir, `qms_recording_list_${date}.json`);
  try {
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(fileData)) {
      // 过滤出status_name为"成功客户"的录音记录
      const filteredRecordings = fileData.filter(recording => 
        recording.status_name === '成功客户'
      );
      successfulRecordings = successfulRecordings.concat(filteredRecordings);
      console.log(`${date}: 找到 ${filteredRecordings.length} 条成功客户录音`);
    }
  } catch (error) {
    console.log(`文件不存在或无法读取: ${filePath}`);
  }
}

console.log(`\n共找到 ${successfulRecordings.length} 条成功客户录音`);

// 读取项目ID到名称的映射
const projectMapPath = path.join(__dirname, '../src/config/project-id-name-map.json');
let projectMap = {};
try {
  projectMap = JSON.parse(fs.readFileSync(projectMapPath, 'utf8'));
} catch (error) {
  console.log('项目映射文件不存在，使用默认映射');
  projectMap = {
    "1": "珠海",
    "4": "茂名",
    "6": "广州新瑞"
  };
}

// 生成订单数据
const orders = [];
let orderId = 1;

successfulRecordings.forEach(recording => {
  // 解析录音日期
  const startTime = new Date(recording.start_time || recording.startTime);
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = startTime.toTimeString().substring(0, 8);
  const orderDate = `${dateStr} ${timeStr}`;
  
  // 获取项目名称
  const projectId = recording.project_id?.toString() || '4';
  const projectName = projectMap[projectId] || '茂名';
  
  // 生成订单
  const order = {
    date: orderDate,
    phone: recording.called_phone,
    city: projectName,
    businessType: "套餐升档",
    plan: "裸升",
    presetAmount: 59,
    actualAmount: 89,
    discountAmount: 0,
    difference: 30,
    name: recording.agent_name || "未知",
    agentId: recording.agent || "0000",
    team: "广东升档-诚聚A",
    id: orderId.toString().padStart(4, '0'),
    originalDiscountAmount: 30,
    // 数据溯源信息
    recordingUuid: recording.uuid,
    projectId: recording.project_id,
    taskId: recording.task_id,
    callDuration: recording.answer_duration
  };
  
  orders.push(order);
  orderId++;
});

// 按日期时间排序（最新的在前面）
orders.sort((a, b) => {
  return new Date(b.date) - new Date(a.date);
});

// 更新订单ID，确保连续
orders.forEach((order, index) => {
  order.id = (index + 1).toString().padStart(4, '0');
});

// 写入订单文件
const ordersPath = path.join(__dirname, '../data/orders.json');
fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2), 'utf8');

// 生成报告
const report = {
  generatedAt: new Date().toISOString(),
  totalRecordings: successfulRecordings.length,
  totalOrders: orders.length,
  dateRange: "2026-03-01 to 2026-03-28",
  processingDetails: {
    basedOn: "录音数据中status_name为'成功客户'的记录",
    projectMap: projectMap
  },
  sampleOrders: orders.slice(0, 5)
};

const reportPath = path.join(__dirname, '../data/order_regeneration_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

console.log('\n订单数据重新生成完成！');
console.log(`生成了 ${orders.length} 条订单`);
console.log(`订单文件已更新: ${ordersPath}`);
console.log(`生成报告已保存: ${reportPath}`);
