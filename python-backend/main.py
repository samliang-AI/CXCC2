"""
外呼数据分析系统 - Python 后端服务
提供数据分析、机器学习预测、实时数据推送等功能
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import json
import os
import uvicorn
from datetime import datetime, timedelta
import asyncio
from pathlib import Path
import urllib.request
import urllib.error
from contextlib import asynccontextmanager
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import io

# 加载环境变量
from dotenv import load_dotenv
load_dotenv()  # 加载 python-backend/.env 文件中的环境变量

# 导入自定义模块
from analyzer import DataAnalyzer
from ml_models import CustomerIntentModel, ConversionPredictor
from realtime_service import RealtimeService

# 生命周期（替代 @app.on_event startup/shutdown）
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理（启动/关闭）"""
    global recording_sync_task, call_logs_sync_task, dimension_sync_task

    print("[Startup] 启动数据分析服务...")
    print("[Startup] 加载机器学习模型...")
    if recording_sync_task and not recording_sync_task.done():
        print("[Startup] 录音清单定时同步任务已存在，跳过重复创建")
    else:
        print("[Startup] 启动录音清单定时同步任务（每1分钟）...")
        recording_sync_task = asyncio.create_task(run_recording_sync_loop())
    if call_logs_sync_task and not call_logs_sync_task.done():
        print("[Startup] 通话清单定时同步任务已存在，跳过重复创建")
    else:
        print("[Startup] 启动通话清单定时同步任务（每1分钟）...")
        call_logs_sync_task = asyncio.create_task(run_call_logs_sync_loop())
    if dimension_sync_task and not dimension_sync_task.done():
        print("[Startup] 团队/坐席定时同步任务已存在，跳过重复创建")
    else:
        print("[Startup] 启动外呼团队/坐席定时同步任务（每5分钟）...")
        dimension_sync_task = asyncio.create_task(run_dimension_sync_loop())
    print("[Startup] 服务就绪")

    try:
        yield
    finally:
        if recording_sync_task:
            recording_sync_task.cancel()
            try:
                await recording_sync_task
            except asyncio.CancelledError:
                pass
            recording_sync_task = None
        if call_logs_sync_task:
            call_logs_sync_task.cancel()
            try:
                await call_logs_sync_task
            except asyncio.CancelledError:
                pass
            call_logs_sync_task = None
        if dimension_sync_task:
            dimension_sync_task.cancel()
            try:
                await dimension_sync_task
            except asyncio.CancelledError:
                pass
            dimension_sync_task = None
        print("[Shutdown] 关闭服务...")


# 创建 FastAPI 应用
app = FastAPI(
    title="外呼数据分析系统 API",
    description="提供数据分析、机器学习预测、实时数据推送等功能",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置 CORS - 允许所有来源（开发环境）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局变量
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

models_dir = Path("models")
models_dir.mkdir(exist_ok=True)

# 初始化服务
analyzer = DataAnalyzer()
intent_model = CustomerIntentModel()
conversion_model = ConversionPredictor()
realtime_service = RealtimeService()
recording_sync_task: Optional[asyncio.Task] = None
call_logs_sync_task: Optional[asyncio.Task] = None
dimension_sync_task: Optional[asyncio.Task] = None

# ==================== 数据模型 ====================

class AnalysisRequest(BaseModel):
    data_source_id: str
    analysis_type: str = "full"  # full, quick, custom
    custom_metrics: Optional[List[str]] = None

class AnalysisResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: str
    timestamp: datetime

class PredictRequest(BaseModel):
    customer_data: Dict[str, Any]
    model_type: str = "intent"  # intent or conversion

class PredictResponse(BaseModel):
    success: bool
    prediction: float
    confidence: float
    recommendation: str

class CustomReportRequest(BaseModel):
    metrics: List[str]
    dimensions: List[str]
    filters: Optional[Dict[str, Any]] = None
    date_range: Optional[Dict[str, str]] = None

# ==================== 辅助函数 ====================

async def get_current_user(token: str = None):
    """获取当前用户 (简化版本)"""
    return {"username": "admin", "role": "admin"}

def _sync_recordings_once() -> None:
    """
    通过 Next 内部接口触发录音清单增量同步
    默认每次回看最近 15 分钟窗口，服务端按 uuid 幂等 upsert
    """
    base = os.getenv("SYNC_NEXT_BASE_URL", "http://127.0.0.1:5000").rstrip("/")
    lookback = int(os.getenv("SYNC_RECORDINGS_LOOKBACK_MINUTES", "15"))
    page_size = int(os.getenv("SYNC_RECORDINGS_PAGE_SIZE", "200"))
    max_pages = int(os.getenv("SYNC_RECORDINGS_MAX_PAGES", "5"))
    token = os.getenv("INTERNAL_SYNC_TOKEN", "")

    url = f"{base}/api/internal/sync/recordings?lookbackMinutes={lookback}&pageSize={page_size}&maxPages={max_pages}"
    req = urllib.request.Request(url=url, method="POST", data=b"{}", headers={"Content-Type": "application/json"})
    if token:
        req.add_header("x-sync-token", token)

    with urllib.request.urlopen(req, timeout=90) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
        print(f"[RecordingSync] status={resp.status} body={body[:300]}")

def _sync_call_logs_once() -> None:
    base = os.getenv("SYNC_NEXT_BASE_URL", "http://127.0.0.1:5000").rstrip("/")
    lookback = int(os.getenv("SYNC_CALL_LOGS_LOOKBACK_MINUTES", "15"))
    page_size = int(os.getenv("SYNC_CALL_LOGS_PAGE_SIZE", "200"))
    max_pages = int(os.getenv("SYNC_CALL_LOGS_MAX_PAGES", "10"))
    token = os.getenv("INTERNAL_SYNC_TOKEN", "")

    url = f"{base}/api/internal/sync/call-logs?lookbackMinutes={lookback}&pageSize={page_size}&maxPages={max_pages}"
    req = urllib.request.Request(url=url, method="POST", data=b"{}", headers={"Content-Type": "application/json"})
    if token:
        req.add_header("x-sync-token", token)

    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
        print(f"[CallLogsSync] status={resp.status} body={body[:300]}")

def _sync_teams_once() -> None:
    base = os.getenv("SYNC_NEXT_BASE_URL", "http://127.0.0.1:5000").rstrip("/")
    token = os.getenv("INTERNAL_SYNC_TOKEN", "")
    max_pages = int(os.getenv("SYNC_TEAMS_MAX_PAGES", "20"))
    page_size = int(os.getenv("SYNC_TEAMS_PAGE_SIZE", "100"))
    url = f"{base}/api/internal/sync/teams?maxPages={max_pages}&pageSize={page_size}"
    req = urllib.request.Request(url=url, method="POST", data=b"{}", headers={"Content-Type": "application/json"})
    if token:
        req.add_header("x-sync-token", token)
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
        print(f"[TeamSync] status={resp.status} body={body[:300]}")

def _sync_agents_once() -> None:
    base = os.getenv("SYNC_NEXT_BASE_URL", "http://127.0.0.1:5000").rstrip("/")
    token = os.getenv("INTERNAL_SYNC_TOKEN", "")
    max_pages = int(os.getenv("SYNC_AGENTS_MAX_PAGES", "30"))
    page_size = int(os.getenv("SYNC_AGENTS_PAGE_SIZE", "200"))
    url = f"{base}/api/internal/sync/agents?maxPages={max_pages}&pageSize={page_size}"
    req = urllib.request.Request(url=url, method="POST", data=b"{}", headers={"Content-Type": "application/json"})
    if token:
        req.add_header("x-sync-token", token)
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
        print(f"[AgentSync] status={resp.status} body={body[:300]}")

async def run_recording_sync_loop():
    """
    后台循环：每 1 分钟触发一次同步
    """
    interval_seconds = int(os.getenv("SYNC_RECORDINGS_INTERVAL_SECONDS", "60"))
    enable = os.getenv("ENABLE_RECORDING_SYNC", "1")
    if enable == "0":
        print("[RecordingSync] disabled by ENABLE_RECORDING_SYNC=0")
        return

    # 启动时先执行一次
    while True:
        started = datetime.now()
        try:
            await asyncio.to_thread(_sync_recordings_once)
        except urllib.error.URLError as e:
            print(f"[RecordingSync] request error: {e}")
        except Exception as e:
            print(f"[RecordingSync] failed: {e}")
        elapsed = (datetime.now() - started).total_seconds()
        wait_seconds = max(5, interval_seconds - int(elapsed))
        await asyncio.sleep(wait_seconds)

async def run_call_logs_sync_loop():
    """
    通话清单：后台循环，每 1 分钟同步一次
    """
    interval_seconds = int(os.getenv("SYNC_CALL_LOGS_INTERVAL_SECONDS", "60"))
    enable = os.getenv("ENABLE_CALL_LOGS_SYNC", "1")
    if enable == "0":
        print("[CallLogsSync] disabled by ENABLE_CALL_LOGS_SYNC=0")
        return

    while True:
        started = datetime.now()
        try:
            await asyncio.to_thread(_sync_call_logs_once)
        except urllib.error.URLError as e:
            print(f"[CallLogsSync] request error: {e}")
        except Exception as e:
            print(f"[CallLogsSync] failed: {e}")
        elapsed = (datetime.now() - started).total_seconds()
        wait_seconds = max(5, interval_seconds - int(elapsed))
        await asyncio.sleep(wait_seconds)

async def run_dimension_sync_loop():
    """
    外呼团队 + 坐席设置：后台循环，每 5 分钟同步一次
    """
    interval_seconds = int(os.getenv("SYNC_DIMENSIONS_INTERVAL_SECONDS", "300"))
    enable = os.getenv("ENABLE_DIMENSIONS_SYNC", "1")
    if enable == "0":
        print("[DimensionSync] disabled by ENABLE_DIMENSIONS_SYNC=0")
        return

    while True:
        started = datetime.now()
        try:
            await asyncio.to_thread(_sync_teams_once)
            await asyncio.to_thread(_sync_agents_once)
        except urllib.error.URLError as e:
            print(f"[DimensionSync] request error: {e}")
        except Exception as e:
            print(f"[DimensionSync] failed: {e}")
        elapsed = (datetime.now() - started).total_seconds()
        wait_seconds = max(5, interval_seconds - int(elapsed))
        await asyncio.sleep(wait_seconds)

# ==================== API 路由 ====================

@app.get("/")
async def root():
    """API 根路径"""
    return {
        "message": "外呼数据分析系统 API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": "connected",
            "ml_models": "loaded",
            "cache": "active"
        }
    }

@app.post("/api/upload")
async def upload_data(file: UploadFile = File(...), data_name: str = None):
    """
    上传数据文件
    - file: Excel 或 CSV 文件
    - data_name: 数据名称
    """
    try:
        # 验证文件类型
        allowed_extensions = ["xlsx", "xls", "csv", "json"]
        if not file.filename:
            raise HTTPException(status_code=400, detail="文件没有文件名")
        
        file_ext = file.filename.split(".")[-1].lower()
        if not file_ext:
            raise HTTPException(status_code=400, detail="文件没有扩展名")
        
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"不支持的文件类型，仅支持：{', '.join(allowed_extensions)}")
        
        # 保存文件
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = data_name.replace(" ", "_") if data_name is not None else "uploaded_data"
        filename = f"{safe_name}_{timestamp}.{file_ext}"
        filepath = uploads_dir / filename
        
        with open(filepath, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # 读取并预览数据
        if file_ext == "csv":
            df = pd.read_csv(filepath)
        elif file_ext == "json":
            import json
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            df = pd.DataFrame(data)
        else:
            df = pd.read_excel(filepath)
        
        # 生成数据预览
        preview = {
            "columns": df.columns.tolist(),
            "row_count": len(df),
            "sample_data": df.head(5).to_dict('records'),
            "data_types": {col: str(dtype) for col, dtype in df.dtypes.items()}
        }
        
        return {
            "success": True,
            "message": "文件上传成功",
            "data": {
                "filename": filename,
                "filepath": str(filepath),
                "data_name": data_name or safe_name,
                "preview": preview
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败：{str(e)}")

def _resolve_data_source_path(data_source_id: str) -> Path:
    """将数据源 ID/名称 解析为 uploads 中的实际文件路径"""
    if not data_source_id:
        raise HTTPException(status_code=400, detail="请提供 data_source_id 参数")
    data_source_id = data_source_id.replace("\\", "/").split("/")[-1]
    file_path = uploads_dir / data_source_id
    if not file_path.exists():
        file_path = Path(data_source_id)
    if not file_path.exists():
        for f in uploads_dir.glob("*"):
            if f.is_file() and f.suffix.lower() in ['.xlsx', '.xls', '.csv', '.json']:
                if f.stem == data_source_id or f.name == data_source_id or f.name.startswith(data_source_id + "_"):
                    return f
    if not file_path.exists() or file_path.suffix.lower() not in ['.xlsx', '.xls', '.csv', '.json']:
        raise HTTPException(status_code=404, detail="数据文件不存在")
    return file_path


@app.post("/api/analyze")
async def analyze_data(request: AnalysisRequest):
    """
    分析数据
    - data_source_id: 数据源 ID、名称或文件路径
    - analysis_type: 分析类型 (full, quick, custom)
    - custom_metrics: 自定义指标列表
    """
    try:
        resolved_path = str(_resolve_data_source_path(request.data_source_id))
        if request.analysis_type == "full":
            result = analyzer.full_analysis(resolved_path)
        elif request.analysis_type == "quick":
            result = analyzer.quick_analysis(resolved_path)
        elif request.analysis_type == "custom":
            result = analyzer.custom_analysis(
                resolved_path,
                request.custom_metrics or []
            )
        else:
            raise HTTPException(status_code=400, detail="无效的分析类型")
        
        return AnalysisResponse(
            success=True,
            data=result,
            message="分析完成",
            timestamp=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败：{str(e)}")

@app.post("/api/predict")
async def predict_customer(request: PredictRequest):
    """
    客户意向预测
    - customer_data: 客户数据
    - model_type: 模型类型 (intent 或 conversion)
    """
    try:
        if request.model_type == "intent":
            prediction, confidence, recommendation = intent_model.predict(
                request.customer_data
            )
        elif request.model_type == "conversion":
            prediction, confidence, recommendation = conversion_model.predict(
                request.customer_data
            )
        else:
            raise HTTPException(status_code=400, detail="无效的模型类型")
        
        return PredictResponse(
            success=True,
            prediction=prediction,
            confidence=confidence,
            recommendation=recommendation
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预测失败：{str(e)}")

@app.post("/api/train-model")
async def train_model(model_type: str = "intent"):
    """
    训练机器学习模型
    - model_type: 模型类型 (intent 或 conversion)
    """
    try:
        if model_type == "intent":
            result = intent_model.train()
        elif model_type == "conversion":
            result = conversion_model.train()
        else:
            raise HTTPException(status_code=400, detail="无效的模型类型")
        
        return {
            "success": True,
            "message": f"{model_type}模型训练完成",
            "metrics": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"训练失败：{str(e)}")

@app.post("/api/custom-report")
async def generate_custom_report(request: CustomReportRequest):
    """
    生成自定义报表
    - metrics: 指标列表
    - dimensions: 维度列表
    - filters: 筛选条件
    - date_range: 日期范围
    """
    try:
        report = analyzer.generate_custom_report(
            metrics=request.metrics,
            dimensions=request.dimensions,
            filters=request.filters,
            date_range=request.date_range
        )
        
        return {
            "success": True,
            "data": report,
            "message": "自定义报表生成成功"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"报表生成失败：{str(e)}")

@app.get("/api/data-sources")
async def list_data_sources():
    """获取所有数据源列表"""
    try:
        sources = []
        for file in uploads_dir.glob("*"):
            if file.is_file() and file.suffix.lower() in ['.xlsx', '.xls', '.csv']:
                sources.append({
                    "id": file.stem,
                    "name": file.stem,
                    "filename": file.name,
                    "size": file.stat().st_size,
                    "created_at": datetime.fromtimestamp(file.stat().st_ctime).isoformat()
                })
        
        return {
            "success": True,
            "data": sources
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取数据源失败：{str(e)}")

@app.get("/api/dashboard/statistics")
async def get_dashboard_statistics(startDate: str = None, endDate: str = None):
    """
    获取看板统计数据 - 从 WEB 管理后台 API 获取真实数据
    - startDate: 开始日期 (YYYY-MM-DD)
    - endDate: 结束日期 (YYYY-MM-DD)
    """
    try:
        import urllib.request
        import urllib.error
        import json
        
        # 默认使用今天的日期
        if not startDate:
            startDate = datetime.now().strftime("%Y-%m-%d")
        if not endDate:
            endDate = datetime.now().strftime("%Y-%m-%d")
        
        # 调用 WEB 管理后台的 API 获取真实数据
        # WEB 后台运行在 5001 端口，使用局域网 IP 访问
        web_api_base = os.getenv("WEB_API_BASE_URL", "http://192.168.100.15:5001")
        url = f"{web_api_base}/api/dashboard/statistics?startDate={startDate}&endDate={endDate}"
        
        print(f"[Dashboard] 从 WEB 后台获取数据: {url}")
        
        req = urllib.request.Request(url=url, method="GET", headers={"Content-Type": "application/json"})
        
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8", errors="ignore")
                result = json.loads(body)
                
                if result.get("code") == 200:
                    data = result.get("data", {})
                    
                    # 转换数据格式以适配小程序
                    # 城市排名转换
                    city_ranking = []
                    for city in data.get("cityRanking", []):
                        city_ranking.append({
                            "city": city.get("cityName", city.get("cityCode", "")),
                            "calls": city.get("totalCalls", 0),
                            "successRate": city.get("rate", 0)
                        })
                    
                    # 质检分布转换
                    quality_dist = []
                    for q in data.get("qualityDistribution", []):
                        quality_dist.append({
                            "name": q.get("name", ""),
                            "value": q.get("value", 0)
                        })
                    
                    # 趋势数据转换
                    trend_data = []
                    for t in data.get("trendData", []):
                        trend_data.append({
                            "date": t.get("date", ""),
                            "calls": t.get("calls", 0),
                            "connected": t.get("connected", 0),
                            "success": t.get("success", 0)
                        })
                    
                    # 过滤掉"未知项目"
                    city_details = []
                    for city in data.get("cityDetails", []):
                        city_name = city.get("cityName", "")
                        if city_name and city_name != "未知项目":
                            city_details.append(city)
                    
                    # 过滤城市排名中的"未知项目"
                    filtered_city_ranking = []
                    for city in city_ranking:
                        city_name = city.get("city", "")
                        if city_name and city_name != "未知项目":
                            filtered_city_ranking.append(city)
                    
                    response_data = {
                        "overview": data.get("overview", {}),
                        "trendData": trend_data,
                        "cityRanking": filtered_city_ranking,
                        "qualityDistribution": quality_dist,
                        "agentRanking": data.get("agentRanking", []),
                        "cityDetails": city_details,
                        "dateRange": data.get("dateRange", {"startDate": startDate, "endDate": endDate})
                    }
                    
                    print(f"[Dashboard] 成功获取真实数据: 总呼叫量={response_data['overview'].get('totalCalls', 0)}")
                    
                    return {
                        "code": 200,
                        "message": "success",
                        "data": response_data
                    }
                else:
                    print(f"[Dashboard] WEB API 返回错误: {result}")
                    raise Exception(f"WEB API 错误: {result.get('message', '未知错误')}")
                    
        except urllib.error.URLError as e:
            print(f"[Dashboard] 连接 WEB 后台失败: {e}")
            # 如果 WEB 后台不可用，返回模拟数据作为降级方案
            return generate_mock_dashboard_data(startDate, endDate)
        except Exception as e:
            print(f"[Dashboard] 获取数据失败: {e}")
            return generate_mock_dashboard_data(startDate, endDate)
        
    except Exception as e:
        print(f"[Dashboard] 获取统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取统计数据失败：{str(e)}")

def generate_mock_dashboard_data(startDate: str, endDate: str):
    """生成模拟数据作为降级方案"""
    import random
    
    print("[Dashboard] 使用模拟数据")
    
    # 生成模拟数据
    overview = {
        "totalCalls": random.randint(8000, 15000),
        "connectedCalls": random.randint(5000, 10000),
        "successCalls": random.randint(3000, 7000),
        "qualityRate": round(random.uniform(75, 95), 1),
        "totalAgents": random.randint(50, 100)
    }
    
    # 生成趋势数据（最近7天）
    trendData = []
    for i in range(7):
        date_obj = datetime.now() - timedelta(days=6-i)
        trendData.append({
            "date": date_obj.strftime("%m-%d"),
            "calls": random.randint(800, 2000),
            "connected": random.randint(500, 1500),
            "success": random.randint(300, 1000)
        })
    
    # 生成城市排名
    cityRanking = [
        {"city": "北京", "calls": random.randint(2000, 3000), "successRate": round(random.uniform(70, 90), 1)},
        {"city": "上海", "calls": random.randint(1800, 2800), "successRate": round(random.uniform(70, 90), 1)},
        {"city": "广州", "calls": random.randint(1500, 2500), "successRate": round(random.uniform(70, 90), 1)},
        {"city": "深圳", "calls": random.randint(1200, 2200), "successRate": round(random.uniform(70, 90), 1)},
        {"city": "杭州", "calls": random.randint(800, 1800), "successRate": round(random.uniform(70, 90), 1)}
    ]
    
    # 生成质检分布
    qualityDistribution = [
        {"name": "优秀", "value": random.randint(1000, 2000)},
        {"name": "良好", "value": random.randint(2000, 4000)},
        {"name": "合格", "value": random.randint(1500, 3000)},
        {"name": "待改进", "value": random.randint(500, 1500)}
    ]
    
    return {
        "code": 200,
        "message": "success (mock data)",
        "data": {
            "overview": overview,
            "trendData": trendData,
            "cityRanking": cityRanking,
            "qualityDistribution": qualityDistribution
        }
    }

@app.get("/api/customers/segment/{segment}")
async def get_customer_segment(
    segment: str,
    data_source_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
):
    """
    获取指定分层的客户明细
    - segment: 客户分层 (high, medium, low)
    - data_source_id: 数据源 ID (文件路径)
    - page: 页码 (默认 1)
    - page_size: 每页数量 (默认 10)
    """
    try:
        # 验证分层参数
        if segment not in ['high', 'medium', 'low']:
            raise HTTPException(status_code=400, detail="无效的分层参数，应为 high, medium 或 low")
        
        # 加载数据
        if data_source_id:
            # 去除路径，只保留文件名
            data_source_id = data_source_id.replace("\\", "/").split("/")[-1]
            file_path = uploads_dir / data_source_id
            if not file_path.exists():
                file_path = Path(data_source_id)
            # 若无扩展名或文件不存在，按名称前缀在 uploads 中查找
            if not file_path.exists():
                for f in uploads_dir.glob("*"):
                    if f.is_file() and f.suffix.lower() in ['.xlsx', '.xls', '.csv', '.json']:
                        if f.stem == data_source_id or f.name == data_source_id or f.name.startswith(data_source_id + "_"):
                            file_path = f
                            break

            if file_path.exists() and file_path.suffix.lower() in ['.xlsx', '.xls', '.csv', '.json']:
                if file_path.suffix == '.csv':
                    df = pd.read_csv(file_path)
                elif file_path.suffix == '.json':
                    import json
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    df = pd.DataFrame(data)
                else:
                    df = pd.read_excel(file_path)
            else:
                raise HTTPException(status_code=404, detail="数据文件不存在")
        else:
            # 使用默认数据
            raise HTTPException(status_code=400, detail="请提供 data_source_id 参数")
        
        # 查找消费列
        consumption_col = None
        possible_names = ['月均消费', '消费', 'ARPU', 'arpu', '月消费', '消费金额']
        for col in df.columns:
            if col in possible_names:
                consumption_col = col
                break
        
        if consumption_col is None:
            # 尝试模糊匹配
            for col in df.columns:
                if '消费' in col or 'arpu' in col.lower():
                    consumption_col = col
                    break
        
        if consumption_col is None:
            raise HTTPException(status_code=400, detail="未找到消费相关列")
        
        # 确保消费列为数值类型
        df[consumption_col] = pd.to_numeric(df[consumption_col], errors='coerce')
        df = df.dropna(subset=[consumption_col])
        
        # 计算分位数
        q3 = df[consumption_col].quantile(0.8)
        q1 = df[consumption_col].quantile(0.2)
        
        # 根据分层筛选数据
        if segment == 'high':
            filtered_df = df[df[consumption_col] >= q3]
        elif segment == 'medium':
            filtered_df = df[(df[consumption_col] >= q1) & (df[consumption_col] < q3)]
        else:  # low
            filtered_df = df[df[consumption_col] < q1]
        
        # 计算该分层的 ARPU
        segment_arpu = filtered_df[consumption_col].mean()
        
        # 分页
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_df = filtered_df.iloc[start_idx:end_idx]
        
        # 查找序号、流量、语音列（优先精确匹配）
        def _find_col(df, exact_first, then_partial):
            for c in exact_first:
                if c in df.columns:
                    return c
            for kw in then_partial:
                for col in df.columns:
                    if kw in str(col) or kw.lower() in str(col).lower():
                        return col
            return None
        seq_col = _find_col(df, ['序号', '编号', 'ID'], ['序号', '编号'])
        flow_col = _find_col(df, ['月均流量', '流量'], ['月均流量', '流量', 'flow', 'DOU'])
        voice_col = _find_col(df, ['月均语音', '语音'], ['月均语音', '语音', 'voice', '分钟', 'MOU'])
        flow_over_col = _find_col(df, ['近3月流量超套', '近 3 月流量超套', '流量超套'], ['流量超套'])
        voice_over_col = _find_col(df, ['近3月语音超套', '近 3 月语音超套', '语音超套'], ['语音超套'])
        rent_col = _find_col(df, ['月租', '租费'], ['月租', '租费'])

        PKG_BENEFITS = {
            "79 元套餐": "20GB流量+200分钟",
            "99 元套餐": "30GB流量+500分钟",
            "129 元套餐": "50GB流量+800分钟",
            "159 元套餐": "100GB流量+不限量语音"
        }

        def _script_key_points(rec_pkg, row, fo_col, vo_col, fl_col, vc_col, rt_col):
            fo = vo = False
            if fo_col and fo_col in row.index:
                try:
                    fo = float(row[fo_col] or 0) > 0
                except (TypeError, ValueError):
                    pass
            if vo_col and vo_col in row.index:
                try:
                    vo = float(row[vo_col] or 0) > 0
                except (TypeError, ValueError):
                    pass
            rent_val = str(row.get(rt_col, "") or "").strip() if rt_col and rt_col in row.index else ""
            rent = float(rent_val) if rent_val and rent_val != "-" else 0
            flow_val = str(row.get(fl_col, "") or "").strip() if fl_col and fl_col in row.index else ""
            voice_val = str(row.get(vc_col, "") or "").strip() if vc_col and vc_col in row.index else ""
            # 1. 当前使用：当前月租（Excel月租字段）、流量、月均语音
            cur_usage = f"当前月租{rent_val}元" if rent_val and rent_val != "-" and rent > 0 else "当前档"
            if flow_val and voice_val and flow_val != "-":
                cur_usage += f"，月均流量{flow_val}GB、语音{voice_val}分钟"
            elif flow_val and flow_val != "-":
                cur_usage += f"，月均流量{flow_val}GB"
            elif voice_val and voice_val != "-":
                cur_usage += f"，月均语音{voice_val}分钟"
            else:
                cur_usage += "，使用情况"
            # 2. 超套情况：流量/语音是否超套
            overuse = "，流量与语音均超套" if (fo and vo) else "，流量已超套" if fo else "，语音已超套" if vo else ""
            # 3. 升档权益 4. 费用优惠 5. 引导升档
            rec_benefit = PKG_BENEFITS.get(rec_pkg, "")
            rec_short = rec_pkg.replace(" 元套餐", "元")
            upgrade = f"升{rec_short}享{rec_benefit}"
            savings = "免超套费，长期更省" if (fo or vo) else "享更多权益，更划算"
            s = f"您{cur_usage}{overuse}。{upgrade}，{savings}。建议升档。"
            return s[:100] if len(s) > 100 else s

        # 构建返回数据（客户ID=序号，月均消费/流量/语音 取自 Excel 对应列）
        customers = []
        for idx, row in page_df.iterrows():
            raw_seq = row[seq_col] if seq_col and seq_col in row.index else None
            raw_consumption = row[consumption_col]
            raw_flow = row[flow_col] if flow_col and flow_col in row.index else None
            raw_voice = row[voice_col] if voice_col and voice_col in row.index else None
            customer = {
                "id": str(raw_seq) if pd.notna(raw_seq) and str(raw_seq).strip() != '' else str(idx),
                "月均消费": float(raw_consumption) if pd.notna(raw_consumption) else 0,
            }
            if flow_col and flow_col in row.index:
                customer["月均流量"] = raw_flow if pd.notna(raw_flow) else '-'
            if voice_col and voice_col in row.index:
                customer["月均语音"] = raw_voice if pd.notna(raw_voice) else '-'
            for col in ['月租', '信用分', '在用带宽', '宽带类型']:
                if col in row.index and pd.notna(row.get(col)):
                    customer[col] = row[col]
            
            # 推荐套餐 (基于 ARPU)
            arpu = row[consumption_col]
            if arpu >= 120:
                rec_pkg = "159 元套餐"
                customer["升档意向"] = round(80 + np.random.random() * 20, 1)
            elif arpu >= 70:
                rec_pkg = "99 元套餐"
                customer["升档意向"] = round(50 + np.random.random() * 30, 1)
            else:
                rec_pkg = "79 元套餐"
                customer["升档意向"] = round(20 + np.random.random() * 30, 1)
            customer["推荐套餐"] = rec_pkg
            customer["话术要点"] = _script_key_points(rec_pkg, row, flow_over_col, voice_over_col, flow_col, voice_col, rent_col)
            
            customers.append(customer)
        
        return {
            "success": True,
            "data": {
                "customers": customers,
                "total": len(filtered_df),
                "page": page,
                "page_size": page_size,
                "total_pages": (len(filtered_df) + page_size - 1) // page_size,
                "segment_arpu": round(segment_arpu, 2),
                "segment": segment
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取客户明细失败：{str(e)}")

@app.get("/api/customers/{customer_id}")
async def get_customer_detail(customer_id: str, data_source_id: Optional[str] = None):
    """
    获取单个客户的详细信息
    - customer_id: 客户 ID
    - data_source_id: 数据源 ID
    """
    try:
        # 加载数据
        if data_source_id:
            file_path = uploads_dir / data_source_id
            if not file_path.exists():
                file_path = Path(data_source_id)
            
            if file_path.exists() and file_path.suffix.lower() in ['.xlsx', '.xls', '.csv']:
                if file_path.suffix == '.csv':
                    df = pd.read_csv(file_path)
                else:
                    df = pd.read_excel(file_path)
            else:
                raise HTTPException(status_code=404, detail="数据文件不存在")
        else:
            raise HTTPException(status_code=400, detail="请提供 data_source_id 参数")
        
        # 查找客户 (假设第一列是客户 ID 或索引)
        if customer_id.isdigit():
            idx = int(customer_id)
            if idx < len(df):
                customer_data = df.iloc[idx].to_dict()
                # 格式化数据
                formatted_data = {}
                for key, value in customer_data.items():
                    if isinstance(value, (np.floating, float)):
                        formatted_data[key] = round(value, 2)
                    else:
                        formatted_data[key] = value
                return {
                    "success": True,
                    "data": formatted_data
                }
        
        raise HTTPException(status_code=404, detail="客户不存在")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取客户详情失败：{str(e)}")

# ==================== WebSocket 实时数据 ====================

@app.websocket("/ws/realtime/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket 实时数据推送
    - client_id: 客户端 ID
    """
    await realtime_service.connect(websocket, client_id)
    try:
        while True:
            # 等待客户端消息
            data = await websocket.receive_text()
            
            # 处理客户端请求
            if data == "subscribe":
                await realtime_service.subscribe(client_id)
            elif data == "unsubscribe":
                await realtime_service.unsubscribe(client_id)
            
    except WebSocketDisconnect:
        await realtime_service.disconnect(client_id)

# ==================== 运行服务 ====================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
