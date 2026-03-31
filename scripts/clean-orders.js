const fs = require('fs');
const path = require('path');

const ORDERS_FILE = path.join(__dirname, '..', 'data', 'orders.json');

async function cleanOrders() {
  try {
    // 读取订单数据
    const ordersData = fs.readFileSync(ORDERS_FILE, 'utf-8');
    const orders = JSON.parse(ordersData);
    
    console.log(`原始订单数量: ${orders.length}`);
    
    // 使用Set去重，基于手机号
    const uniquePhones = new Set();
    const uniqueOrders = [];
    
    for (const order of orders) {
      if (!uniquePhones.has(order.phone)) {
        uniquePhones.add(order.phone);
        uniqueOrders.push(order);
      }
    }
    
    console.log(`去重后订单数量: ${uniqueOrders.length}`);
    console.log(`删除的重复订单数量: ${orders.length - uniqueOrders.length}`);
    
    // 重新生成ID
    const ordersWithNewIds = uniqueOrders.map((order, index) => ({
      ...order,
      id: String(index + 1).padStart(4, '0')
    }));
    
    // 保存去重后的数据
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordersWithNewIds, null, 2), 'utf-8');
    
    console.log('订单数据清理完成！');
  } catch (error) {
    console.error('清理订单数据失败:', error);
  }
}

cleanOrders();
