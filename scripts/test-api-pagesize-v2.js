/**
 * API分页大小测试脚本 - 通过本地API接口测试
 * 测试 pageSize=10000 时实际返回多少条数据
 */
require('dotenv').config({ path: '.env.local' });

const http = require('node:http');

// 本地API接口
const LOCAL_API_URL = 'http://localhost:5001/api/cxcc/recordings';

// 发起HTTP请求
function httpRequest(url, method, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body),
            raw: body
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: null,
            raw: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 测试API查询
async function testApiPageSize(testPageSize) {
  // 获取今天的日期
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  const startTime = `${todayStr} 00:00:00`;
  const endTime = `${todayStr} 23:59:59`;

  console.log(`\n=== 测试参数 ===`);
  console.log(`测试日期: ${todayStr}`);
  console.log(`时间范围: ${startTime} 到 ${endTime}`);
  console.log(`测试pageSize: ${testPageSize}`);

  // 构建请求体
  const reqBody = {
    pageNum: 1,
    pageSize: testPageSize,
    startTime,
    endTime
  };

  console.log(`\n=== 请求信息 ===`);
  console.log(`URL: ${LOCAL_API_URL}`);
  console.log(`请求体: ${JSON.stringify(reqBody, null, 2)}`);

  try {
    const response = await httpRequest(LOCAL_API_URL, 'POST', reqBody);

    console.log(`\n=== 响应状态 ===`);
    console.log(`HTTP状态码: ${response.status}`);

    if (response.status < 200 || response.status >= 300) {
      console.error(`HTTP请求失败: ${response.raw.slice(0, 500)}`);
      return;
    }

    const json = response.data;
    
    if (!json) {
      console.error(`响应解析失败: ${response.raw.slice(0, 500)}`);
      return;
    }

    console.log(`\n=== 查询结果 ===`);
    console.log(`接口返回code: ${json.code}`);
    console.log(`接口返回message: ${json.message || '无message'}`);
    
    // 检查不同可能的返回字段
    if (json.total !== undefined) {
      console.log(`接口返回total字段值: ${json.total}`);
    }
    if (json.data?.total !== undefined) {
      console.log(`接口返回data.total字段值: ${json.data.total}`);
    }
    
    let records = [];
    if (json.rows && Array.isArray(json.rows)) {
      records = json.rows;
    } else if (json.data?.records && Array.isArray(json.data.records)) {
      records = json.data.records;
    } else if (json.list && Array.isArray(json.list)) {
      records = json.list;
    } else if (Array.isArray(json)) {
      records = json;
    }
    
    console.log(`实际返回记录数: ${records.length}`);
    
    if (records.length > 0) {
      console.log(`\n=== 数据样例 ===`);
      const first = records[0];
      console.log(`第一条记录UUID: ${first.uuid || first.id || '无UUID'}`);
      console.log(`第一条记录坐席: ${first.agent || first.agentCode || '无agent'}`);
      console.log(`第一条记录开始时间: ${first.startTime || first.start_time || first.start_time || '无startTime'}`);
      console.log(`第一条记录通话时长: ${first.answerDuration || first.answer_duration || '无answerDuration'}`);
    }

    // 分析返回结果
    console.log(`\n=== 分析结论 ===`);
    const total = json.total || json.data?.total || records.length;
    
    if (records.length === testPageSize) {
      console.log(`✓ API支持返回 ${testPageSize} 条数据（pageSize参数生效）`);
    } else if (records.length < testPageSize) {
      if (records.length === total) {
        console.log(`✓ 今天只有 ${records.length} 条符合条件的数据（小于请求的 ${testPageSize}）`);
      } else if (records.length === 500) {
        console.log(`✗ API单次请求最多返回500条（后端限制），虽然请求了 ${testPageSize} 条`);
        console.log(`  提示: 需要分页获取完整数据`);
      } else if (records.length === 1000) {
        console.log(`✗ API单次请求最多返回1000条（后端限制），虽然请求了 ${testPageSize} 条`);
      } else {
        console.log(`? 返回 ${records.length} 条，请求 ${testPageSize} 条，total ${total} 条`);
      }
    }

    // 检查是否有更多数据需要分页
    if (total > records.length && records.length > 0) {
      const pagesNeeded = Math.ceil(total / records.length);
      console.log(`\n📌 注意: 总共有 ${total} 条数据，需要分页 ${pagesNeeded} 次才能获取完整数据`);
    }

    return records.length;

  } catch (error) {
    console.error(`\n✗ 请求失败: ${error.message}`);
    console.error('确保本地开发服务器已启动: npm run dev (端口5001)');
    return -1;
  }
}

// 运行测试
async function main() {
  console.log('API分页大小测试');
  console.log('='.repeat(60));
  console.log('测试本地API接口是否支持大pageSize参数');
  console.log('='.repeat(60));
  
  // 先测试接口是否可用
  try {
    await httpRequest('http://localhost:5001/api/health', 'GET');
  } catch (e) {
    console.error('错误: 无法连接到本地服务器 (http://localhost:5001)');
    console.error('请先启动开发服务器: npm run dev');
    process.exit(1);
  }
  
  const testSizes = [500, 1000, 10000];
  const results = {};
  
  for (const size of testSizes) {
    console.log('\n' + '='.repeat(60));
    console.log(`测试 pageSize = ${size}`);
    console.log('='.repeat(60));
    
    const count = await testApiPageSize(size);
    results[size] = count;
    
    // 间隔一下避免请求太频繁
    if (size !== testSizes[testSizes.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('测试总结');
  console.log('='.repeat(60));
  for (const [size, count] of Object.entries(results)) {
    if (count === -1) {
      console.log(`pageSize=${size}: 请求失败`);
    } else {
      console.log(`pageSize=${size}: 返回 ${count} 条记录`);
    }
  }
}

main();
