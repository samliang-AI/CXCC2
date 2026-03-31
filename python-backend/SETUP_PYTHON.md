# Python 环境配置指南

## 📋 问题诊断

如果您运行 `start.bat` 时看到以下错误:

```
无法将"uvicorn"项识别为 cmdlet、函数、脚本文件或可运行程序的名称
```

或

```
无法将"pip"项识别为 cmdlet、函数、脚本文件或可运行程序的名称
```

这说明您的 Python 环境没有正确配置。

---

## 🔧 解决方案

### 方案 1: 使用 start.bat 自动安装 (推荐)

**双击运行** `start.bat`,脚本会自动:
1. ✅ 检查 Python 环境
2. ✅ 检查 pip 是否可用
3. ✅ 自动安装所需的依赖包
4. ✅ 启动后端服务

---

### 方案 2: 手动配置 Python 环境

#### 步骤 1: 安装 Python

1. **下载 Python**:
   - 访问：https://www.python.org/downloads/
   - 下载 Python 3.8 或更高版本 (推荐 Python 3.10+)

2. **安装 Python**:
   - 运行安装程序
   - ⚠️ **重要**: 勾选 "Add Python to PATH" (将 Python 添加到环境变量)
   - 点击 "Install Now"

3. **验证安装**:
   打开命令提示符 (CMD) 或 PowerShell,输入:
   ```bash
   python --version
   ```
   应该显示类似: `Python 3.10.5`

---

#### 步骤 2: 安装依赖包

打开命令提示符，进入项目目录:

```bash
cd d:\aiDE\projects\CXCC\python-backend
```

安装所需的包:

```bash
pip install uvicorn fastapi pandas scikit-learn numpy openpyxl python-multipart
```

**如果 pip 不可用**,尝试:

```bash
python -m pip install uvicorn fastapi pandas scikit-learn numpy openpyxl python-multipart
```

---

#### 步骤 3: 启动后端服务

```bash
uvicorn main:app --reload
```

或双击 `start.bat`

---

### 方案 3: 使用虚拟环境 (推荐用于开发)

#### 创建虚拟环境

```bash
cd d:\aiDE\projects\CXCC\python-backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境 (PowerShell)
.\venv\Scripts\Activate.ps1

# 或激活虚拟环境 (CMD)
.\venv\Scripts\activate.bat
```

#### 安装依赖

```bash
pip install uvicorn fastapi pandas scikit-learn numpy openpyxl python-multipart
```

#### 启动服务

```bash
uvicorn main:app --reload
```

---

## 📦 所需依赖包说明

| 包名 | 用途 | 必需 |
|------|------|------|
| **uvicorn** | ASGI 服务器，用于运行 FastAPI | ✅ |
| **fastapi** | Web 框架 | ✅ |
| **pandas** | 数据处理和分析 | ✅ |
| **scikit-learn** | 机器学习模型 | ✅ |
| **numpy** | 数值计算 | ✅ |
| **openpyxl** | Excel 文件读写 | ✅ |
| **python-multipart** | 表单数据处理 | ✅ |

---

## 🔍 常见问题

### Q1: "python"不是可识别的命令

**原因**: Python 未安装或未添加到 PATH

**解决方案**:
1. 重新安装 Python
2. 安装时勾选 "Add Python to PATH"
3. 重启命令提示符

---

### Q2: "pip"不是可识别的命令

**原因**: pip 未安装或不在 PATH 中

**解决方案**:

**方法 1**: 使用 `python -m pip`
```bash
python -m pip install uvicorn fastapi pandas scikit-learn numpy openpyxl
```

**方法 2**: 手动安装 pip
1. 下载：https://bootstrap.pypa.io/get-pip.py
2. 运行：`python get-pip.py`

---

### Q3: 安装速度慢

**原因**: 从官方 PyPI 下载速度慢

**解决方案**: 使用国内镜像

**清华大学镜像源**:
```bash
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple uvicorn fastapi pandas scikit-learn numpy openpyxl python-multipart
```

**阿里云镜像源**:
```bash
pip install -i https://mirrors.aliyun.com/pypi/simple/ uvicorn fastapi pandas scikit-learn numpy openpyxl python-multipart
```

---

### Q4: 权限错误

**错误信息**: `PermissionError: [WinError 5] 拒绝访问`

**解决方案**:

**方法 1**: 使用 `--user` 参数
```bash
pip install --user uvicorn fastapi pandas scikit-learn numpy openpyxl
```

**方法 2**: 以管理员身份运行 CMD
- 右键点击 "命令提示符"
- 选择 "以管理员身份运行"
- 重新执行安装命令

---

### Q5: 虚拟环境问题

**激活虚拟环境失败 (PowerShell)**:

PowerShell 可能禁止执行脚本。解决方法:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

然后重新激活:
```powershell
.\venv\Scripts\Activate.ps1
```

---

## ✅ 验证安装

安装完成后，验证所有包是否正确安装:

```bash
pip list
```

应该看到:
```
Package           Version
----------------- -------
fastapi           0.x.x
numpy             1.x.x
openpyxl          3.x.x
pandas            2.x.x
python-multipart  0.x.x
scikit-learn      1.x.x
uvicorn           0.x.x
```

---

## 🚀 快速启动

完成环境配置后，只需双击 `start.bat` 即可启动后端服务!

服务启动后:
- 🌐 **API 地址**: http://localhost:8000
- 📚 **API 文档**: http://localhost:8000/docs
- 🛑 **停止服务**: 按 Ctrl+C

---

## 📞 需要帮助？

如果仍有问题，请提供:
1. Python 版本：`python --version`
2. pip 版本：`pip --version`
3. 完整错误信息

---

**祝使用愉快!** 🎉
