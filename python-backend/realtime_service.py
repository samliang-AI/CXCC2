"""
实时数据服务模块
提供 WebSocket 实时数据推送功能
"""
import asyncio
import json
from datetime import datetime
from typing import Dict, List, Set
from fastapi import WebSocket

class RealtimeService:
    """实时数据推送服务"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscribed_clients: Set[str] = set()
        self.update_interval = 5  # 更新间隔 (秒)
        self.running = False
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """连接 WebSocket"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"[WS] 客户端 {client_id} 已连接")
        
        # 发送欢迎消息
        await self.send_message(client_id, {
            "type": "welcome",
            "message": "已连接到实时数据服务",
            "timestamp": datetime.now().isoformat()
        })
    
    async def disconnect(self, client_id: str):
        """断开连接"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            self.subscribed_clients.discard(client_id)
            print(f"🔌 客户端 {client_id} 已断开")
    
    async def subscribe(self, client_id: str):
        """订阅实时数据"""
        self.subscribed_clients.add(client_id)
        print(f"[WS] 客户端 {client_id} 已订阅实时数据")
        
        # 开始推送数据
        await self.push_updates()
    
    async def unsubscribe(self, client_id: str):
        """取消订阅"""
        self.subscribed_clients.discard(client_id)
        print(f"[WS] 客户端 {client_id} 已取消订阅")
    
    async def send_message(self, client_id: str, message: Dict):
        """发送消息给指定客户端"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"发送消息失败：{e}")
                await self.disconnect(client_id)
    
    async def broadcast(self, message: Dict):
        """广播消息给所有订阅的客户端"""
        disconnected = []
        for client_id in self.subscribed_clients:
            if client_id in self.active_connections:
                try:
                    await self.send_message(client_id, message)
                except Exception as e:
                    print(f"广播失败 {client_id}: {e}")
                    disconnected.append(client_id)
        
        # 清理断开的连接
        for client_id in disconnected:
            await self.disconnect(client_id)
    
    async def push_updates(self):
        """推送数据更新"""
        if not self.running:
            self.running = True
            
            while self.running and len(self.subscribed_clients) > 0:
                # 生成模拟数据
                update_data = await self._generate_update_data()
                
                # 广播
                await self.broadcast({
                    "type": "update",
                    "data": update_data,
                    "timestamp": datetime.now().isoformat()
                })
                
                # 等待下次更新
                await asyncio.sleep(self.update_interval)
    
    async def _generate_update_data(self) -> Dict:
        """生成更新数据"""
        import random
        
        # 模拟实时数据变化
        base_consumption = 79.37
        base_flow = 12.75
        base_voice = 88.87
        
        return {
            "kpis": {
                "avgConsumption": round(base_consumption + random.uniform(-2, 2), 2),
                "avgFlow": round(base_flow + random.uniform(-0.5, 0.5), 2),
                "avgVoice": round(base_voice + random.uniform(-5, 5), 2),
                "activeUsers": random.randint(100, 500)
            },
            "alerts": self._generate_alerts(),
            "trends": {
                "consumption": random.uniform(-5, 5),
                "flow": random.uniform(-3, 3),
                "voice": random.uniform(-2, 2)
            }
        }
    
    def _generate_alerts(self) -> List[Dict]:
        """生成警报"""
        import random
        
        alerts = []
        
        if random.random() > 0.7:
            alerts.append({
                "type": "info",
                "title": "数据更新提醒",
                "message": f"新增 {random.randint(10, 100)} 条客户数据",
                "timestamp": datetime.now().isoformat()
            })
        
        if random.random() > 0.8:
            alerts.append({
                "type": "warning",
                "title": "高价值客户提醒",
                "message": f"发现 {random.randint(5, 20)} 位高意向客户",
                "timestamp": datetime.now().isoformat()
            })
        
        return alerts
    
    def stop(self):
        """停止推送"""
        self.running = False


# 全局服务实例
realtime_service = RealtimeService()
