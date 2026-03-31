# Python 后端启动指南

## 🚀 快速启动方法

### 方法 1: 双击启动脚本 (推荐)

1. 打开文件资源管理器
2. 导航到 `d:\aiDE\projects\CXCC\python-backend`
3. **双击** `start.bat` 文件
4. 等待服务启动
5. 访问 http://localhost:8000/docs 查看 API 文档

---

### 方法 2: 命令行启动

#### 步骤 1: 打开命令提示符或 PowerShell

按 `Win + R`,输入 `cmd` 或 `powershell`,回车

#### 步骤 2: 进入后端目录
```bash
cd d:\aiDE\projects\CXCC\python-backend
```

#### 步骤 3: 安装依赖 (首次启动)
```bash
pip install -r requirements.txt
```

**需要的依赖**:
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pandas==2.1.4
openpyxl==3.1.2
scikit-learn==1.3.2
numpy==1.26.3
python-multipart==0.0.6
pydantic==2.5.3
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
aiofiles==23.2.1
joblib==1.3.2
```

#### 步骤 4: 启动服务
```bash
# 使用 uvicorn 启动
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 或者使用 python
python main.py
```

---

## ✅ 验证服务启动成功

### 1. 查看启动日志

**成功日志**:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 2. 访问健康检查接口

浏览器访问：http://localhost:8000/api/health

**正常响应**:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-15T16:30:00.000000",
  "services": {
    "database": "connected",
    "ml_models": "loaded",
    "cache": "active"
  }
}
```

### 3. 访问 API 文档

浏览器访问：http://localhost:8000/docs

**显示内容**:
- FastAPI 交互式 API 文档
- 所有可用 API 端点
- 可在线测试的接口

---

## 🔍 常见问题解决

### 问题 1: `python` 命令找不到

**错误信息**:
```
'python' 不是内部或外部命令
```

**解决方案**:

#### 方案 A: 使用完整路径
```bash
C:\Python39\python.exe main.py
```

#### 方案 B: 添加到 PATH
1. 找到 Python 安装路径 (如 `C:\Python39`)
2. 右键"此电脑" → "属性" → "高级系统设置"
3. "环境变量" → "Path" → "编辑"
4. 添加 Python 路径
5. 重启命令行

#### 方案 C: 使用 Windows 应用商店
```bash
# Windows 10/11
winget install Python.Python.3.9
```

---

### 问题 2: 缺少依赖

**错误信息**:
```
ModuleNotFoundError: No module named 'fastapi'
```

**解决方案**:
```bash
pip install -r requirements.txt
```

**如果安装失败**,逐个安装:
```bash
pip install fastapi
pip install uvicorn
pip install pandas
pip install numpy
pip install scikit-learn
pip install openpyxl
pip install python-multipart
pip install pydantic
pip install joblib
```

---

### 问题 3: 端口 8000 被占用

**错误信息**:
```
OSError: [Errno 98] Address already in use
```

**解决方案**:

#### 方案 A: 使用其他端口
```bash
uvicorn main:app --reload --port 8001
```

#### 方案 B: 查找并关闭占用进程
```bash
# 查找占用 8000 端口的进程
netstat -ano | findstr :8000

# 杀死进程 (替换 PID)
taskkill /PID <PID> /F
```

---

### 问题 4: 权限问题

**错误信息**:
```
PermissionError: [Errno 13] Permission denied
```

**解决方案**:
- 以**管理员身份**运行命令行
- 或者将项目移动到有写入权限的目录

---

## 📊 服务信息

### API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/` | GET | API 根路径 |
| `/api/health` | GET | 健康检查 |
| `/api/upload` | POST | 上传数据文件 |
| `/api/analyze` | POST | 执行数据分析 |
| `/api/predict` | POST | 机器学习预测 |
| `/api/train-model` | POST | 训练模型 |
| `/api/data-sources` | GET | 获取数据源列表 |
| `/ws/realtime/{client_id}` | WebSocket | 实时数据推送 |

### 默认配置

- **主机**: 0.0.0.0 (所有网络接口)
- **端口**: 8000
- **调试模式**: 启用 (自动重载)
- **CORS**: 允许 localhost:5000, localhost:3000

---

## 🔧 配置选项

### 环境变量

创建 `.env` 文件在 `python-backend` 目录:

```env
# API 配置
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# 数据库配置 (如果有)
DATABASE_URL=sqlite:///./data.db

# 模型配置
MODEL_PATH=./models
```

### 修改端口

编辑 `main.py` 或使用命令行参数:
```bash
uvicorn main:app --reload --port 8001
```

然后更新前端配置:
```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

---

##  完整启动流程

### 1. 启动 Python 后端

**终端 1**:
```bash
cd d:\aiDE\projects\CXCC\python-backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**预期输出**:
```
INFO:     Will watch for changes in these files:
INFO:     Watching for changes in: 'd:\aiDE\projects\CXCC\python-backend'
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 2. 验证后端

浏览器访问：
- http://localhost:8000/api/health ✅
- http://localhost:8000/docs ✅

### 3. 启动前端

**终端 2**:
```bash
cd d:\aiDE\projects\CXCC
npm run dev
```

### 4. 验证前端

浏览器访问：
- http://localhost:5000/data-sources/upload ✅
- http://localhost:5000/data-sources/analysis ✅

### 5. 测试"一键分析"

1. 上传 Excel 文件
2. 访问分析页面
3. 选择数据源
4. 点击"一键分析"
5. ✅ 调用 Python 后端 API
6. ✅ 显示真实计算结果

---

## 🎯 启动检查清单

启动后，请检查以下项目:

- [ ] Python 后端服务运行在 http://localhost:8000
- [ ] 访问 http://localhost:8000/api/health 返回健康状态
- [ ] 访问 http://localhost:8000/docs 显示 API 文档
- [ ] 前端可以访问 http://localhost:5000
- [ ] 选择数据源后自动执行分析
- [ ] 点击"一键分析"按钮正常响应
- [ ] 浏览器控制台显示"📡 调用 Python 后端 API"
- [ ] 浏览器控制台显示"✅ Python 后端分析成功"
- [ ] 数据质量、月均消费、升档潜力显示真实计算结果
- [ ] 无黄色降级提示条

---

## 🚀 一键启动脚本

### Windows 批处理 (start.bat)

已创建 `start.bat` 文件，内容:

```batch
@echo off
echo 🚀 启动 Python 后端服务...
echo.
echo 📂 工作目录：%CD%
echo.
echo 🐍 Python 版本:
python --version
echo.
echo 📦 检查依赖...
pip list | findstr /i "fastapi uvicorn pandas"
echo.
echo 🔧 启动 FastAPI 服务...
echo 🌐 API 地址：http://localhost:8000
echo 📚 API 文档：http://localhost:8000/docs
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
```

**使用方法**:
1. 双击 `start.bat`
2. 等待服务启动
3. 不要关闭窗口
4. 使用 Ctrl+C 停止服务

---

## 📚 相关文档

- [Python 后端集成](file://d:\aiDE\projects\CXCC\PYTHON_BACKEND_INTEGRATION.md)
- [一键分析修复](file://d:\aiDE\projects\CXCC\ONE_CLICK_ANALYSIS_FIX.md)
- [启动指南](file://d:\aiDE\projects\CXCC\START_PYTHON_BACKEND.md)

---

## 🎉 总结

**当前状态**:
- ✅ `start.bat` 启动脚本已创建
- ✅ 依赖文件 `requirements.txt` 已存在
- ✅ 启动指南文档已创建

**下一步**:
1. 双击 `start.bat` 启动服务
2. 访问 http://localhost:8000/docs 验证
3. 测试"一键分析"功能
4. 享受完整的后端数据分析功能!

---

**需要帮助？**

如果遇到问题，请查看:
- 控制台的错误信息
- 浏览器控制台的日志
- 本文档的"常见问题解决"部分

祝使用愉快！🎉
