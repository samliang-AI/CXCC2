# 录音数据迁移完成报告

## ✅ 迁移成功

**执行时间**: 2026-03-22  
**迁移脚本**: `scripts/migrate-recordings-standalone.js`

---

## 迁移统计

### 数据概览

| 项目 | 数值 |
|------|------|
| **总记录数** | 185,212 条 |
| **创建文件数** | 19 个 |
| **日期范围** | 2026-03-01 至 2026-03-22 |
| **总大小** | 109.57 MB |
| **平均文件大小** | 5.77 MB |

### 按日期分布

| 日期文件 | 记录数 | 占比 |
|---------|--------|------|
| 2026-03-22 | 2,931 | 1.6% |
| 2026-03-21 | 11,350 | 6.1% |
| 2026-03-20 | 18,814 | 10.2% |
| 2026-03-19 | 15,839 | 8.5% |
| 2026-03-18 | 16,031 | 8.7% |
| 2026-03-17 | 16,453 | 8.9% |
| 2026-03-16 | 13,575 | 7.3% |
| 2026-03-13 | 9,303 | 5.0% |
| 2026-03-12 | 11,707 | 6.3% |
| 2026-03-10 | 3,109 | 1.7% |
| 2026-03-09 | 7,166 | 3.9% |
| 2026-03-08 | 6,990 | 3.8% |
| 2026-03-07 | 7,487 | 4.0% |
| 2026-03-06 | 16,159 | 8.7% |
| 2026-03-05 | 5,353 | 2.9% |
| 2026-03-04 | 6,463 | 3.5% |
| 2026-03-03 | 2,594 | 1.4% |
| 2026-03-02 | 7,658 | 4.1% |
| 2026-03-01 | 6,230 | 3.4% |

### 数据分布分析

- **数据量最大的日期**: 2026-03-20 (18,814 条)
- **数据量最小的日期**: 2026-03-03 (2,594 条)
- **平均每日数据量**: 9,748 条
- **有数据的日期数**: 19 天

---

## 文件结构

### 迁移后文件列表

```
data/local-sync/
├── qms_recording_list_2026-03-01.json  (6,230 条)
├── qms_recording_list_2026-03-02.json  (7,658 条)
├── qms_recording_list_2026-03-03.json  (2,594 条)
├── qms_recording_list_2026-03-04.json  (6,463 条)
├── qms_recording_list_2026-03-05.json  (5,353 条)
├── qms_recording_list_2026-03-06.json  (16,159 条)
├── qms_recording_list_2026-03-07.json  (7,487 条)
├── qms_recording_list_2026-03-08.json  (6,990 条)
├── qms_recording_list_2026-03-09.json  (7,166 条)
├── qms_recording_list_2026-03-10.json  (3,109 条)
├── qms_recording_list_2026-03-12.json  (11,707 条)
├── qms_recording_list_2026-03-13.json  (9,303 条)
├── qms_recording_list_2026-03-16.json  (13,575 条)
├── qms_recording_list_2026-03-17.json  (16,453 条)
├── qms_recording_list_2026-03-18.json  (16,031 条)
├── qms_recording_list_2026-03-19.json  (15,839 条)
├── qms_recording_list_2026-03-20.json  (18,814 条)
├── qms_recording_list_2026-03-21.json  (11,350 条)
└── qms_recording_list_2026-03-22.json  (2,931 条)
```

### 备份文件

- **原文件备份**: `qms_recording_list.json.backup.1774163985729`
- **备份位置**: `data/local-sync/`
- **备份时间**: 迁移时自动创建

---

## 性能提升预估

### 迁移前（单文件）

- **文件大小**: ~110 MB
- **记录总数**: 185,212 条
- **读取时间**: 3-5 秒（全量）
- **写入时间**: 5-8 秒（全量）
- **内存占用**: 200-300 MB

### 迁移后（多文件）

- **单个文件大小**: 1-12 MB（平均 5.77 MB）
- **单日记录数**: 2,594 - 18,814 条
- **读取时间**: 0.1-0.3 秒（单日）
- **写入时间**: 0.2-0.5 秒（单日）
- **内存占用**: 5-15 MB

### 性能对比

| 指标 | 迁移前 | 迁移后 | 提升倍数 |
|------|--------|--------|----------|
| **单日查询速度** | 3-5 秒 | 0.1-0.3 秒 | **~25 倍** |
| **单日写入速度** | 5-8 秒 | 0.2-0.5 秒 | **~20 倍** |
| **内存占用** | 200-300 MB | 5-15 MB | **~25 倍** |
| **文件大小** | 110 MB | 1-12 MB | **~10 倍** |

---

## 下一步操作

### 1. 验证数据完整性

```bash
# 查看所有文件
ls data/local-sync/qms_recording_list_*.json

# 验证记录总数
node -e "
const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('data/local-sync').filter(f => f.startsWith('qms_recording_list_') && f.endsWith('.json'));
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync(path.join('data/local-sync', f)));
  total += data.length;
  console.log(f + ': ' + data.length + ' 条');
});
console.log('总计：' + total + ' 条');
"
```

### 2. 更新代码（可选）

如果需要让同步 API 使用优化版本，修改以下文件：

**文件**: `src/app/api/internal/sync/recordings/backfill/route.ts`

```typescript
// 第 4 行，修改导入
import { appendLocalSyncLog, getLocalSyncFiles } from '@/lib/local-recording-store'
import { upsertLocalRecordings } from '@/lib/local-recording-store-optimized'
```

### 3. 测试查询功能

访问数据看板页面，查询不同日期的录音数据，验证：
- ✅ 单日查询正常工作
- ✅ 多日查询正常工作
- ✅ 查询速度明显提升

### 4. 设置自动清理（可选）

创建定时任务，定期清理旧数据：

```javascript
// 清理 90 天前的数据
await cleanupOldRecordings('2025-12-20')
```

---

## 回滚方案

如需回滚到原始状态：

```bash
# 1. 停止服务
# 2. 删除新文件
rm data/local-sync/qms_recording_list_*.json

# 3. 恢复备份
mv data/local-sync/qms_recording_list.json.backup.* data/local-sync/qms_recording_list.json

# 4. 重启服务
pnpm dev:all
```

---

## 注意事项

### ✅ 已完成

- [x] 数据迁移（185,212 条记录）
- [x] 按日期分文件（19 个文件）
- [x] 原文件备份
- [x] 数据完整性验证

### ⚠️ 需要注意

1. **备份文件保留**: 建议保留备份文件至少 7 天
2. **代码切换**: 当前仍使用原始存储逻辑，需要手动切换到优化版本
3. **性能监控**: 观察实际使用中的性能表现
4. **磁盘空间**: 迁移后总大小约 110MB，与原来相当

### 📊 数据缺失说明

以下日期没有数据（可能是节假日或非工作日）：
- 2026-03-11
- 2026-03-14
- 2026-03-15

---

## 迁移日志

```
========================================
  开始迁移录音数据...
========================================

检查旧数据文件...
读取旧数据文件...
找到 185212 条记录
按日期分组数据...
分为 19 个日期文件
写入新文件...
  - qms_recording_list_2026-03-22.json: 现有 0 条，新增 2931 条
    ✓ 写入完成，共 2931 条
  - qms_recording_list_2026-03-21.json: 现有 0 条，新增 11350 条
    ✓ 写入完成，共 11350 条
  ... (19 个文件)
  
备份旧文件到：qms_recording_list.json.backup.1774163985729

✓ 迁移成功！
  - 创建文件数：19
  - 迁移记录数：185212

当前存储状态:
  - 总文件数：19
  - 总记录数：185212
  - 日期范围：2026-03-01 至 2026-03-22
  - 总大小：109.57 MB

========================================
  迁移完成！
========================================
```

---

## 相关文档

- 📖 [详细技术方案](../RECORDING_STORAGE_OPTIMIZATION.md)
- 🔧 [快速实施指南](../IMPLEMENTATION_GUIDE.md)
- 💻 [优化版本代码](../src/lib/local-recording-store-optimized.ts)
- 📝 [迁移脚本](../scripts/migrate-recordings-standalone.js)

---

**迁移完成时间**: 2026-03-22  
**报告生成时间**: 2026-03-22
