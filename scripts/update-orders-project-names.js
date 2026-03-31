import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目 ID 到名称的映射
const projectIdNameMap = {
  "1": "珠海",
  "4": "茂名",
  "5": "湛江",
  "6": "河源",
  "8": "佛山",
  "9": "清远"
};

// 读取录音清单数据并建立映射关系（按坐席工号+日期）
function buildAgentProjectMap() {
  const dataDir = path.join(process.cwd(), 'data', 'local-sync');
  const agentProjectMap = new Map(); // key: agentId_date, value: projectName
  
  // 读取3月1日至3月28日的录音清单文件
  for (let day = 1; day <= 28; day++) {
    const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
    const filePath = path.join(dataDir, `qms_recording_list_${dateStr}.json`);
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      data.forEach(record => {
        if (record.agent && record.project_id !== undefined) {
          const projectName = projectIdNameMap[String(record.project_id)];
          if (projectName) {
            // 使用坐席工号+日期作为key
            const key = `${record.agent}_${dateStr}`;
            agentProjectMap.set(key, projectName);
          }
        }
      });
      console.log(`${dateStr}: 读取成功，当前映射数: ${agentProjectMap.size}`);
    } catch (error) {
      console.log(`${dateStr}: 文件不存在或读取失败`);
    }
  }
  
  return agentProjectMap;
}

// 更新订单数据
function updateOrders(agentProjectMap) {
  const ordersFile = path.join(process.cwd(), 'data', 'orders.json');
  
  try {
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf-8'));
    let updatedCount = 0;
    let skippedCount = 0;
    
    const updatedOrders = orders.map(order => {
      // 检查订单日期是否在3月1日至3月28日范围内
      const orderDate = order.date ? order.date.split(' ')[0] : '';
      if (!orderDate || orderDate < '2026-03-01' || orderDate > '2026-03-28') {
        skippedCount++;
        return order;
      }
      
      // 根据坐席工号和日期查找对应的项目名称
      const key = `${order.agentId}_${orderDate}`;
      const projectName = agentProjectMap.get(key);
      
      if (projectName && order.city !== projectName) {
        updatedCount++;
        return {
          ...order,
          city: projectName
        };
      }
      
      return order;
    });
    
    // 保存更新后的订单数据
    fs.writeFileSync(ordersFile, JSON.stringify(updatedOrders, null, 2), 'utf-8');
    
    console.log(`\n更新完成:`);
    console.log(`- 总订单数: ${orders.length}`);
    console.log(`- 更新订单数: ${updatedCount}`);
    console.log(`- 跳过订单数: ${skippedCount}`);
    console.log(`- 未匹配订单数: ${orders.length - updatedCount - skippedCount}`);
    
    return updatedCount;
  } catch (error) {
    console.error('更新订单数据失败:', error);
    return 0;
  }
}

// 统计更新后的项目名称分布
function statisticsProjectNames() {
  const ordersFile = path.join(process.cwd(), 'data', 'orders.json');
  
  try {
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf-8'));
    const projectStats = {};
    
    orders.forEach(order => {
      const orderDate = order.date ? order.date.split(' ')[0] : '';
      if (orderDate >= '2026-03-01' && orderDate <= '2026-03-28') {
        const project = order.city || '未知项目';
        projectStats[project] = (projectStats[project] || 0) + 1;
      }
    });
    
    console.log('\n更新后的项目名称分布:');
    Object.entries(projectStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([project, count]) => {
        console.log(`- ${project}: ${count} 条`);
      });
    
    return projectStats;
  } catch (error) {
    console.error('统计项目名称分布失败:', error);
    return {};
  }
}

// 主函数
async function main() {
  console.log('开始更新业务订单项目名称...\n');
  
  // 步骤1: 构建坐席工号到项目名称的映射
  console.log('步骤1: 构建坐席工号到项目名称的映射...');
  const agentProjectMap = buildAgentProjectMap();
  console.log(`\n共构建 ${agentProjectMap.size} 个映射关系`);
  
  // 步骤2: 更新订单数据
  console.log('\n步骤2: 更新订单数据...');
  const updatedCount = updateOrders(agentProjectMap);
  
  // 步骤3: 统计更新后的项目名称分布
  console.log('\n步骤3: 统计更新后的项目名称分布...');
  statisticsProjectNames();
  
  console.log('\n更新完成!');
}

main().catch(console.error);
