# 自动化补全任务使用说明

## 📋 概述

本系统提供两种补全模式：
1. **单日模式** - 补全指定日期的录音和通话清单数据
2. **批量模式** - 逐日执行补全任务，处理指定日期范围

## 🎯 脚本说明

### 1. auto-backfill-daily.ps1 - 单日补全脚本

**用途**：补全指定日期的录音清单和通话清单数据

**参数**：
- `-Date` (必填)：补全日期，格式：`yyyy-MM-dd`
- `-ApiBaseUrl` (可选)：API 地址，默认：`http://127.0.0.1:5000`
- `-MaxRetries` (可选)：最大重试次数，默认：`5`
- `-RetryDelaySeconds` (可选)：重试延迟（秒），默认：`60`
- `-LogDir` (可选)：日志目录，默认：`data\local-sync\logs`

**使用示例**：

```powershell
# 补全 2026 年 3 月 1 日的数据
.\scripts\auto-backfill-daily.ps1 -Date "2026-03-01"

# 补全 2026 年 3 月 15 日的数据，自定义重试配置
.\scripts\auto-backfill-daily.ps1 -Date "2026-03-15" -MaxRetries 3 -RetryDelaySeconds 30

# 补全 2026 年 3 月 1 日的数据，指定 API 地址
.\scripts\auto-backfill-daily.ps1 -Date "2026-03-01" -ApiBaseUrl "http://192.168.1.100:5000"
```

**输出**：
- 控制台日志（彩色输出）
- 日志文件：`data\local-sync\logs\backfill_yyyy-MM-dd.log`
- 进度报告：`data\local-sync\logs\backfill_yyyy-MM-dd_progress.json`

---

### 2. auto-backfill-batch-daily.ps1 - 批量补全脚本

**用途**：逐日执行补全任务，处理指定日期范围

**配置**（在脚本开头修改）：
- `$StartDate`：开始日期
- `$EndDate`：结束日期
- `$MaxRetries`：最大重试次数
- `$RetryDelaySeconds`：重试延迟
- `$LogDir`：日志目录

**使用示例**：

```powershell
# 执行批量补全任务（使用脚本中的默认配置）
.\scripts\auto-backfill-batch-daily.ps1
```

**修改配置**：
编辑脚本开头的配置部分：
```powershell
$StartDate = "2026-03-01"
$EndDate = "2026-03-18"
$MaxRetries = 5
$RetryDelaySeconds = 60
$LogDir = "data\local-sync\logs"
```

**输出**：
- 控制台日志（彩色输出，实时进度）
- 每日日志文件：`data\local-sync\logs\backfill_yyyy-MM-dd.log`
- 每日进度报告：`data\local-sync\logs\backfill_yyyy-MM-dd_progress.json`
- 批量进度报告：`data\local-sync\logs\batch_progress_yyyyMMdd_HHmmss.json`

---

## 📊 任务特性

### 1. 按日期顺序处理 ✅
- 从开始日期到结束日期，逐日依次处理
- 每日独立执行，互不影响

### 2. 双数据类型补全 ✅
- 每日自动补全录音清单数据
- 每日自动补全通话清单数据
- 录音清单补全成功后才会补全通话清单

### 3. 详细日志记录 ✅
- 成功/失败状态
- 处理数据量（获取数、入库数、失败数）
- 执行耗时
- 重试信息

### 4. 错误重试机制 ✅
- 自动重试失败的 API 调用
- 可配置重试次数和延迟
- 记录每次重试详情

### 5. 进度监控功能 ✅
- 实时显示当前处理日期
- 显示已完成/失败天数
- 显示成功率百分比
- 生成 JSON 进度报告

### 6. 数据完整性保证 ✅
- UUID 去重，避免重复数据
- 幂等性保证，可重复执行
- 事务性操作，确保数据一致性

---

## 🚀 快速开始

### 场景 1：补全单日数据

```powershell
# 补全 2026 年 3 月 1 日的数据
.\scripts\auto-backfill-daily.ps1 -Date "2026-03-01"
```

### 场景 2：补全多天数据

```powershell
# 修改脚本配置
# 编辑 auto-backfill-batch-daily.ps1，设置：
$StartDate = "2026-03-01"
$EndDate = "2026-03-18"

# 执行批量补全
.\scripts\auto-backfill-batch-daily.ps1
```

### 场景 3：补全失败的数据

```powershell
# 查看进度报告，找出失败的日期
# 然后单独补全失败的日期
.\scripts\auto-backfill-daily.ps1 -Date "2026-03-05"
.\scripts\auto-backfill-daily.ps1 -Date "2026-03-10"
```

---

## 📈 监控任务进度

### 实时查看控制台输出

任务执行时，控制台会显示：
- 当前处理的日期
- 数据类型（录音清单/通话清单）
- 重试信息
- 成功/失败状态
- 总体进度

### 查看日志文件

```powershell
# 查看最新日志
Get-Content data\local-sync\logs\backfill_2026-03-01.log -Tail 50

# 查看所有日志文件
Get-ChildItem data\local-sync\logs\*.log | Sort-Object LastWriteTime -Descending
```

### 查看进度报告

```powershell
# 查看单日进度报告
Get-Content data\local-sync\logs\backfill_2026-03-01_progress.json | ConvertFrom-Json

# 查看批量进度报告
Get-ChildItem data\local-sync\logs\batch_progress_*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content
```

---

## 📝 日志格式说明

### 控制台日志

```
[2026-03-22 03:11:22] [INFO] 信息内容
[2026-03-22 03:11:22] [SUCCESS] 成功信息（绿色）
[2026-03-22 03:11:22] [WARN] 警告信息（黄色）
[2026-03-22 03:11:22] [ERROR] 错误信息（红色）
[2026-03-22 03:11:22] [PROGRESS] 进度信息（青色）
```

### 进度报告 JSON

```json
{
  "Date": "2026-03-01",
  "Status": "SUCCESS",
  "TotalFetched": 1500,
  "TotalUpserted": 1500,
  "TotalFailed": 0,
  "ElapsedFormatted": "00:02:35",
  "Recording": {
    "Success": true,
    "Fetched": 100,
    "Upserted": 100,
    "Failed": 0,
    "Elapsed": 120.5
  },
  "CallLog": {
    "Success": true,
    "Fetched": 1400,
    "Upserted": 1400,
    "Failed": 0,
    "Elapsed": 35.2
  }
}
```

---

## 🔧 高级配置

### 调整超时时间

编辑 `auto-backfill-daily.ps1`，修改 `TimeoutSec` 参数：
```powershell
$resp = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 600
```

### 调整重试配置

```powershell
# 增加重试次数
-MaxRetries 10

# 减少重试延迟
-RetryDelaySeconds 30
```

### 自定义日志目录

```powershell
-LogDir "D:\logs\backfill"
```

---

## ⚠️ 故障排查

### 问题 1：操作超时

**现象**：
```
[WARN]   [录音清单] 第 1 次尝试失败：操作超时
```

**解决方案**：
1. 增加超时时间（修改脚本中的 `TimeoutSec`）
2. 增加重试次数
3. 检查 API 服务是否正常

### 问题 2：API 返回错误

**现象**：
```
[ERROR]   [通话清单] 在 5 次尝试后仍失败：API 错误：xxx
```

**解决方案**：
1. 检查 API 服务日志
2. 检查网络连接
3. 检查 API 地址配置

### 问题 3：数据量过大

**现象**：
- 执行时间过长
- 频繁超时

**解决方案**：
1. 分批次执行（每日单独执行）
2. 增加超时时间
3. 优化 API 性能

---

## 📞 使用示例

### 示例 1：执行单日补全

```powershell
# 进入项目目录
cd D:\aiDE\projects\CXCC

# 执行补全
.\scripts\auto-backfill-daily.ps1 -Date "2026-03-01"
```

**预期输出**：
```
======================================================================
自动化补全任务 - 单日模式
======================================================================
任务配置：
  补全日期：2026-03-01
  API 地址：http://127.0.0.1:5000
  最大重试：5
  重试延迟：60 秒
  日志文件：data\local-sync\logs\backfill_2026-03-01.log
======================================================================

开始补全录音清单数据...
  [录音清单] 第 1 次尝试：2026-03-01
  [录音清单] 成功：获取=100, 入库=100, 失败=0, 耗时=120.5 秒

开始补全通话清单数据...
  [通话清单] 第 1 次尝试：2026-03-01
  [通话清单] 成功：获取=1400, 入库=1400, 失败=0, 耗时=35.2 秒

======================================================================
任务完成
======================================================================
执行统计：
  补全日期：2026-03-01
  执行状态：✅ 成功
  总获取数：1500
  总入库数：1500
  总失败数：0
  总耗时：00:02:35
======================================================================
进度报告已保存：data\local-sync\logs\backfill_2026-03-01_progress.json
✅ 任务执行成功！
```

### 示例 2：执行批量补全

```powershell
# 编辑脚本配置
# 修改 auto-backfill-batch-daily.ps1 中的日期范围

# 执行批量补全
.\scripts\auto-backfill-batch-daily.ps1
```

**预期输出**：
```
======================================================================
自动化批量补全任务 - 逐日模式
======================================================================
任务配置：
  日期范围：2026-03-01 ~ 2026-03-18 (共 18 天)
  最大重试：5
  重试延迟：60 秒
  日志目录：data\local-sync\logs
======================================================================

========================================
处理日期：2026-03-01
========================================
...
✅ 日期 2026-03-01 补全成功 | 耗时：155.7 秒
总体进度：[1/18] 5.56% | 已完成：1, 失败：0

========================================
处理日期：2026-03-02
========================================
...
```

---

## 📋 检查清单

执行补全任务前，请确认：

- [ ] API 服务已启动（http://127.0.0.1:5000）
- [ ] 网络连接正常
- [ ] 有足够的磁盘空间
- [ ] PowerShell 执行策略允许运行脚本

检查 PowerShell 执行策略：
```powershell
Get-ExecutionPolicy
```

如果返回 `Restricted`，请执行：
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

---

## 📊 预期性能

根据数据量估算：

| 数据类型 | 数据量 | 预计耗时 |
|---------|--------|----------|
| 录音清单 | ~1,500 条/天 | ~2 分钟/天 |
| 通话清单 | ~29,000 条/天 | ~1 分钟/天 |
| **合计** | **~30,500 条/天** | **~3 分钟/天** |

**18 天数据预计总耗时**：约 54 分钟（约 1 小时）

---

## 🎯 最佳实践

1. **执行前备份**：确保数据库已备份
2. **分批次执行**：大量数据建议分批次执行
3. **监控进度**：实时查看日志和进度报告
4. **失败重试**：对失败日期单独执行补全
5. **验证数据**：补全完成后，通过前端界面验证数据

---

## 📞 获取帮助

查看脚本帮助：
```powershell
Get-Help .\scripts\auto-backfill-daily.ps1 -Full
Get-Help .\scripts\auto-backfill-batch-daily.ps1 -Full
```

---

**最后更新**：2026-03-22  
**版本**：1.0
