# Python 数据分析后端服务

## 环境要求

- Python 3.9+
- pip 包管理器

## 安装依赖

```bash
cd python-backend
pip install -r requirements.txt
```

## 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

## API 文档

启动后访问 http://localhost:8000/docs 查看完整的 API 文档

## 主要功能

1. **数据上传 API**: `/api/upload` - 上传 Excel 数据文件
2. **数据分析 API**: `/api/analyze` - 执行数据分析
3. **模型预测 API**: `/api/predict` - 客户意向预测
4. **实时数据 API**: `/api/realtime` - WebSocket 实时数据推送
5. **自定义报表 API**: `/api/custom-report` - 生成自定义报表
