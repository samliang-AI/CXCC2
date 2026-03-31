# 自动刷新功能实现说明

## 功能概述

为数据看板和团队看板两个页面添加了自动刷新数据开关，当用户开启开关时，系统会根据当前筛选的时间范围每 30 秒自动刷新一次数据。

## 主要特性

1. **自动刷新开关**
   - 位于页面时间筛选器右侧
   - 用户可通过开关控制自动刷新功能的启停
   - 开启后显示刷新状态、刷新次数和上次刷新时间

2. **后台静默刷新**
   - 数据在后台自动更新
   - 前端页面无任何刷新行为
   - 无 loading 状态切换
   - 无页面闪烁
   - 用户体验流畅，完全无感知

3. **状态显示**
   - 刷新次数统计
   - 上次刷新时间显示（精确到秒）
   - 刷新中状态指示（动画效果）
   - 时间悬停提示（显示相对时间）

4. **手动控制**
   - 关闭自动刷新后，需手动点击"查询"按钮更新数据
   - 自动刷新开启时，手动查询会重置刷新计数

## 技术实现

### 优化说明（v2）

**问题**：初始版本在刷新数据时会触发整个页面重新加载

**解决方案**：
1. **分离 loading 状态**：`fetchData` 函数接受 `isAutoRefresh` 参数，自动刷新时不触发 loading 状态
2. **使用 refs 避免重渲染**：使用 `useRef` 存储内部状态，避免不必要的 React 状态更新
3. **精细化状态管理**：仅更新必要状态（刷新次数、时间），不触发可见组件的重渲染
4. **后台静默刷新**：数据更新与 UI 状态完全分离

**修改文件**：
- `src/hooks/use-auto-refresh.ts` - 使用 refs 存储内部状态
- `src/app/(dashboard)/dashboard/page.tsx` - fetchData 支持 isAutoRefresh 参数
- `src/app/(dashboard)/reports/team/page.tsx` - fetchData 支持 isAutoRefresh 参数

### 1. 自定义 Hook - `useAutoRefresh`

**文件**: `src/hooks/use-auto-refresh.ts`

提供自动刷新核心逻辑：
- 30 秒定时刷新间隔
- 自动清理和重置机制
- 刷新状态管理
- 错误处理和日志记录

**主要参数**:
```typescript
interface UseAutoRefreshOptions {
  enabled: boolean           // 是否启用自动刷新
  refreshInterval?: number   // 刷新间隔（毫秒），默认 30000
  fetchData: Function        // 数据获取函数
  startDate?: string         // 开始日期
  endDate?: string           // 结束日期
}
```

**返回值**:
```typescript
interface UseAutoRefreshReturn {
  autoRefreshEnabled: boolean    // 当前是否启用
  setAutoRefreshEnabled: Function // 设置启用状态
  refreshCount: number           // 刷新次数
  lastRefreshTime: Date | null   // 上次刷新时间
  isRefreshing: boolean          // 是否正在刷新
  toggleAutoRefresh: Function    // 切换开关
  resetRefreshCount: Function    // 重置计数
}
```

### 2. 自动刷新开关组件 - `AutoRefreshToggle`

**文件**: `src/components/auto-refresh-toggle.tsx`

UI 组件，提供：
- Switch 开关控件
- 刷新状态徽章
- 刷新次数显示
- 上次刷新时间显示
- Tooltip 提示信息

**属性**:
```typescript
interface AutoRefreshToggleProps {
  enabled: boolean              // 是否启用
  onToggle: () => void          // 切换回调
  refreshCount?: number         // 刷新次数
  lastRefreshTime?: Date | null // 上次刷新时间
  isRefreshing?: boolean        // 是否正在刷新
  showDetails?: boolean         // 是否显示详情
}
```

### 3. 页面集成

#### 数据看板页面
**文件**: `src/app/(dashboard)/dashboard/page.tsx`

修改内容：
1. 导入 Hook 和组件
2. 调用 `useAutoRefresh` Hook
3. 在时间筛选器中添加 `AutoRefreshToggle` 组件

#### 团队看板页面
**文件**: `src/app/(dashboard)/reports/team/page.tsx`

修改内容：
1. 导入 Hook 和组件
2. 调用 `useAutoRefresh` Hook
3. 在时间筛选器中添加 `AutoRefreshToggle` 组件

## 使用说明

### 开启自动刷新

1. 进入数据看板或团队看板页面
2. 在时间筛选器区域找到"自动刷新"开关
3. 点击开关至开启状态（蓝色）
4. 系统立即执行一次数据刷新
5. 之后每 30 秒自动刷新一次

### 查看刷新状态

开启自动刷新后，开关右侧会显示：
- **刷新中徽章**: 动态旋转图标，表示正在加载数据
- **刷新次数**: 显示已完成的刷新次数
- **上次刷新时间**: 显示具体时间和相对时间（如"10 秒前"）

### 关闭自动刷新

1. 点击开关至关闭状态（灰色）
2. 状态徽章隐藏
3. 数据停止自动更新
4. 需手动点击"查询"按钮更新数据

### 切换时间范围

- 当用户更改开始/结束日期时，自动刷新会继续使用新的时间范围
- 每次刷新都会使用当前最新的筛选条件
- 建议：切换时间范围后，手动执行一次查询确认数据

## 刷新机制

### 刷新流程

1. **开启开关** → 立即执行第一次刷新
2. **设置定时器** → 每 30 秒触发一次
3. **后台请求** → 使用当前筛选条件调用 API
4. **更新数据** → 仅更新数据，不触发 loading 状态
5. **更新状态** → 刷新次数 +1，记录时间（仅更新必要状态，避免重渲染）

### 错误处理

- 刷新失败时，在控制台记录错误
- 不影响页面正常显示
- 不中断后续刷新尝试
- 用户可继续手动查询

### 性能优化

- 使用 `useRef` 避免闭包陷阱
- 定时器在组件卸载时自动清理
- 只在必要时更新状态
- 后台静默刷新，无页面闪烁

## 注意事项

1. **网络请求频率**: 每 30 秒一次，请确保后端服务能够承受
2. **数据一致性**: 自动刷新使用与手动查询相同的 API
3. **内存泄漏**: Hook 已正确处理定时器清理
4. **用户体验**: 刷新过程无感知，不影响用户操作

## 未来扩展

### 可配置项

如需调整刷新间隔，可修改：
```typescript
// 在页面组件中
const { ... } = useAutoRefresh({
  refreshInterval: 60000, // 改为 60 秒
  // ...其他参数
})
```

### 扩展功能

- [ ] 支持自定义刷新间隔（用户可配置）
- [ ] 添加刷新间隔选择器（15s/30s/60s）
- [ ] 网络不佳时自动延长间隔
- [ ] 页面可见性检测（后台时暂停刷新）
- [ ] 刷新失败重试机制

## 文件清单

```
src/
├── hooks/
│   └── use-auto-refresh.ts          # 自动刷新 Hook
├── components/
│   └── auto-refresh-toggle.tsx      # 自动刷新开关组件
└── app/(dashboard)/
    ├── dashboard/
    │   └── page.tsx                 # 数据看板页面（已集成）
    └── reports/team/
        └── page.tsx                 # 团队看板页面（已集成）
```

## 测试建议

1. **功能测试**
   - 开启开关，验证是否立即刷新
   - 等待 30 秒，验证是否自动刷新
   - 关闭开关，验证是否停止刷新
   - 修改日期，验证是否使用新日期刷新

2. **状态测试**
   - 验证刷新次数是否正确累加
   - 验证刷新时间是否准确
   - 验证刷新中状态是否显示

3. **边界测试**
   - 页面卸载时定时器是否清理
   - 网络错误时是否影响页面
   - 快速切换开关是否正常工作

4. **性能测试**
   - 长时间开启是否内存泄漏
   - 多次刷新是否影响性能
   - 后端负载是否可承受
