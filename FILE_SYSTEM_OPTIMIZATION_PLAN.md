# 文件系统优化方案

## 一、优化目标

1. 保留所有核心运行文件，确保系统正常运行
2. 清理冗余、过时、无效文件，减少项目体积
3. 优化文件组织结构，提升可维护性
4. 补充缺失的关键文档

## 二、文件分类标准

### A. 核心运行文件（必须保留）
- **Next.js 配置文件**: next.config.ts, tsconfig.json, package.json 等
- **源代码文件**: src/ 目录下所有 .ts, .tsx 文件
- **Python 后端**: python-backend/*.py, requirements.txt
- **UI 组件**: src/components/ui/ 下的所有组件
- **API 路由**: src/app/api/ 下的所有路由文件
- **页面文件**: src/app/(dashboard)/**/page.tsx

### B. 数据文件（必须保留）
- **本地同步数据**: data/local-sync/qms_*.json
- **日期分文件**: data/local-sync/qms_*_YYYY-MM-DD.json
- **汇总文件**: data/local-sync/qms_*_daily_summary.json

### C. 脚本文件（选择性保留）
- **生产脚本**: build.sh, start.sh, dev.sh
- **数据迁移**: migrate-*.js
- **日常同步**: sync-today-data.js

### D. 文档文件（选择性保留）
- **核心文档**: README.md, QUICK_START.md, IMPLEMENTATION_GUIDE.md
- **功能文档**: 保留重要的功能说明文档
- **临时文档**: 清理临时修复记录文档

### E. 可清理文件
- **备份文件**: *.backup.*
- **临时测试文件**: test-*.ps1, test-*.js（除关键测试外）
- **重复脚本**: 多个版本的 auto-backfill 脚本
- **过时文档**: 临时修复记录、已过时的功能文档
- **Python 缓存**: __pycache__/, *.pyc
- **上传测试文件**: python-backend/uploads/*.xlsx

## 三、优化执行清单

### 1. 清理脚本目录（scripts/）
**保留：**
- build.sh, dev.sh, start.sh（生产脚本）
- sync-today-data.js（日常同步）
- migrate-recordings-standalone.js, migrate-call-logs-standalone.js（迁移工具）
- AUTO_BACKFILL_README.md（说明文档）

**清理：**
- auto-backfill-*.ps1（多个重复版本，保留 1 个）
- test-*.ps1, test-*.js（临时测试）
- backfill-*.ps1（已完成的补全任务）
- monitor-progress.ps1, register-backfill-task.ps1（临时工具）
- generated/ 目录

### 2. 清理文档目录（根目录）
**保留：**
- README.md（主文档）
- QUICK_START.md（快速开始）
- IMPLEMENTATION_GUIDE.md（实现指南）
- FEATURES_SUMMARY.md（功能总结）
- DATA_PERSISTENCE_GUIDE.md（数据持久化指南）
- RECORDING_STORAGE_OPTIMIZATION.md（存储优化）
- DATE_SYNC_OPTIMIZATION_REPORT.md（日期同步优化）
- AUTO_REFRESH_FEATURE.md（自动刷新功能）
- PYTHON_BACKEND_INTEGRATION.md（Python 后端集成）

**清理：**
- *_FIX.md（临时修复文档）
- *_TEST.md（测试文档）
- *_DETAILS.md（细节文档）
- 外呼数据分析系统设计方案.md（已过时）

### 3. 清理数据目录（data/local-sync/）
**保留：**
- qms_agent_list.json
- qms_team_list.json
- qms_call_log_daily_summary.json
- qms_recording_daily_summary.json
- qms_sync_log.json
- qms_call_log_list_YYYY-MM-DD.json（所有日期文件）
- qms_recording_list_YYYY-MM-DD.json（所有日期文件）

**清理：**
- qms_call_log_list.json（旧格式，已迁移）
- qms_recording_list.json（旧格式，已迁移）
- *.backup.*（备份文件）

### 4. 清理 Python 后端（python-backend/）
**保留：**
- *.py（源代码）
- requirements.txt
- .env.example
- README.md, README_START.md
- INSTALL_PYTHON_FIRST.md, SETUP_PYTHON.md

**清理：**
- __pycache__/（Python 缓存）
- uploads/*.xlsx（测试上传文件）
- test_api.py（临时测试）

### 5. 清理临时文件
**清理：**
- assets/*.png（临时图片）
- test-data.xlsx, test_upload.html（测试文件）
- *.pdf（API 文档 PDF）

## 四、优化后预期效果

1. **减少文件数量**: 预计减少 40-50 个冗余文件
2. **减少项目体积**: 预计减少 50-100MB（主要是数据备份和缓存）
3. **提升可维护性**: 文件结构更清晰，文档更有条理
4. **保持功能完整**: 所有核心功能正常运行

## 五、执行步骤

1. 创建备份目录（可选）
2. 执行文件清理
3. 验证系统功能
4. 更新文档索引
5. 生成优化报告
