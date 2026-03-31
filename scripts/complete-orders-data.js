const fs = require('fs');
const path = require('path');

// 读取现有订单数据
function readOrders() {
  const ordersPath = path.join(__dirname, '../data/orders.json');
  try {
    const data = fs.readFileSync(ordersPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取orders.json失败:', error);
    return [];
  }
}

// 读取坐席信息
function readAgents() {
  const agentsPath = path.join(__dirname, '../data/local-sync/qms_agent_list.json');
  try {
    const data = fs.readFileSync(agentsPath, 'utf8');
    const agents = JSON.parse(data);
    return new Map(agents.map(agent => [agent.username.toString(), { name: agent.name, team: agent.skillGroupName }]));
  } catch (error) {
    console.error('读取qms_agent_list.json失败:', error);
    return new Map();
  }
}

// 读取录音数据
function readRecordings(date) {
  const recordingPath = path.join(__dirname, `../data/local-sync/qms_recording_list_${date}.json`);
  try {
    const data = fs.readFileSync(recordingPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取qms_recording_list_${date}.json失败:`, error);
    return [];
  }
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 生成订单ID
function generateOrderId(index) {
  return String(index).padStart(4, '0');
}

// 主函数
function completeOrdersData() {
  console.log('开始补全订单数据...');
  
  // 读取现有订单
  const existingOrders = readOrders();
  console.log(`现有订单数量: ${existingOrders.length}`);
  
  // 读取坐席信息
  const agentsMap = readAgents();
  console.log(`坐席数量: ${agentsMap.size}`);
  
  // 生成日期范围 (2026-03-01 到 2026-03-28)
  const startDate = new Date('2026-03-01');
  const endDate = new Date('2026-03-28');
  const dates = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dates.push(dateStr);
  }
  
  console.log(`处理日期范围: ${dates[0]} 至 ${dates[dates.length - 1]}`);
  
  // 处理每个日期的录音数据
  let newOrders = [];
  let orderIndex = existingOrders.length + 1;
  
  dates.forEach(date => {
    console.log(`处理日期: ${date}`);
    const recordings = readRecordings(date);
    
    // 过滤成功客户的录音
    const successfulRecordings = recordings.filter(recording => 
      recording.status === 4 || recording.status_name === '成功客户'
    );
    
    console.log(`  成功客户录音数量: ${successfulRecordings.length}`);
    
    // 为每个成功客户创建订单
    successfulRecordings.forEach(recording => {
      const agentInfo = agentsMap.get(recording.agent) || { name: recording.agent_name, team: '未知团队' };
      
      const order = {
        date: formatDate(recording.start_time),
        phone: recording.called_phone,
        city: '茂名',
        businessType: '套餐升档',
        plan: '裸升',
        presetAmount: 59,
        actualAmount: 89,
        discountAmount: 30,
        difference: 30,
        name: agentInfo.name,
        agentId: recording.agent,
        team: agentInfo.team,
        id: generateOrderId(orderIndex)
      };
      
      newOrders.push(order);
      orderIndex++;
    });
  });
  
  console.log(`生成新订单数量: ${newOrders.length}`);
  
  // 合并现有订单和新订单
  const allOrders = [...existingOrders, ...newOrders];
  
  // 按日期排序
  allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // 写入更新后的订单数据
  const ordersPath = path.join(__dirname, '../data/orders.json');
  try {
    fs.writeFileSync(ordersPath, JSON.stringify(allOrders, null, 2), 'utf8');
    console.log(`订单数据更新完成，总订单数量: ${allOrders.length}`);
  } catch (error) {
    console.error('写入orders.json失败:', error);
  }
}

// 运行主函数
completeOrdersData();