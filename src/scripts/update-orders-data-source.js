import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

async function updateOrdersDataSource() {
  try {
    // 读取现有订单数据
    const data = await fs.readFile(ORDERS_FILE, 'utf-8');
    const orders = JSON.parse(data);
    
    // 为每个订单添加dataSource字段，设置为"系统生成"
    const updatedOrders = orders.map(order => ({
      ...order,
      dataSource: '系统生成'
    }));
    
    // 写回更新后的数据
    await fs.writeFile(ORDERS_FILE, JSON.stringify(updatedOrders, null, 2), 'utf-8');
    
    console.log(`成功更新了 ${updatedOrders.length} 条订单的数据源字段`);
  } catch (error) {
    console.error('更新订单数据源失败:', error);
  }
}

updateOrdersDataSource();