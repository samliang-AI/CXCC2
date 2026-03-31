# 录音存储优化 - 快速实施指南

## 快速开始（3 步完成）

### 步骤 1：备份现有数据

```bash
# 复制现有数据文件到安全位置
cp data/local-sync/qms_recording_list.json data/local-sync/qms_recording_list.json.backup
```

### 步骤 2：运行迁移测试

创建一个测试脚本 `scripts/test-migration.ps1`：

```powershell
# 测试迁移功能
$ErrorActionPreference = "Stop"

Write-Host "测试录音存储迁移..." -ForegroundColor Cyan

try {
    # 这里需要调用 Node.js 脚本执行迁移
    # 暂时先检查文件是否存在
    $OldFile = "data\local-sync\qms_recording_list.json"
    
    if (Test-Path $OldFile) {
        $FileSize = (Get-Item $OldFile).Length / 1MB
        Write-Host "发现旧数据文件：$OldFile" -ForegroundColor Green
        Write-Host "文件大小：$([math]::Round($FileSize, 2)) MB" -ForegroundColor Green
        
        Write-Host "`n请运行以下命令执行迁移：" -ForegroundColor Yellow
        Write-Host "node -e "import('@/lib/local-recording-store-optimized').then(m => m.migrateOldRecordingData()).then(r => console.log(r))"" -ForegroundColor White
    } else {
        Write-Host "未发现旧数据文件，可能已经迁移或使用新格式" -ForegroundColor Yellow
    }
} catch {
    Write-Host "错误：$($_.Exception.Message)" -ForegroundColor Red
}
```

### 步骤 3：切换存储引擎

修改同步 API 使用优化版本：

**文件**: `src/app/api/internal/sync/recordings/backfill/route.ts`

```typescript
// 原代码（第 4 行）
import { appendLocalSyncLog, getLocalSyncFiles, upsertLocalRecordings } from '@/lib/local-recording-store'

// 修改为
import { appendLocalSyncLog, getLocalSyncFiles } from '@/lib/local-recording-store'
import { upsertLocalRecordings } from '@/lib/local-recording-store-optimized'
```

## 完整实施清单

### 阶段 1：准备（5 分钟）

- [ ] 备份现有数据文件
- [ ] 检查当前文件大小和记录数
- [ ] 确认优化版本文件已创建

### 阶段 2：迁移（10-30 分钟，取决于数据量）

- [ ] 运行数据迁移脚本
- [ ] 验证迁移结果（文件数量、记录总数）
- [ ] 保留旧文件备份

### 阶段 3：切换（5 分钟）

- [ ] 更新同步 API 导入
- [ ] 更新查询 API 导入（如需要）
- [ ] 重启服务

### 阶段 4：验证（10 分钟）

- [ ] 测试新数据同步到分文件
- [ ] 测试查询功能正常
- [ ] 检查性能提升效果

### 阶段 5：清理（可选）

- [ ] 确认运行正常后删除旧文件备份
- [ ] 设置自动清理策略

## 迁移验证命令

### 检查文件结构

```bash
# 查看所有录音文件
ls data/local-sync/qms_recording_list_*.json

# 查看文件大小
ls -lh data/local-sync/qms_recording_list_*.json
```

### 检查数据完整性

```bash
# 使用 Node.js 快速检查
node -e "
import('@/lib/local-recording-store-optimized').then(m => {
  m.getRecordingStorageStats().then(stats => {
    console.log('文件数:', stats.totalFiles);
    console.log('总记录数:', stats.totalRows);
    console.log('日期范围:', stats.dateRange);
    console.log('总大小:', (stats.fileSize / 1024 / 1024).toFixed(2), 'MB');
  });
});
"
```

## 回滚方案

如果遇到问题，可以快速回滚：

### 回滚步骤

1. **停止服务**
   ```bash
   # 停止 Node.js 服务
   ```

2. **恢复旧文件**
   ```bash
   # 删除新文件
   rm data/local-sync/qms_recording_list_*.json
   
   # 恢复备份
   mv data/local-sync/qms_recording_list.json.backup data/local-sync/qms_recording_list.json
   ```

3. **恢复代码**
   ```typescript
   // 改回原来的导入
   import { upsertLocalRecordings } from '@/lib/local-recording-store'
   ```

4. **重启服务**
   ```bash
   pnpm dev:all
   ```

## 性能监控

### 对比指标

在迁移前后分别测试：

1. **同步性能**
   - 同步 1000 条录音的时间
   - CPU 和内存占用

2. **查询性能**
   - 查询单日数据的时间
   - 查询 7 天数据的时间
   - 查询整月数据的时间

3. **资源占用**
   - 内存峰值
   - 磁盘 IO

### 预期结果

- 单日查询：从 3-5 秒 → 0.1-0.2 秒（**提升 25 倍**）
- 内存占用：从 200-300MB → 5-10MB（**提升 30 倍**）
- 写入速度：从 5-8 秒 → 0.2-0.3 秒（**提升 20 倍**）

## 常见问题

### Q1: 迁移需要多长时间？

**A**: 取决于数据量：
- 10 万条记录：约 1-2 分钟
- 50 万条记录：约 5-10 分钟
- 100 万条记录：约 10-20 分钟

### Q2: 迁移过程中会影响服务吗？

**A**: 会短暂影响。建议在低峰期执行：
1. 停止同步任务
2. 执行迁移（10-20 分钟）
3. 切换代码
4. 重启服务

### Q3: 如果迁移失败怎么办？

**A**: 
- 有完整的备份，可以随时回滚
- 迁移是只读操作，不会破坏原数据
- 失败时原文件保持不变

### Q4: 需要修改多少代码？

**A**: 最少只需修改 1 行代码：
```typescript
// 改一个导入路径
import { upsertLocalRecordings } from '@/lib/local-recording-store-optimized'
```

### Q5: 查询性能真的会提升吗？

**A**: 是的，特别是：
- 查询单日数据：提升 20-50 倍
- 查询近期数据（7 天内）：提升 3-7 倍
- 查询整月数据：提升 1-2 倍

## 自动化脚本（可选）

创建自动化迁移脚本 `scripts/migrate-recordings.js`：

```javascript
#!/usr/bin/env node

import { migrateOldRecordingData, getRecordingStorageStats } from '../src/lib/local-recording-store-optimized.js'

async function main() {
  console.log('开始迁移录音数据...\n')
  
  // 执行迁移
  const result = await migrateOldRecordingData()
  
  if (result.migrated) {
    console.log('✓ 迁移成功！')
    console.log(`  - 创建文件数：${result.fileCount}`)
    console.log(`  - 迁移记录数：${result.totalRows}`)
    
    // 显示统计信息
    const stats = await getRecordingStorageStats()
    console.log('\n当前存储状态:')
    console.log(`  - 总文件数：${stats.totalFiles}`)
    console.log(`  - 总记录数：${stats.totalRows}`)
    console.log(`  - 日期范围：${stats.dateRange.earliest} 至 ${stats.dateRange.latest}`)
    console.log(`  - 总大小：${(stats.fileSize / 1024 / 1024).toFixed(2)} MB`)
  } else {
    console.log('无需迁移或迁移失败')
  }
}

main().catch(console.error)
```

运行迁移：

```bash
node scripts/migrate-recordings.js
```

## 下一步

迁移完成后：

1. **监控运行**：观察 1-2 天，确认一切正常
2. **设置清理策略**：定期清理旧数据
3. **性能调优**：根据实际情况调整参数
4. **文档更新**：更新团队文档和运维手册

## 相关文档

- 详细方案：`RECORDING_STORAGE_OPTIMIZATION.md`
- 优化版本：`src/lib/local-recording-store-optimized.ts`
- 原始版本：`src/lib/local-recording-store.ts`
