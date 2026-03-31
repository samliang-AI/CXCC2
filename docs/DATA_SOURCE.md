# 数据源模式（mock / real）

## 环境变量

在项目根目录 `.env.local` 中配置：

| 变量 | 说明 |
|------|------|
| `DATA_SOURCE_MODE` | 服务端 API 使用：`mock`（默认）或 `real` |
| `NEXT_PUBLIC_DATA_SOURCE_MODE` | 与上一项保持一致，供**客户端组件**判断（如上传数据源上下文） |

**仅真实源（禁止模拟降级）示例：**

```env
DATA_SOURCE_MODE=real
NEXT_PUBLIC_DATA_SOURCE_MODE=real
```

修改后需**重启** Next.js 开发服务。

## `real` 模式下行为

1. **数据看板** `/api/dashboard/statistics`  
   - 仅从 Supabase 表 `qms_recording_list`、`qms_quality_score` 聚合。  
   - 需配置：`COZE_SUPABASE_URL`、`COZE_SUPABASE_ANON_KEY`。  
   - 若不可用：返回 **503**，不再降级为随机 mock。

2. **通话清单 / 录音清单（CXCC API 事实源）**  
   - `/api/data/call-logs`（`DATA_SOURCE_MODE=real` 时）→ `POST {CXCC_BASE_URL}/om/agentrecordList/api`  
   - `/api/cxcc/recordings`（始终代理 CXCC）→ 同上  
   - 需配置：`CXCC_BASE_URL`、`CXCC_AUTH_TOKEN`（PDF：请求头 `Authentication`）  
   - 可选：`CXCC_AGENT_RECORD_LIST_PATH`（默认 `/om/agentrecordList/api`，与现场网关路径不一致时可改）  
   - 说明：话单接口无地市字段；试听需 `playUrl` 时请另接 `getCdrByUuid` 等接口扩展。

3. **报表类仍从 Supabase 聚合**（`DATA_SOURCE_MODE=real` 时）：  
   - `/api/reports/outbound-result/statistics`  
   - `/api/reports/team/statistics`  
   - `/api/reports/team/agent-daily`  
   - `/api/reports/type-filter/statistics`  

   需配置 `COZE_SUPABASE_URL`、`COZE_SUPABASE_ANON_KEY`。

4. **客户端**  
   - `DataSourceContext` 在 `real` 模式下不再用随机数填充记录条数（无 `actualRecords` 时为 0）。

## 仍含页面内演示/随机逻辑（后续可逐页接入）

部分页面仍有 `Math.random` 或本地演示数据（如部分数据源分析页）。需要时可按业务改为只调真实 API。
