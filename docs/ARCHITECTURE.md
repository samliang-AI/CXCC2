# 系统架构文档

## 1. 系统概览

本系统是一个基于 Next.js 16.1.1 + TypeScript + shadcn/ui 的全栈应用项目，主要功能包括：

- 录音清单管理
- 团队管理
- 项目收益配置
- 团队目标管理
- 数据统计与分析

## 2. 技术栈

### 前端
- **框架**: Next.js 16.1.1 (App Router)
- **语言**: TypeScript
- **UI 组件**: shadcn/ui + Tailwind CSS v4
- **状态管理**: React useState + useEffect
- **HTTP 客户端**: 原生 fetch API
- **图表库**: ECharts, Recharts
- **日期处理**: date-fns

### 后端
- **API 路由**: Next.js API Routes
- **数据存储**: 本地 JSON 文件
- **文件操作**: fs/promises
- **Python 后端**: 用于数据处理和分析

## 3. 目录结构

```
├── data/                   # 数据存储目录
│   ├── daily-configs/      # 每日配置数据
│   ├── local-sync/         # 本地同步数据
│   ├── project-revenues/   # 项目收益配置
│   └── team-targets/       # 团队目标配置
├── src/                    # 源代码
│   ├── app/                # Next.js App Router
│   │   ├── (auth)/         # 认证相关页面
│   │   ├── (dashboard)/     # 仪表盘页面
│   │   │   ├── recordings/  # 录音清单页面
│   │   │   ├── reports/     # 报表页面
│   │   │   ├── system/      # 系统管理页面
│   │   │   └── ...
│   │   └── api/             # API 路由
│   ├── components/          # 通用组件
│   │   ├── analysis/        # 分析相关组件
│   │   ├── charts/          # 图表组件
│   │   └── ui/              # UI 组件
│   ├── lib/                 # 工具库
│   │   ├── storage/         # 存储相关
│   │   │   └── recording/   # 录音存储模块
│   │   └── utils/           # 工具函数
│   ├── types/               # 类型定义
│   └── hooks/               # 自定义钩子
└── python-backend/          # Python 后端
```

## 4. 核心模块

### 4.1 录音存储模块

**路径**: `src/lib/storage/recording/`

**功能**: 管理录音数据的存储和读取，支持按日期分文件存储，提高性能。

**模块划分**:
- `types.ts`: 类型定义
- `cache.ts`: 缓存管理
- `core.ts`: 核心功能
- `migration.ts`: 数据迁移
- `cleanup.ts`: 清理功能
- `stats.ts`: 统计功能

**数据流**:
1. 从 CXCC API 获取录音数据
2. 按日期分组存储到本地 JSON 文件
3. 前端查询时按日期范围读取数据
4. 支持数据缓存，提高读取性能

### 4.2 团队管理模块

**路径**: `src/app/(dashboard)/system/teams/`

**功能**: 管理团队信息、团队月度目标和项目收益配置。

**主要功能**:
- 团队列表管理
- 团队月度目标配置
- 项目收益配置（按地市和团队）
- 团队目标完成情况统计

### 4.3 录音清单模块

**路径**: `src/app/(dashboard)/recordings/`

**功能**: 展示录音清单，支持按日期范围查询。

**主要功能**:
- 日期范围选择
- 录音数据展示
- API 同步功能
- 数据导出

### 4.4 报表模块

**路径**: `src/app/(dashboard)/reports/`

**功能**: 提供各种统计报表，包括团队和坐席的业绩统计。

**主要报表**:
- 团队数据汇总
- 坐席数据明细
- 团队目标完成情况统计

## 5. API 路由

| 路径 | 方法 | 功能 |
|------|------|------|
| `/api/team-targets` | GET/POST | 团队目标管理 |
| `/api/project-revenues` | GET/POST | 项目收益配置 |
| `/api/local/recordings` | GET | 本地录音数据 |
| `/api/cxcc/recordings` | GET | CXCC 录音 API |
| `/api/reports/team/statistics` | GET | 团队统计数据 |
| `/api/reports/agent/statistics` | GET | 坐席统计数据 |

## 6. 数据存储

### 6.1 录音数据

**存储格式**: JSON 文件，按日期分文件存储

**文件命名**: `qms_recording_list_YYYY-MM-DD.json`

**数据结构**:
```json
[
  {
    "uuid": "string",
    "company_id": number,
    "project_id": number,
    "task_id": number,
    "agent": "string",
    "agent_name": "string",
    "calling_phone": "string",
    "called_phone": "string",
    "start_time": "YYYY-MM-DD HH:mm:ss",
    "end_time": "YYYY-MM-DD HH:mm:ss",
    "answer_duration": number,
    "play_url": "string",
    "status": number,
    "status_name": "string",
    "quality_status": number,
    "sync_time": "YYYY-MM-DD HH:mm:ss",
    "updated_at": "YYYY-MM-DD HH:mm:ss"
  }
]
```

### 6.2 团队目标数据

**存储格式**: JSON 文件，按月份存储

**文件命名**: `team-targets-YYYY-MM.json`

**数据结构**:
```json
[
  {
    "teamKey": "string",
    "teamName": "string",
    "month": "YYYY-MM",
    "targetCalls": number,
    "targetConnected": number,
    "targetSuccess": number,
    "revenuePerSuccess": number
  }
]
```

### 6.3 项目收益配置

**存储格式**: JSON 文件，按月份存储

**文件命名**: `project-revenues-YYYY-MM.json`

**数据结构**:
```json
[
  {
    "projectKey": "string",
    "projectName": "string",
    "teamKey": "string",
    "teamName": "string",
    "month": "YYYY-MM",
    "revenuePerSuccess": number
  }
]
```

## 7. 系统流程

### 7.1 录音数据同步流程

1. 用户在录音清单页面选择日期范围
2. 系统调用 CXCC API 获取录音数据
3. 数据按日期分组存储到本地 JSON 文件
4. 前端从本地文件读取数据并展示

### 7.2 团队目标管理流程

1. 用户在团队管理页面配置团队月度目标
2. 系统将目标数据存储到对应月份的文件
3. 报表页面读取目标数据和实际完成数据
4. 计算目标完成率并展示统计图表

### 7.3 项目收益配置流程

1. 用户在项目收益配置页面配置地市和团队的毛利单价
2. 系统将配置数据存储到对应月份的文件
3. 报表页面使用配置数据计算团队收益

## 8. 性能优化

### 8.1 数据存储优化
- 按日期分文件存储录音数据，减少单个文件大小
- 实现数据缓存，提高读取性能
- 批量处理数据，减少文件 I/O 操作

### 8.2 前端优化
- 使用 React.memo 减少不必要的渲染
- 实现虚拟滚动，处理大量数据展示
- 优化 API 调用，避免重复请求

### 8.3 后端优化
- 实现请求队列，避免并发写入冲突
- 优化文件读取，使用缓存减少 I/O 操作
- 实现数据验证，确保数据完整性

## 9. 安全考虑

### 9.1 数据安全
- 敏感数据脱敏处理
- 数据备份机制
- 访问权限控制

### 9.2 系统安全
- 输入验证，防止注入攻击
- 错误处理，避免信息泄露
- 日志记录，便于问题排查

## 10. 扩展性

### 10.1 模块扩展
- 可插拔的存储模块，支持不同存储方式
- 可扩展的报表模块，支持自定义报表
- 可配置的 API 集成，支持不同数据源

### 10.2 技术扩展
- 支持数据库存储替代文件存储
- 支持微服务架构，拆分核心功能
- 支持容器化部署，提高可移植性

## 11. 监控与维护

### 11.1 监控
- 系统运行状态监控
- 数据同步状态监控
- 性能指标监控

### 11.2 维护
- 数据清理机制
- 日志管理
- 系统备份策略

## 12. 总结

本系统采用现代化的技术栈和架构设计，具有良好的可扩展性和可维护性。通过模块化设计和性能优化，确保系统能够处理大量数据并保持良好的响应速度。同时，完善的文档和开发流程规范，为团队协作和系统维护提供了有力支持。