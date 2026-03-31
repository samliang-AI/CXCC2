# 🚀 外呼数据分析系统 - 快速上手指南

## 📋 目录

1. [快速开始](#快速开始)
2. [功能概览](#功能概览)
3. [使用教程](#使用教程)
4. [常见问题](#常见问题)

---

## 🎯 快速开始

### 方法一：一键启动 (推荐新手)

**Windows 用户**:
```bash
# 双击运行
start.bat
```

**或命令行运行**:
```bash
cmd /c start.bat
```

### 方法二：手动启动 (推荐开发者)

#### Step 1: 启动后端
```bash
cd python-backend
pip install -r requirements.txt
python main.py
```
✅ 后端启动成功，访问 http://localhost:8000/docs

#### Step 2: 启动前端
```bash
# 打开新终端
pnpm dev
```
✅ 前端启动成功，访问 http://localhost:5000

---

## 📊 功能概览

### 核心功能

#### 1. 数据上传 📤
- 支持 Excel (.xlsx, .xls) 和 CSV 文件
- 自动解析和预览
- 支持重新上传 (自动覆盖)
- 最大支持 50MB 文件

#### 2. 一键分析 📈
- 智能 KPI 计算
- 客户价值分层
- 消费行为分析
- 需求信号识别
- 数据质量评估

#### 3. 机器学习预测 🤖
- 客户意向预测 (高/中/低)
- 转化率预估
- 智能推荐建议
- 置信度评分

#### 4. 图表可视化 📊
- ECharts 专业图表
- 5 种图表类型
- 交互式体验
- 响应式设计

#### 5. 实时数据 🔄
- WebSocket 推送
- 5 秒自动更新
- 实时警报通知
- 自动重连

#### 6. 自定义报表 📄
- 灵活选择指标
- 多维度分析
- 日期范围筛选
- 多格式导出

---

## 📖 使用教程

### 教程 1: 上传数据并分析

#### Step 1: 访问数据上传
1. 登录系统 (http://localhost:5000)
2. 点击左侧菜单 **数据来源**
3. 选择 **数据上传** 子菜单

#### Step 2: 上传 Excel 文件
1. 在 **数据名称** 输入框输入名称 (如：3 月销售数据)
2. 点击 **选择文件** 按钮
3. 选择 Excel 文件
4. 点击 **上传** 按钮
5. 等待上传完成提示

**Excel 文件格式要求**:
- 第一行为列名
- 推荐包含列：客户姓名、手机号、月均消费、月均流量、月均语音、套餐类型等
- 参考文件：`铁通升档 20260312(脱敏).xlsx`

#### Step 3: 执行数据分析
1. 点击左侧菜单 **数据分析**
2. 在下拉框选择刚上传的数据源
3. 点击 **一键分析** 按钮
4. 等待 3 秒分析完成

#### Step 4: 查看分析结果

**总览标签页**:
- 📊 KPI 指标卡片 (总记录数、数据质量、月均消费、升档潜力)
- 🏆 客户价值分层金字塔
- 🎯 推荐方案分布
- 💡 数据洞察建议

**消费行为标签页**:
- 📈 套餐价格分布图
- 💰 消费行为指标 (月均消费、流量、语音、套餐利用率)

**需求信号标签页**:
- ⚠️ 超套客户分析 (流量超套、语音超套)
- 🎯 升档潜力分层 (高/中/低意向)

**数据质量标签页**:
- ✅ 数据完整性评分
- 📋 缺失字段分析

### 教程 2: 使用机器学习预测

#### 预测客户意向

**方法一：通过 API 测试**
```bash
cd python-backend
python test_api.py
```

**方法二：通过前端页面**
1. 访问数据分析页面
2. 选择数据源
3. 点击一键分析
4. 系统自动对所有客户进行意向预测

**预测结果说明**:
- **意向分数**: 0-1 之间，越高表示意向越强
  - > 0.7: 高意向客户
  - 0.5-0.7: 中意向客户
  - < 0.5: 低意向客户
- **置信度**: 模型对预测的把握程度
- **推荐建议**: 基于预测结果的营销策略

#### 训练自定义模型

```bash
# 调用训练 API
curl -X POST http://localhost:8000/api/train-model?model_type=intent

# 或使用 Python
import requests
response = requests.post("http://localhost:8000/api/train-model?model_type=intent")
print(response.json())
```

### 教程 3: 创建自定义报表

#### Step 1: 访问自定义报表页面
1. 点击左侧菜单 **数据来源**
2. 选择 **自定义报表** 子菜单

#### Step 2: 配置报表
1. **选择指标** (至少选 1 个):
   - ☑️ 月均消费
   - ☑️ 月均流量
   - ☑️ 月均语音
   - ☑️ 总记录数
   - ☑️ 升档率
   - ☑️ 数据质量
   - ☑️ 流量超套
   - ☑️ 语音超套

2. **选择维度** (至少选 1 个):
   - ☑️ 套餐类型
   - ☑️ 日期
   - ☑️ 地区
   - ☑️ 客户分层
   - ☑️ 渠道

3. **设置日期范围** (可选):
   - 开始日期：2026-03-01
   - 结束日期：2026-03-31

#### Step 3: 生成和预览
1. 点击 **生成报表** 按钮
2. 切换到 **报表预览** 标签页
3. 查看生成的报表数据

#### Step 4: 导出报表
1. 切换到 **导出报表** 标签页
2. 选择导出格式:
   - 📊 Excel (.xlsx) - 推荐
   - 📄 PDF (.pdf)
   - 📋 CSV (.csv)
3. 点击下载按钮

### 教程 4: 实时数据监控

#### 启用实时监控

```typescript
// 在前端代码中
import { RealtimeDataService } from '@/lib/api'

// 创建实时服务
const realtimeService = new RealtimeDataService('client-001')
  .connect()
  .onMessage((data) => {
    // 处理实时数据
    console.log('KPI 更新:', data.data.kpis)
    console.log('警报:', data.data.alerts)
    
    // 更新 UI
    setKpis(data.data.kpis)
    setAlerts(data.data.alerts)
  })

// 组件卸载时清理
useEffect(() => {
  return () => realtimeService.disconnect()
}, [])
```

#### 实时数据内容
- **KPI 更新**: 月均消费、流量、语音等指标
- **警报通知**: 新增客户数据、高价值客户发现
- **趋势变化**: 消费趋势、流量趋势、语音趋势

---

## ❓ 常见问题

### Q1: 启动失败 - 端口被占用

**错误信息**: `EADDRINUSE: address already in use :::8000`

**解决方案**:
```bash
# Windows - 查找并终止进程
netstat -ano | findstr :8000
taskkill /F /PID [进程 ID]

# Linux/Mac
lsof -i :8000
kill -9 [进程 ID]
```

### Q2: Python 依赖安装失败

**错误信息**: `No module named 'pandas'`

**解决方案**:
```bash
# 确保在正确的目录
cd python-backend

# 重新安装依赖
pip install -r requirements.txt

# 如果仍然失败，尝试逐个安装
pip install fastapi uvicorn pandas scikit-learn
```

### Q3: 前端无法连接后端

**错误信息**: `Failed to fetch`

**解决方案**:
1. 检查后端是否启动 (访问 http://localhost:8000/api/health)
2. 检查 `.env.local` 配置:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
3. 检查浏览器控制台是否有 CORS 错误

### Q4: Excel 文件上传失败

**错误信息**: `不支持的文件类型`

**解决方案**:
1. 确保文件扩展名为 `.xlsx`、`.xls` 或 `.csv`
2. 检查文件大小不超过 50MB
3. 确保 Excel 文件没有损坏

### Q5: 分析结果为空或错误

**可能原因**:
1. Excel 文件格式不正确
2. 缺少必要的列
3. 数据质量问题

**解决方案**:
1. 参考示例文件 `铁通升档 20260312(脱敏).xlsx`
2. 确保包含基本列：客户姓名、消费数据等
3. 检查数据完整性

### Q6: 机器学习预测不准确

**说明**: 初始使用规则引擎，准确率为基准水平

**提升方法**:
```bash
# 使用真实数据训练模型
curl -X POST http://localhost:8000/api/train-model?model_type=intent
```

**建议**:
- 收集更多历史数据
- 标注客户实际意向 (成交/未成交)
- 定期重新训练模型

### Q7: WebSocket 连接断开

**现象**: 实时数据不更新

**解决方案**:
1. 系统已实现自动重连 (5 秒后)
2. 检查网络连接
3. 检查后端 WebSocket 服务是否正常
4. 查看浏览器控制台错误信息

### Q8: 图表不显示

**可能原因**:
1. ECharts 库未正确加载
2. 数据格式不正确
3. 容器尺寸为 0

**解决方案**:
1. 检查浏览器控制台错误
2. 确认 `pnpm install echarts` 已执行
3. 检查父容器是否有固定高度

---

## 🔧 高级技巧

### 技巧 1: 批量预测客户

```python
import requests
import pandas as pd

# 读取客户数据
df = pd.read_excel('customer_data.xlsx')

# 批量预测
results = []
for _, row in df.iterrows():
    customer_data = row.to_dict()
    response = requests.post(
        'http://localhost:8000/api/predict',
        json={'customer_data': customer_data, 'model_type': 'intent'}
    )
    results.append(response.json())

# 保存结果
results_df = pd.DataFrame(results)
results_df.to_excel('prediction_results.xlsx', index=False)
```

### 技巧 2: 定时数据分析

```python
import schedule
import time

def daily_analysis():
    """每日自动分析"""
    requests.post('http://localhost:8000/api/analyze', json={
        'data_source_id': 'latest_data',
        'analysis_type': 'quick'
    })
    print("每日分析完成")

# 每天早上 9 点执行
schedule.every().day.at("09:00").do(daily_analysis)

while True:
    schedule.run_pending()
    time.sleep(60)
```

### 技巧 3: 导出所有客户预测

```bash
# 使用 Python 脚本批量导出
python export_predictions.py
```

---

## 📞 技术支持

### 获取帮助

1. **API 文档**: http://localhost:8000/docs
2. **实现指南**: `IMPLEMENTATION_GUIDE.md`
3. **功能总结**: `FEATURES_SUMMARY.md`
4. **测试脚本**: `python-backend/test_api.py`

### 调试技巧

**后端调试**:
```bash
# 启用调试模式
export DEBUG=True
python main.py

# 查看详细日志
tail -f logs/app.log
```

**前端调试**:
```bash
# 开发模式 (带详细日志)
pnpm dev

# 浏览器开发者工具
# F12 -> Console -> 查看错误
```

---

## 🎉 开始使用

现在您已经掌握了所有必要知识，开始使用吧！

```bash
# 快速启动
start.bat

# 访问系统
http://localhost:5000
```

**祝您使用愉快!** 🚀
