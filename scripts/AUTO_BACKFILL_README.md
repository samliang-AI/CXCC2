# 自动化补全任务使用说明

## 📋 概述

本套脚本用于自动化补全指定日期范围内的录音清单和通话清单数据。

### 核心脚本

1. **auto-backfill-range.ps1** - 主补全脚本
2. **monitor-progress.ps1** - 进度监控脚本

---

## ✨ 功能特性

### 1. 按日期顺序处理
- ✅ 从开始日期到结束日期逐日处理
- ✅ 严格按时间顺序执行
- ✅ 支持跳过已有数据（可选）

### 2. 双数据类型补全
- ✅ 录音清单数据
- ✅ 通话清单数据
- ✅ 每日同时补完两种数据

### 3. 详细日志记录
- ✅ 彩色日志输出（INFO/WARN/ERROR/SUCCESS/PROGRESS）
- ✅ 记录成功/失败状态
- ✅ 记录处理数据量
- ✅ 记录耗时信息
- ✅ 自动生成进度 JSON 文件

### 4. 错误重试机制
- ✅ 可配置最大重试次数（默认 3 次）
- ✅ 可配置重试延迟（默认 30 秒）
- ✅ 自动重试失败的日期

### 5. 实时进度监控
- ✅ 显示总体进度百分比
- ✅ 显示已完成/失败天数
- ✅ 显示累计数据量
- ✅ 生成进度 JSON 文件供外部读取

### 6. 数据完整性保证
- ✅ 基于 UUID 自动去重
- ✅ 幂等性保证（重复执行安全）
- ✅ 检查数据完整性
- ✅ 避免重复数据

---

## 🚀 快速开始

### 1. 执行补全任务（3 月 1 日 ~ 3 月 18 日）

```powershell
# 基本用法
.\scripts\auto-backfill-range.ps1 -StartDate "2026-03-01" -EndDate "2026-03-18"

# 带自定义参数
.\scripts\auto-backfill-range.ps1 `
  -StartDate "2026-03-01" `
  -EndDate "2026-03-18" `
  -MaxRetries 5 `
  -RetryDelaySeconds 60 `
  -SkipExisting
```

### 2. 实时监控进度

```powershell
# 自动查找最新的进度文件
.\scripts\monitor-progress.ps1

# 指定进度文件
.\scripts\monitor-progress.ps1 -ProgressFile "data\local-sync\auto_backfill_20260301_20260318_progress.json"
```

---

## 📝 参数说明

### auto-backfill-range.ps1 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `-StartDate` | string | ✅ | 无 | 开始日期（格式：yyyy-MM-dd） |
| `-EndDate` | string | ✅ | 无 | 结束日期（格式：yyyy-MM-dd） |
| `-ApiBaseUrl` | string | ❌ | http://127.0.0.1:5000 | API 基础 URL |
| `-SyncToken` | string | ❌ | 空 | 同步 Token（如有需要） |
| `-LogPath` | string | ❌ | 自动生成 | 日志文件路径 |
| `-MaxRetries` | int | ❌ | 3 | 最大重试次数 |
| `-RetryDelaySeconds` | int | ❌ | 30 | 重试延迟（秒） |
| `-SkipExisting` | switch | ❌ | false | 跳过已有数据的日期 |

### monitor-progress.ps1 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `-ProgressFile` | string | ❌ | 自动查找 | 进度 JSON 文件路径 |

---

## 📊 输出文件

### 1. 日志文件

**位置**: `data/local-sync/auto_backfill_<timestamp>.log`

**格式**:
```
[2026-03-22 10:00:00] [INFO] ========================================
[2026-03-22 10:00:00] [INFO] 自动化补全任务启动
[2026-03-22 10:00:00] [INFO] ========================================
[2026-03-22 10:00:00] [INFO] 任务配置:
[2026-03-22 10:00:00] [INFO]   日期范围: 2026-03-01 ~ 2026-03-18 (共 18 天)
[2026-03-22 10:00:01] [INFO] 开始处理日期: 2026-03-01
[2026-03-22 10:00:05] [INFO]   开始补完录音清单...
[2026-03-22 10:00:10] [SUCCESS]   [录音清单] 成功: fetched=1500, upserted=1500, failed=0, 耗时=5.2s
...
```

### 2. 进度 JSON 文件

**位置**: `data/local-sync/auto_backfill_<timestamp>_progress.json`

**格式**:
```json
{
  "2026-03-01": {
    "Status": "SUCCESS",
    "RecordingFetched": 1500,
    "RecordingUpserted": 1500,
    "CallLogFetched": 29572,
    "CallLogUpserted": 29572,
    "Elapsed": 125.5
  },
  "2026-03-02": {
    "Status": "FAILED",
    "Reason": "通话清单补完失败",
    "Recording": {
      "Success": true,
      "Fetched": 1200,
      "Upserted": 1200,
      "Failed": 0,
      "Elapsed": 4.8
    },
    "CallLog": {
      "Success": false,
      "Error": "请求超时"
    }
  }
}
```

---

## 🎯 使用场景

### 场景 1：首次补全（全量）

```powershell
# 补全 3 月 1 日到 3 月 18 日
.\scripts\auto-backfill-range.ps1 `
  -StartDate "2026-03-01" `
  -EndDate "2026-03-18"
```

### 场景 2：补全失败日期

```powershell
# 补全 3 月 5 日到 3 月 7 日（已知这些日期失败）
.\scripts\auto-backfill-range.ps1 `
  -StartDate "2026-03-05" `
  -EndDate "2026-03-07" `
  -MaxRetries 5
```

### 场景 3：跳过已有数据

```powershell
# 补全时跳过已有数据的日期
.\scripts\auto-backfill-range.ps1 `
  -StartDate "2026-03-01" `
  -EndDate "2026-03-18" `
  -SkipExisting
```

### 场景 4：后台执行 + 实时监控

**终端 1 - 执行补全**:
```powershell
.\scripts\auto-backfill-range.ps1 -StartDate "2026-03-01" -EndDate "2026-03-18"
```

**终端 2 - 实时监控**:
```powershell
# 每隔 30 秒刷新一次
while ($true) {
  Clear-Host
  .\scripts\monitor-progress.ps1
  Start-Sleep -Seconds 30
}
```

---

## 🔍 监控界面示例

### 进度输出

```
========================================
   自动化补全任务 - 实时进度监控
========================================

【总体进度】
  总天数: 18 天
  已完成: 12 天 (66.67%)
  失败: 1 天 (5.56%)
  成功率: 66.67%

【数据统计】
  总获取: 354,890 条
  成功入库: 354,062 条
  失败记录: 828 条
  数据成功率: 99.77%

【详细进度】
  2026-03-01 | ✅ 成功
    录音: 1500/1500 | 通话: 29572/29572 | 耗时: 125.5s
  2026-03-02 | ✅ 成功
    录音: 1200/1200 | 通话: 28444/28444 | 耗时: 118.2s
  2026-03-03 | ❌ 失败
    原因: 通话清单补完失败
  2026-03-04 | ✅ 成功
    录音: 1800/1800 | 通话: 31256/31256 | 耗时: 132.8s
  ...
========================================
```

---

## ⚠️ 错误处理

### 常见错误

#### 1. 网络超时
```
[ERROR] [通话清单] 重试 3 次后仍然失败: 请求超时
```
**解决方案**: 增加 `-RetryDelaySeconds` 参数

#### 2. API 返回错误
```
[ERROR] [录音清单] API 返回错误: BACKFILL_FAILED
```
**解决方案**: 检查后端服务是否正常运行

#### 3. 日期格式错误
```
错误: StartDate/EndDate 必须是 yyyy-MM-dd 格式
```
**解决方案**: 使用正确的日期格式，如 `2026-03-01`

---

## 🔧 高级用法

### 1. 创建定时任务

```powershell
# 每天凌晨 2 点执行前一天的数据补全
$action = New-ScheduledTaskAction `
  -Execute "PowerShell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PWD\scripts\auto-backfill-range.ps1`" -StartDate `"$((Get-Date).AddDays(-1).ToString('yyyy-MM-dd'))`" -EndDate `"$((Get-Date).AddDays(-1).ToString('yyyy-MM-dd'))`"

Register-ScheduledTask `
  -TaskName "AutoBackfillDaily" `
  -Trigger (New-ScheduledTaskTrigger -Daily -At 2am) `
  -Action $action `
  -RunLevel Highest
```

### 2. 批量处理多个日期范围

```powershell
# 处理 3 月、4 月、5 月
$months = @(
  @{ Start = "2026-03-01"; End = "2026-03-31" },
  @{ Start = "2026-04-01"; End = "2026-04-30" },
  @{ Start = "2026-05-01"; End = "2026-05-31" }
)

foreach ($month in $months) {
  Write-Host "处理: $($month.Start) ~ $($month.End)"
  .\scripts\auto-backfill-range.ps1 `
    -StartDate $month.Start `
    -EndDate $month.End `
    -SkipExisting
}
```

---

## 📊 性能优化建议

### 1. 分时段执行
```powershell
# 将大范围拆分为小范围，减少单次执行时间
.\scripts\auto-backfill-range.ps1 -StartDate "2026-03-01" -EndDate "2026-03-05"
.\scripts\auto-backfill-range.ps1 -StartDate "2026-03-06" -EndDate "2026-03-10"
.\scripts\auto-backfill-range.ps1 -StartDate "2026-03-11" -EndDate "2026-03-15"
.\scripts\auto-backfill-range.ps1 -StartDate "2026-03-16" -EndDate "2026-03-18"
```

### 2. 调整重试参数
```powershell
# 网络不稳定时增加重试次数和延迟
.\scripts\auto-backfill-range.ps1 `
  -StartDate "2026-03-01" `
  -EndDate "2026-03-18" `
  -MaxRetries 5 `
  -RetryDelaySeconds 60
```

---

## 🎉 预期结果

### 执行时间估算

假设每天平均处理时间：2 分钟

| 天数 | 预计时间 | 说明 |
|------|----------|------|
| 1 天 | ~2 分钟 | 单日测试 |
| 7 天 | ~14 分钟 | 一周数据 |
| 18 天 | ~36 分钟 | 3 月 1-18 日 |

### 数据量估算

假设每天平均：
- 录音清单：1,500 条
- 通话清单：29,000 条

| 天数 | 录音清单 | 通话清单 | 总计 |
|------|----------|----------|------|
| 1 天 | 1,500 | 29,000 | 30,500 |
| 18 天 | 27,000 | 522,000 | 549,000 |

---

## 📞 故障排查

### 问题 1：脚本无法执行

```powershell
# 检查执行策略
Get-ExecutionPolicy

# 如受限，临时允许执行
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 问题 2：API 连接失败

```powershell
# 测试 API 连接
Test-NetConnection -ComputerName 127.0.0.1 -Port 5000

# 检查服务状态
curl http://127.0.0.1:5000/api/health
```

### 问题 3：进度文件未生成

```powershell
# 检查日志目录
Test-Path "data\local-sync"

# 手动创建目录
New-Item -ItemType Directory -Path "data\local-sync" -Force
```

---

## 📞 支持与反馈

如遇到问题，请提供：
1. 错误日志文件
2. 进度 JSON 文件
3. 执行参数
4. 系统环境信息

---

**文档版本**: 1.0.0  
**更新日期**: 2026-03-22  
**适用版本**: PowerShell 5.1+
