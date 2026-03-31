# ⚠️ Python 未安装 - 请先安装 Python

## 🚨 当前状态

您的系统**没有安装 Python**或**Python 未添加到环境变量**。

运行 `start.bat` 或 `python --version` 时会显示错误。

---

## 📥 安装步骤

### 步骤 1: 下载 Python

访问 Python 官网下载页面:
👉 **https://www.python.org/downloads/**

建议下载:
- ✅ **Python 3.10.x** 或更高版本
- ✅ 选择 **Windows installer (64-bit)**

---

### 步骤 2: 安装 Python

1. **运行安装程序**
   
   双击下载的 `.exe` 文件

2. **⚠️ 重要：勾选 "Add Python to PATH"**
   
   在安装界面的底部，有一个复选框:
   ```
   ☑ Add Python 3.10 to PATH
   ```
   
   **必须勾选此项!** 否则无法运行 Python 命令。

3. **点击 "Install Now"**
   
   等待安装完成

4. **点击 "Close"**

---

### 步骤 3: 验证安装

打开**命令提示符**或**PowerShell**,输入:

```bash
python --version
```

应该显示:
```
Python 3.10.x
```

如果显示错误，请重启电脑后再试。

---

### 步骤 4: 安装项目依赖

打开命令提示符，进入项目目录:

```bash
cd d:\aiDE\projects\CXCC\python-backend
```

安装所需的包:

```bash
pip install uvicorn fastapi pandas scikit-learn numpy openpyxl python-multipart
```

**使用国内镜像加速** (推荐):

```bash
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple uvicorn fastapi pandas scikit-learn numpy openpyxl python-multipart
```

---

### 步骤 5: 启动后端服务

**方法 1: 使用 start.bat (推荐)**

双击 `start.bat`

**方法 2: 手动启动**

```bash
uvicorn main:app --reload
```

---

## ✅ 验证服务启动成功

服务启动后，打开浏览器访问:

- 🌐 **API 地址**: http://localhost:8000
- 📚 **API 文档**: http://localhost:8000/docs

如果能看到 FastAPI 的欢迎页面或 API 文档，说明成功!

---

## 🔍 常见问题

### Q: 安装后仍然显示 "python 不是可识别的命令"

**解决方案**:

1. **重启电脑** - 环境变量需要刷新
2. **手动添加环境变量**:
   - 右键 "此电脑" → "属性"
   - "高级系统设置" → "环境变量"
   - 在 "系统变量" 中找到 "Path"
   - 点击 "编辑"
   - 添加: `C:\Python310\` 和 `C:\Python310\Scripts\`
   - (路径根据实际安装位置调整)
   - 点击 "确定" 保存

---

### Q:  pip 安装速度很慢

**解决方案**: 使用国内镜像源

```bash
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple uvicorn fastapi pandas scikit-learn numpy openpyxl python-multipart
```

---

### Q: 权限错误

**解决方案**: 以管理员身份运行命令提示符

1. 在开始菜单搜索 "cmd"
2. 右键 "命令提示符"
3. 选择 "以管理员身份运行"
4. 重新执行安装命令

---

## 📞 需要帮助？

如果在安装过程中遇到问题，请提供:

1. Windows 版本
2. Python 版本
3. 完整错误信息

---

## 🎯 下一步

安装完成后，参考:
- [Python 环境配置指南](SETUP_PYTHON.md)
- [客户 API 集成文档](..\CUSTOMER_API_INTEGRATION.md)

---

**安装完成后，双击 `start.bat` 即可启动后端服务!** 🚀
