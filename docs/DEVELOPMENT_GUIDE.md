# 开发指南

## 1. 开发环境搭建

### 1.1 前置要求

- Node.js 20+ 
- pnpm 9+
- Python 3.8+ (用于后端数据处理)

### 1.2 安装依赖

```bash
# 安装前端依赖
pnpm install

# 安装 Python 后端依赖（可选）
cd python-backend
pip install -r requirements.txt
```

### 1.3 启动开发服务器

```bash
# 启动前端开发服务器（端口 5001）
pnpm dev

# 启动 Python 后端（可选）
pnpm dev:backend

# 同时启动前端和后端
pnpm dev:all
```

## 2. 项目结构

### 2.1 核心目录

- `src/app/` - Next.js App Router 页面和 API 路由
- `src/components/` - 通用组件
- `src/lib/` - 工具库和核心功能
- `src/types/` - TypeScript 类型定义
- `src/hooks/` - 自定义 React 钩子
- `data/` - 本地数据存储
- `python-backend/` - Python 后端代码

### 2.2 模块划分

- **录音存储模块**: `src/lib/storage/recording/`
- **团队管理模块**: `src/app/(dashboard)/system/teams/`
- **录音清单模块**: `src/app/(dashboard)/recordings/`
- **报表模块**: `src/app/(dashboard)/reports/`

## 3. 开发流程

### 3.1 代码分支管理

- `main` - 主分支，用于生产环境
- `develop` - 开发分支，用于集成测试
- `feature/xxx` - 功能分支，用于开发新功能
- `bugfix/xxx` - 修复分支，用于修复 bug

### 3.2 开发规范

#### 3.2.1 代码风格

- 使用 TypeScript 编写所有代码
- 遵循 ESLint 和 Prettier 规范
- 使用单引号
- 使用分号
- 80 字符行宽

#### 3.2.2 命名规范

- **文件命名**: 小驼峰命名法，例如 `userService.ts`
- **变量命名**: 小驼峰命名法，例如 `userName`
- **函数命名**: 小驼峰命名法，例如 `getUserInfo()`
- **类命名**: 大驼峰命名法，例如 `UserService`
- **常量命名**: 全大写蛇形命名法，例如 `MAX_RETRY_COUNT`

#### 3.2.3 代码结构

- 使用模块化设计，每个模块职责单一
- 函数长度控制在 50 行以内
- 使用注释说明复杂逻辑
- 遵循 SOLID 原则

### 3.3 测试流程

1. 编写单元测试
2. 运行测试套件
3. 进行手动测试
4. 提交代码

```bash
# 运行测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:coverage

# 运行 TypeScript 类型检查
pnpm ts-check

# 运行 ESLint 检查
pnpm lint

# 运行 Prettier 检查
pnpm format:check

# 自动格式化代码
pnpm format
```

### 3.4 提交规范

使用 Conventional Commits 规范提交消息：

```
<类型>(<范围>): <描述>

[可选的正文]

[可选的页脚]
```

**类型**:
- `feat` - 新功能
- `fix` - 修复 bug
- `docs` - 文档更新
- `style` - 代码风格修改
- `refactor` - 代码重构
- `test` - 测试相关
- `chore` - 构建或依赖更新

**示例**:
```
feat(recording): 添加录音数据导出功能

添加了按日期范围导出录音数据的功能，支持 CSV 和 JSON 格式。

Closes #123
```

### 3.5 代码审查

1. 创建 Pull Request
2. 填写 PR 模板
3. 等待代码审查
4. 解决审查意见
5. 合并分支

## 4. 核心功能开发

### 4.1 录音存储模块

**路径**: `src/lib/storage/recording/`

**开发流程**:
1. 了解现有模块结构
2. 实现新功能或修复 bug
3. 编写单元测试
4. 运行测试验证

**核心功能**:
- 按日期分文件存储录音数据
- 数据缓存管理
- 数据迁移和清理
- 存储统计

### 4.2 团队管理模块

**路径**: `src/app/(dashboard)/system/teams/`

**开发流程**:
1. 了解页面结构和组件
2. 实现新功能或修复 bug
3. 测试功能完整性
4. 验证数据存储和读取

**核心功能**:
- 团队列表管理
- 团队月度目标配置
- 项目收益配置
- 团队目标完成情况统计

### 4.3 录音清单模块

**路径**: `src/app/(dashboard)/recordings/`

**开发流程**:
1. 了解 API 调用和数据处理
2. 实现新功能或优化性能
3. 测试数据同步和展示
4. 验证错误处理

**核心功能**:
- 日期范围选择
- 录音数据展示
- API 同步功能
- 数据导出

### 4.4 报表模块

**路径**: `src/app/(dashboard)/reports/`

**开发流程**:
1. 了解数据来源和统计逻辑
2. 实现新报表或优化现有报表
3. 测试数据准确性
4. 验证图表展示

**核心功能**:
- 团队数据汇总
- 坐席数据明细
- 团队目标完成情况统计
- 数据可视化

## 5. API 开发

### 5.1 API 路由结构

API 路由位于 `src/app/api/` 目录，采用 Next.js API Routes 格式。

**示例结构**:
```
src/app/api/
├── team-targets/
│   └── route.ts
├── project-revenues/
│   └── route.ts
└── local/
    └── recordings/
        └── route.ts
```

### 5.2 API 开发规范

- 使用 TypeScript 类型定义请求和响应
- 实现错误处理和异常捕获
- 添加适当的日志记录
- 验证请求参数
- 返回统一的响应格式

**响应格式**:
```json
{
  "code": 0,  // 0 表示成功，其他表示错误
  "message": "OK",
  "data": {...}
}
```

### 5.3 数据验证

使用 Zod 进行数据验证：

```typescript
import { z } from 'zod'

const targetSchema = z.object({
  teamKey: z.string().min(1),
  teamName: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  targetCalls: z.number().min(0),
  targetConnected: z.number().min(0),
  targetSuccess: z.number().min(0)
})

const validatedData = targetSchema.parse(body)
```

## 6. 数据存储

### 6.1 本地文件存储

系统使用本地 JSON 文件存储数据，主要包括：

- **录音数据**: `data/local-sync/qms_recording_list_YYYY-MM-DD.json`
- **团队目标**: `data/team-targets/team-targets-YYYY-MM.json`
- **项目收益**: `data/project-revenues/project-revenues-YYYY-MM.json`

### 6.2 数据备份

定期备份数据文件，避免数据丢失：

```bash
# 手动备份
cp -r data/ data_backup_$(date +%Y%m%d)/

# 自动备份（可配置定时任务）
```

### 6.3 数据清理

定期清理过期数据，保持系统性能：

```bash
# 清理 30 天前的录音数据
node -e "require('./src/lib/storage/recording').cleanupOldRecordings('$(date -d "30 days ago" +%Y-%m-%d)')"
```

## 7. 性能优化

### 7.1 前端优化

- 使用 React.memo 减少不必要的渲染
- 实现虚拟滚动处理大量数据
- 优化 API 调用，避免重复请求
- 使用 useMemo 和 useCallback 缓存计算结果

### 7.2 后端优化

- 实现数据缓存，减少文件 I/O
- 批量处理数据，提高写入性能
- 优化文件读取，使用流式读取处理大文件
- 实现请求队列，避免并发写入冲突

### 7.3 存储优化

- 按日期分文件存储，减少单个文件大小
- 实现数据压缩，减少存储占用
- 定期清理过期数据，保持存储效率

## 8. 部署流程

### 8.1 构建

```bash
# 构建生产版本
pnpm build

# 验证构建结果
pnpm start
```

### 8.2 部署选项

- **Vercel**: 直接部署 Next.js 应用
- **Docker**: 使用 Docker 容器部署
- **本地服务器**: 在本地服务器上部署

### 8.3 环境配置

创建 `.env` 文件配置环境变量：

```env
# API 配置
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001

# 数据存储配置
SYNC_LOCAL_UPSERT_BATCH_SIZE=10000

# 日志配置
LOG_LEVEL=info
```

## 9. 监控与维护

### 9.1 日志管理

系统使用控制台日志记录重要操作和错误：

```typescript
// 信息日志
console.log('Sync completed successfully')

// 错误日志
console.error('Sync failed:', error)

// 警告日志
console.warn('Low disk space detected')
```

### 9.2 错误处理

实现统一的错误处理机制：

```typescript
try {
  // 业务逻辑
} catch (error) {
  console.error('Error:', error)
  return NextResponse.json(
    { code: 500, message: error instanceof Error ? error.message : '服务器错误' },
    { status: 500 }
  )
}
```

### 9.3 系统监控

监控系统运行状态和性能指标：

- **CPU 和内存使用**
- **磁盘空间**
- **API 响应时间**
- **数据同步状态**

## 10. 常见问题

### 10.1 数据同步问题

**症状**: 录音数据同步失败

**解决方案**:
- 检查网络连接
- 验证 API 凭证
- 查看日志文件
- 尝试重新同步

### 10.2 性能问题

**症状**: 页面加载缓慢

**解决方案**:
- 检查数据量大小
- 优化查询参数
- 清理过期数据
- 增加服务器资源

### 10.3 数据一致性问题

**症状**: 数据显示不一致

**解决方案**:
- 检查数据存储文件
- 验证数据同步状态
- 运行数据修复脚本
- 重建索引

## 11. 最佳实践

### 11.1 代码质量

- 编写单元测试覆盖核心功能
- 使用 TypeScript 类型确保类型安全
- 遵循代码风格规范
- 定期进行代码审查

### 11.2 安全性

- 对敏感数据进行脱敏处理
- 验证所有用户输入
- 实现适当的错误处理
- 定期更新依赖包

### 11.3 可维护性

- 使用模块化设计
- 编写清晰的文档
- 遵循一致的命名规范
- 保持代码简洁明了

### 11.4 扩展性

- 设计可插拔的模块
- 使用接口和抽象类
- 实现配置驱动的功能
- 考虑未来的功能扩展

## 12. 总结

本开发指南提供了系统开发的全面指导，包括环境搭建、开发流程、代码规范、核心功能开发、API 开发、数据存储、性能优化、部署流程、监控与维护等方面。遵循本指南可以确保系统开发的质量和效率，同时为团队协作提供统一的标准和规范。