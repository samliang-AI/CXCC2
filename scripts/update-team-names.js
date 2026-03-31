import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取订单数据
const ordersPath = path.join(__dirname, '../data/orders.json');
const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));

// 读取坐席列表数据
const agentListPath = path.join(__dirname, '../data/local-sync/qms_agent_list.json');
const agents = JSON.parse(fs.readFileSync(agentListPath, 'utf8'));

// 构建坐席-团队映射表（使用 username 和 name 作为联合键）
const agentTeamMap = new Map();
agents.forEach(agent => {
  const key = `${agent.username}-${agent.name}`;
  agentTeamMap.set(key, agent.skillGroupName);
});

console.log(`构建了 ${agentTeamMap.size} 条坐席-团队映射关系`);

// 过滤出2026年3月1日至28日的订单
const targetOrders = orders.filter(order => {
  const orderDate = order.date.substring(0, 10);
  return orderDate >= '2026-03-01' && orderDate <= '2026-03-28';
});

console.log(`找到 ${targetOrders.length} 条2026年3月1日至28日的订单`);

// 备份原始数据
const backupPath = path.join(__dirname, '../data/orders_backup_before_team_update.json');
fs.writeFileSync(backupPath, JSON.stringify(orders, null, 2), 'utf8');
console.log(`原始数据已备份到: ${backupPath}`);

// 处理订单
const results = {
  total: targetOrders.length,
  success: 0,
  failed: 0,
  failedReasons: {
    agentInfoMissing: 0,
    notFoundInMap: 0
  },
  updatedOrders: []
};

// 处理每条订单
orders.forEach(order => {
  const orderDate = order.date.substring(0, 10);
  
  // 只处理2026年3月1日至28日的订单
  if (orderDate >= '2026-03-01' && orderDate <= '2026-03-28') {
    // 检查坐席信息是否完整
    if (!order.agentId || !order.name) {
      // 标记异常状态
      order.exception = true;
      order.exceptionReason = '坐席信息不完整';
      results.failed++;
      results.failedReasons.agentInfoMissing++;
    } else {
      // 构建匹配键
      const key = `${order.agentId}-${order.name}`;
      
      // 查找团队名称
      const teamName = agentTeamMap.get(key);
      
      if (teamName) {
        // 匹配成功，更新团队名称
        order.team = teamName;
        results.success++;
        results.updatedOrders.push({
          id: order.id,
          agentId: order.agentId,
          agentName: order.name,
          oldTeam: order.team,
          newTeam: teamName
        });
      } else {
        // 匹配失败，标记异常状态
        order.exception = true;
        order.exceptionReason = '在坐席-团队映射表中未找到匹配记录';
        results.failed++;
        results.failedReasons.notFoundInMap++;
      }
    }
  }
});

// 写入更新后的订单数据
fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2), 'utf8');

// 生成处理报告
const report = {
  processedAt: new Date().toISOString(),
  dateRange: '2026-03-01 to 2026-03-28',
  statistics: {
    totalOrders: results.total,
    successCount: results.success,
    failedCount: results.failed,
    successRate: ((results.success / results.total) * 100).toFixed(2) + '%',
    failedReasons: results.failedReasons
  },
  processingDetails: {
    agentTeamMapSize: agentTeamMap.size,
    backupFile: backupPath
  },
  sampleUpdatedOrders: results.updatedOrders.slice(0, 5),
  recommendations: [
    '定期更新坐席-团队映射关系表',
    '完善订单数据中的坐席信息',
    '建立数据质量监控机制'
  ]
};

const reportPath = path.join(__dirname, '../data/team_update_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

// 生成详细日志
const log = {
  timestamp: new Date().toISOString(),
  action: '外呼团队名称重新匹配',
  targetDateRange: '2026-03-01 to 2026-03-28',
  results: results,
  agentMapSource: agentListPath,
  ordersSource: ordersPath
};

const logPath = path.join(__dirname, '../data/team_update_log.json');
fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');

// 输出结果
console.log('\n=== 外呼团队名称重新匹配操作完成 ===');
console.log(`处理订单数: ${results.total}`);
console.log(`成功匹配: ${results.success}`);
console.log(`匹配失败: ${results.failed}`);
console.log(`成功率: ${((results.success / results.total) * 100).toFixed(2)}%`);
console.log(`失败原因:`);
console.log(`  - 坐席信息不完整: ${results.failedReasons.agentInfoMissing}`);
console.log(`  - 未找到匹配记录: ${results.failedReasons.notFoundInMap}`);
console.log(`\n报告已保存: ${reportPath}`);
console.log(`日志已保存: ${logPath}`);
