// 3月5日通话清单同步脚本
// 功能：查询3月5日的API数据，对比本地文件，如有差异则更新

const path = require('path');
const { fetchCxccAgentRecordList, mapCxccRecordToCallLog } = require('../src/lib/cxcc-agent-record-list');
const { upsertLocalCallLogs, readLocalCallLogsByDate } = require('../src/lib/local-call-log-store-optimized');

// 日志函数
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

// 主函数
async function syncCallLogsForDate(date) {
  try {
    log(`开始同步 ${date} 的通话清单数据`);
    
    // 构建查询参数
    const startTime = `${date} 00:00:00`;
    const endTime = `${date} 23:59:59`;
    
    // 1. 从API获取数据
    log(`从API查询 ${date} 的通话数据`);
    const { records, total } = await fetchCxccAgentRecordList({
      pageNum: 1,
      pageSize: 100000, // 一次性获取所有数据
      startTime,
      endTime
    }, {
      primaryPath: '/om/agentrecordList/api' // 通话清单专用路径
    });
    
    log(`API查询完成，共获取 ${total} 条记录`);
    
    // 转换为通话清单格式
    const callLogs = records.map((record, index) => mapCxccRecordToCallLog(record, index));
    
    // 2. 读取本地文件数据
    log(`读取本地 ${date} 的通话数据文件`);
    const localCallLogs = await readLocalCallLogsByDate(date);
    const localCount = localCallLogs.length;
    
    log(`本地文件中有 ${localCount} 条记录`);
    
    // 3. 对比数据条数
    if (callLogs.length !== localCount) {
      log(`数据条数存在差异：API(${callLogs.length}) vs 本地(${localCount})，开始更新本地文件`);
      
      // 4. 更新本地文件
      const upsertedCount = await upsertLocalCallLogs(callLogs, {
        batchSize: 10000
      });
      
      log(`本地文件更新完成，共写入 ${upsertedCount} 条记录`);
      return { success: true, apiCount: callLogs.length, localCount, upsertedCount };
    } else {
      log(`数据条数一致：API(${callLogs.length}) vs 本地(${localCount})，无需更新`);
      return { success: true, apiCount: callLogs.length, localCount, upsertedCount: 0 };
    }
    
  } catch (error) {
    log(`同步过程中发生错误: ${error.message}`, 'error');
    console.error(error);
    return { success: false, error: error.message };
  }
}

// 执行脚本
if (require.main === module) {
  const targetDate = '2026-03-05';
  syncCallLogsForDate(targetDate)
    .then(result => {
      if (result.success) {
        log(`同步任务完成: API记录数=${result.apiCount}, 本地记录数=${result.localCount}, 更新记录数=${result.upsertedCount}`);
      } else {
        log(`同步任务失败: ${result.error}`, 'error');
      }
    })
    .catch(error => {
      log(`脚本执行失败: ${error.message}`, 'error');
      console.error(error);
    });
}

module.exports = { syncCallLogsForDate };
