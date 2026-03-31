/**
 * API分页大小测试脚本
 * 测试 pageSize=10000 时实际返回多少条数据
 */
require('dotenv').config({ path: '.env.local' });

const https = require('node:https');
const http = require('node:http');

// 从环境变量获取配置
function getCxccConfig() {
  const baseUrl = (process.env.CXCC_BASE_URL || '').replace(/\/$/, '');
  const token = process.env.CXCC_AUTH_TOKEN || '';
  return { baseUrl, token };
}

// 发起HTTP请求
function cxccFetch(url, opts, isHttps = false) {
  const proto = isHttps ? https : http;
  
  return new Promise((resolve, reject) => {
    const req = proto.request(
      url,
      {
        method: opts.method,
        headers: opts.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('error', reject);
    req.write(opts.body);
    req.end();
  });
}

// 解析JSON响应
function safeParseCxccJson(rawText) {
  const text = rawText.trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('JSON解析失败:', rawText.slice(0, 500));
    throw new Error(`JSON解析失败: ${e.message}`);
  }
}

// 解析返回数据
function parseAgentRecordListPayload(json) {
  const root = json;
  const code = root.code;
  const codeOk =
    code === undefined ||
    code === null ||
    code === 0 ||
    code === '0' ||
    code === 200 ||
    code === '200';
  
  if (!codeOk) {
    const msg = root.message || 'CXCC接口返回错误';
    throw new Error(`${msg} (code=${String(code)})`);
  }

  let payload = root.data ?? root.result;
  
  if (Array.isArray(payload)) {
    const records = payload;
    return { records, total: records.length, raw: json };
  }

  if (payload && typeof payload === 'object' && 'data' in payload && !('records' in payload)) {
    const inner = payload.data;
    if (Array.isArray(inner)) {
      return { records: inner, total: inner.length, raw: json };
    }
    payload = inner;
  }

  if (!payload || typeof payload !== 'object') {
    const top = root.records ?? root.rows ?? root.list ?? root.record;
    if (Array.isArray(top)) {
      return {
        records: top,
        total: Number(root.total ?? root.totalCount ?? top.length) || 0,
        raw: json,
      };
    }
    return { records: [], total: 0, raw: json };
  }

  const p = payload;
  let records = p.records ?? p.record ?? p.list ?? p.rows ?? p.content;
  if (!Array.isArray(records)) {
    records = [];
  }

  const total =
    Number(
      p.total ??
        p.totalCount ??
        p.totalElements ??
        p.count ??
        records.length
    ) || 0;

  return { records, total, raw: json };
}

// 测试API查询
async function testApiPageSize(testPageSize) {
  const { baseUrl, token } = getCxccConfig();
  
  if (!baseUrl || !token) {
    console.error('错误: 请配置CXCC_BASE_URL和CXCC_AUTH_TOKEN环境变量');
    process.exit(1);
  }

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

  // API路径 - 录音清单专用
  const path = '/om/agentCalldetailList/selectRecordList/api';
  const url = `${baseUrl}${path}`;

  // 构建请求体
  const reqBody = {
    pageNum: 1,
    pageSize: testPageSize,
    startTime,
    endTime,
    answerDurationStart: 1
  };

  console.log(`\n=== 请求信息 ===`);
  console.log(`URL: ${url}`);
  console.log(`请求体: ${JSON.stringify(reqBody, null, 2)}`);

  const isHttps = url.startsWith('https:');

  try {
    const r = await cxccFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authentication: token,
      },
      body: JSON.stringify(reqBody),
    }, isHttps);

    console.log(`\n=== 响应状态 ===`);
    console.log(`HTTP状态码: ${r.status}`);

    if (r.status < 200 || r.status >= 300) {
      console.error(`HTTP请求失败: ${r.text.slice(0, 500)}`);
      return;
    }

    const json = safeParseCxccJson(r.text);
    const parsed = parseAgentRecordListPayload(json);

    console.log(`\n=== 查询结果 ===`);
    console.log(`接口返回total字段值: ${parsed.total}`);
    console.log(`实际返回records数组长度: ${parsed.records.length}`);
    
    if (parsed.records.length > 0) {
      console.log(`\n=== 数据样例 ===`);
      console.log(`第一条记录UUID: ${parsed.records[0].uuid || '无UUID'}`);
      console.log(`第一条记录坐席: ${parsed.records[0].agent || '无agent'}`);
      console.log(`第一条记录开始时间: ${parsed.records[0].startTime || parsed.records[0].start_time || '无startTime'}`);
    }

    // 分析返回结果
    console.log(`\n=== 分析结论 ===`);
    if (parsed.records.length === testPageSize) {
      console.log(`✓ API支持返回 ${testPageSize} 条数据（pageSize参数生效）`);
    } else if (parsed.records.length < testPageSize) {
      if (parsed.records.length === parsed.total) {
        console.log(`✓ 今天只有 ${parsed.records.length} 条数据（小于请求的 ${testPageSize}）`);
      } else if (parsed.records.length === 500) {
        console.log(`✗ API单次请求最多返回500条（后端限制），虽然请求了 ${testPageSize} 条`);
        console.log(`  提示: 需要分页获取完整数据`);
      } else if (parsed.records.length === 1000) {
        console.log(`✗ API单次请求最多返回1000条（后端限制），虽然请求了 ${testPageSize} 条`);
      } else {
        console.log(`? 返回 ${parsed.records.length} 条，请求 ${testPageSize} 条，total ${parsed.total} 条`);
      }
    }

    // 检查是否有更多数据需要分页
    if (parsed.total > parsed.records.length) {
      console.log(`\n📌 注意: 总共有 ${parsed.total} 条数据，需要分页 ${Math.ceil(parsed.total / parsed.records.length)} 次才能获取完整数据`);
    }

  } catch (error) {
    console.error(`\n✗ 请求失败: ${error.message}`);
    console.error(error.stack);
  }
}

// 运行测试
async function main() {
  const testSizes = [500, 1000, 10000];
  
  for (const size of testSizes) {
    console.log('\n' + '='.repeat(60));
    console.log(`测试 pageSize = ${size}`);
    console.log('='.repeat(60));
    
    await testApiPageSize(size);
    
    // 间隔一下避免请求太频繁
    if (size !== testSizes[testSizes.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

main();
