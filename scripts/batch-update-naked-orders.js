import fs from 'fs';
import path from 'path';

// 数据文件路径
const DATA_DIR = path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const BACKUP_FILE = path.join(DATA_DIR, `orders_backup_${new Date().toISOString().split('T')[0]}.json`);

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 读取订单数据
function readOrders() {
  try {
    ensureDataDir();
    const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取订单数据失败:', error);
    return [];
  }
}

// 保存订单数据
function saveOrders(orders) {
  try {
    ensureDataDir();
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('保存订单数据失败:', error);
    return false;
  }
}

// 备份订单数据
function backupOrders(orders) {
  try {
    ensureDataDir();
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(orders, null, 2), 'utf-8');
    console.log(`订单数据已备份到: ${BACKUP_FILE}`);
    return true;
  } catch (error) {
    console.error('备份订单数据失败:', error);
    return false;
  }
}

// 执行批量更新操作
function batchUpdateNakedOrders() {
  console.log('开始执行批量更新操作...');
  
  // 1. 读取原始订单数据
  const originalOrders = readOrders();
  console.log(`读取到 ${originalOrders.length} 条订单记录`);
  
  // 2. 备份原始数据
  if (!backupOrders(originalOrders)) {
    console.error('备份失败，终止操作');
    return;
  }
  
  // 3. 筛选出裸升方案的订单
  const nakedOrders = originalOrders.filter(order => order.plan === '裸升');
  console.log(`筛选出 ${nakedOrders.length} 条裸升方案订单`);
  
  // 4. 执行更新操作
  const updatedOrders = originalOrders.map(order => {
    if (order.plan === '裸升') {
      // 保存原始优惠金额用于对比
      const originalDiscountAmount = order.discountAmount || 0;
      // 更新优惠金额为0
      const updatedOrder = {
        ...order,
        discountAmount: 0,
        // 重新计算差额
        difference: (order.actualAmount || 0) - (order.presetAmount || 0) - 0
      };
      updatedOrder.originalDiscountAmount = originalDiscountAmount;
      return updatedOrder;
    }
    return order;
  });
  
  // 5. 保存更新后的数据
  if (!saveOrders(updatedOrders)) {
    console.error('保存更新后的数据失败');
    return;
  }
  
  // 6. 生成修改报告
  generateReport(originalOrders, updatedOrders);
  
  console.log('批量更新操作完成！');
}

// 生成修改报告
function generateReport(originalOrders, updatedOrders) {
  const reportFile = path.join(DATA_DIR, `batch_update_report_${new Date().toISOString().split('T')[0]}.json`);
  
  // 统计受影响的订单
  const affectedOrders = updatedOrders.filter(order => order.plan === '裸升');
  
  // 计算修改前后的优惠金额对比
  const comparisonData = affectedOrders.map(order => {
    const originalOrder = originalOrders.find(o => o.id === order.id);
    return {
      orderId: order.id,
      phone: order.phone,
      originalDiscountAmount: originalOrder ? (originalOrder.discountAmount || 0) : 0,
      updatedDiscountAmount: order.discountAmount || 0,
      difference: order.difference || 0
    };
  });
  
  // 生成报告数据
  const report = {
    timestamp: new Date().toISOString(),
    totalOrders: originalOrders.length,
    affectedOrders: affectedOrders.length,
    averageOriginalDiscount: comparisonData.reduce((sum, item) => sum + item.originalDiscountAmount, 0) / comparisonData.length || 0,
    totalOriginalDiscount: comparisonData.reduce((sum, item) => sum + item.originalDiscountAmount, 0),
    totalUpdatedDiscount: comparisonData.reduce((sum, item) => sum + item.updatedDiscountAmount, 0),
    comparisonData: comparisonData
  };
  
  // 保存报告
  try {
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`修改报告已生成: ${reportFile}`);
    
    // 打印摘要
    console.log('\n=== 修改报告摘要 ===');
    console.log(`总订单数: ${report.totalOrders}`);
    console.log(`受影响的订单数: ${report.affectedOrders}`);
    console.log(`修改前平均优惠金额: ${report.averageOriginalDiscount.toFixed(2)}`);
    console.log(`修改前总优惠金额: ${report.totalOriginalDiscount}`);
    console.log(`修改后总优惠金额: ${report.totalUpdatedDiscount}`);
    console.log(`==================`);
  } catch (error) {
    console.error('生成报告失败:', error);
  }
}

// 执行批量更新
batchUpdateNakedOrders();