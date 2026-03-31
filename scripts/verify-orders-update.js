import fs from 'fs';

const orders = JSON.parse(fs.readFileSync('./data/orders.json', 'utf-8'));

// 统计3月1日至3月28日的项目名称分布
const projectStats = {};
const dateStats = {};

orders.forEach(order => {
  const orderDate = order.date ? order.date.split(' ')[0] : '';
  if (orderDate >= '2026-03-01' && orderDate <= '2026-03-28') {
    const project = order.city || '未知项目';
    projectStats[project] = (projectStats[project] || 0) + 1;
    dateStats[orderDate] = (dateStats[orderDate] || 0) + 1;
  }
});

console.log('项目名称分布:');
Object.entries(projectStats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([project, count]) => {
    console.log(`- ${project}: ${count} 条`);
  });

console.log('\n日期分布:');
Object.entries(dateStats)
  .sort()
  .forEach(([date, count]) => {
    console.log(`- ${date}: ${count} 条`);
  });

console.log(`\n总计: ${Object.values(projectStats).reduce((a, b) => a + b, 0)} 条`);

// 检查是否有未知项目
if (projectStats['未知项目']) {
  console.log(`\n警告: 有 ${projectStats['未知项目']} 条订单的项目名称为"未知项目"`);
}

// 检查所有项目类型
const allProjects = Object.keys(projectStats);
console.log(`\n所有项目类型 (${allProjects.length} 种):`);
allProjects.forEach(project => {
  console.log(`- ${project}`);
});
