# API 路由重构说明

## 背景
由于 Vercel Hobby 计划限制每个部署最多只能有 12 个 Serverless Functions，而项目原有 38 个 API 路由，因此需要进行路由合并。

## 新的 API 路由结构

### 1. CXCC API (`/api/cxcc`)
**原路由数量**: 5个  
**新路由**: `/api/cxcc?action=...`

**支持的 action 参数**:
- `agents` - 坐席列表 (GET)
- `teams` - 团队列表 (GET)
- `login` - 登录 (POST/GET/DELETE)
- `call-logs` - 通话清单 (POST)
- `recordings` - 录音清单 (GET)
- `call-logs-update` - 更新本地通话清单 (POST)
- `recordings-update` - 更新本地录音清单 (POST)

**示例**:
```
GET /api/cxcc?action=agents&page=1&pageSize=20
GET /api/cxcc?action=teams&keyword=登封
POST /api/cxcc?action=login
GET /api/cxcc?action=recordings&date=2024-01-01
POST /api/cxcc?action=call-logs-update
```

### 2. Local API (`/api/local`)
**原路由数量**: 4个  
**新路由**: `/api/local?action=...`

**支持的 action 参数**:
- `agents` - 本地坐席列表 (GET)
- `teams` - 本地团队列表 (GET/POST)
- `call-logs` - 本地通话清单 (GET)
- `recordings` - 本地录音清单 (GET)

**示例**:
```
GET /api/local?action=agents&page=1&pageSize=20
GET /api/local?action=teams&keyword=登封
POST /api/local?action=teams
GET /api/local?action=call-logs&date=2024-01-01
```

### 3. Internal Sync API (`/api/sync`)
**原路由数量**: 9个  
**新路由**: `/api/sync?action=...`

**支持的 action 参数**:
- `agents` - 同步坐席数据 (GET)
- `teams` - 同步团队数据 (GET)
- `call-logs` - 同步通话清单 (GET)
- `call-logs-backfill` - 回填通话清单 (GET)
- `call-logs-backfill-quick` - 快速回填通话清单 (GET)
- `recordings` - 同步录音清单 (GET)
- `recordings-backfill` - 回填录音清单 (GET)
- `recordings-backfill-quick` - 快速回填录音清单 (GET)
- `recordings-date-sync` - 按日期同步录音 (GET)
- `daily` - 每日同步 (GET)

### 4. Reports API (`/api/reports`)
**原路由数量**: 4个  
**新路由**: `/api/reports?type=...`

**支持的 type 参数**:
- `outbound-result` - 外呼结果统计
- `team` - 团队统计
- `team-agent-daily` - 团队坐席日报
- `type-filter` - 类型筛选统计

### 5. Auth API (`/api/auth`)
**原路由数量**: 2个  
**新路由**: `/api/auth?action=...`

**支持的 action 参数**:
- `login` - 登录
- `logout` - 登出

### 6. Recordings API (`/api/recordings`)
**原路由数量**: 2个  
**新路由**: `/api/recordings?action=...`

**支持的 action 参数**:
- `list` - 录音列表
- `success-customers` - 成功客户列表

### 7. Dashboard API (`/api/dashboard`)
**原路由数量**: 2个  
**新路由**: `/api/dashboard?type=...`

**支持的 type 参数**:
- `statistics` - 统计数据
- `data` - 数据看板

## 保留的独立路由

以下路由保持独立，不进行合并：

1. `/api/orders` - 订单管理
2. `/api/project-revenues` - 项目收益
3. `/api/team-targets` - 团队目标
4. `/api/teams` - 团队管理
5. `/api/agents/team` - 坐席团队
6. `/api/ai-chat` - AI 聊天
7. `/api/ai-quality` - AI 质检
8. `/api/data/call-logs` - 数据通话清单

**总计**: 8个独立路由 + 7个合并路由 = 15个路由

## 迁移指南

### 前端代码更新

**旧代码**:
```typescript
const response = await fetch('/api/cxcc/agents?page=1&pageSize=20')
```

**新代码**:
```typescript
const response = await fetch('/api/cxcc?action=agents&page=1&pageSize=20')
```

### 后端代码更新

所有旧的 API 路由文件将被删除，只保留新的统一路由文件。

## 路由数量对比

- **重构前**: 38 个路由
- **重构后**: 15 个路由
- **减少**: 23 个路由 (60.5% 减少)

## 部署注意事项

1. 确保所有前端代码都已更新为使用新的 API 路由
2. 测试所有 API 功能确保正常工作
3. 部署到 Vercel 后验证所有功能
