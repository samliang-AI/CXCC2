"""
机器学习模型模块
提供客户意向预测和转化率预估功能
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score
import joblib
from pathlib import Path
from typing import Dict, Tuple, Any
import json

class CustomerIntentModel:
    """客户意向预测模型"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.model_path = Path("models/intent_model.pkl")
        self.is_trained = False
        
        # 特征列
        self.feature_columns = [
            '月均消费', '月均流量', '月均语音', '月租',
            '套餐利用率', '流量需求指数', '语音需求指数',
            '超套综合评分', '信用分'
        ]
    
    def prepare_features(self, customer_data: Dict[str, Any]) -> np.ndarray:
        """准备特征向量"""
        features = []
        
        # 数值特征
        features.append(customer_data.get('月均消费', 79.37))
        features.append(customer_data.get('月均流量', 12.75))
        features.append(customer_data.get('月均语音', 88.87))
        features.append(customer_data.get('月租', 59))
        
        # 计算衍生特征
        monthly_consumption = customer_data.get('月均消费', 79.37)
        monthly_rent = customer_data.get('月租', 59)
        features.append(monthly_consumption / monthly_rent if monthly_rent > 0 else 1)  # 套餐利用率
        
        # 流量需求指数
        monthly_flow = customer_data.get('月均流量', 12.75)
        features.append(monthly_flow / 10)  # 假设套餐包含 10GB
        
        # 语音需求指数
        monthly_voice = customer_data.get('月均语音', 88.87)
        features.append(monthly_voice / 100)  # 假设套餐包含 100 分钟
        
        # 超套综合评分
        flow_overuse = customer_data.get('近 3 月流量超套', 0)
        voice_overuse = customer_data.get('近 3 月语音超套', 0)
        features.append(flow_overuse * 0.6 + voice_overuse * 0.4)
        
        # 信用分
        features.append(customer_data.get('信用分', 70))
        
        return np.array(features).reshape(1, -1)
    
    def predict(self, customer_data: Dict[str, Any]) -> Tuple[float, float, str]:
        """
        预测客户意向
        返回：(意向分数，置信度，推荐建议)
        """
        try:
            # 准备特征
            features = self.prepare_features(customer_data)
            
            # 标准化
            features_scaled = self.scaler.transform(features)
            
            # 预测
            if self.model and self.is_trained:
                prediction = self.model.predict_proba(features_scaled)[0][1]
                confidence = max(self.model.predict_proba(features_scaled)[0])
            else:
                # 使用规则引擎作为默认
                prediction = self._rule_based_prediction(customer_data)
                confidence = 0.7
            
            # 生成推荐
            recommendation = self._generate_recommendation(prediction, customer_data)
            
            return round(prediction, 3), round(confidence, 3), recommendation
            
        except Exception as e:
            print(f"预测失败：{e}")
            return 0.5, 0.6, "建议联系客户了解详情"
    
    def _rule_based_prediction(self, customer_data: Dict[str, Any]) -> float:
        """基于规则的预测 (默认方法)"""
        score = 0.5
        
        # 超套加分
        if customer_data.get('近 3 月流量超套', 0) > 0:
            score += 0.15
        if customer_data.get('近 3 月语音超套', 0) > 0:
            score += 0.15
        
        # 高消费加分
        if customer_data.get('月均消费', 79.37) > 100:
            score += 0.1
        
        # 套餐利用率高加分
        monthly_rent = customer_data.get('月租', 59)
        if monthly_rent > 0 and customer_data.get('月均消费', 79.37) / monthly_rent > 1.2:
            score += 0.1
        
        return min(score, 0.95)
    
    def _generate_recommendation(self, prediction: float, customer_data: Dict[str, Any]) -> str:
        """生成推荐建议"""
        if prediction > 0.7:
            return "高意向客户，建议优先联系，推荐 99 元或 129 元套餐"
        elif prediction > 0.5:
            return "中意向客户，建议适时联系，推荐 79 元或 99 元套餐"
        else:
            return "低意向客户，建议暂缓联系或发送短信营销"
    
    def train(self, training_data: pd.DataFrame = None) -> Dict[str, Any]:
        """训练模型"""
        try:
            if training_data is None:
                # 生成模拟训练数据
                training_data = self._generate_training_data()
            
            # 准备特征和标签
            X = training_data[self.feature_columns].values
            y = training_data['意向标签'].values
            
            # 标准化
            X_scaled = self.scaler.fit_transform(X)
            
            # 划分训练集和测试集
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.2, random_state=42, stratify=y
            )
            
            # 训练模型
            self.model = GradientBoostingClassifier(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=42
            )
            self.model.fit(X_train, y_train)
            
            # 评估
            y_pred = self.model.predict(X_test)
            y_pred_proba = self.model.predict_proba(X_test)[:, 1]
            
            metrics = {
                "accuracy": accuracy_score(y_test, y_pred),
                "auc_roc": roc_auc_score(y_test, y_pred_proba),
                "training_samples": len(X_train),
                "test_samples": len(X_test)
            }
            
            # 保存模型
            self.model_path.parent.mkdir(exist_ok=True)
            joblib.dump({
                'model': self.model,
                'scaler': self.scaler,
                'feature_columns': self.feature_columns
            }, self.model_path)
            
            self.is_trained = True
            
            return metrics
            
        except Exception as e:
            print(f"训练失败：{e}")
            return {"error": str(e)}
    
    def _generate_training_data(self, n_samples: int = 10000) -> pd.DataFrame:
        """生成模拟训练数据"""
        np.random.seed(42)
        
        data = {
            '月均消费': np.random.normal(79.37, 39.64, n_samples),
            '月均流量': np.random.normal(12.75, 5.0, n_samples),
            '月均语音': np.random.normal(88.87, 40.0, n_samples),
            '月租': np.random.choice([59, 79, 99, 129, 159], n_samples),
            '套餐利用率': np.random.uniform(0.5, 2.0, n_samples),
            '流量需求指数': np.random.uniform(0.5, 3.0, n_samples),
            '语音需求指数': np.random.uniform(0.5, 3.0, n_samples),
            '超套综合评分': np.random.uniform(0, 3, n_samples),
            '信用分': np.random.normal(70, 15, n_samples)
        }
        
        df = pd.DataFrame(data)
        
        # 生成意向标签 (基于规则)
        intent_score = (
            df['超套综合评分'] * 0.3 +
            df['套餐利用率'] * 0.2 +
            (df['月均消费'] / df['月租']) * 0.2 +
            df['流量需求指数'] * 0.15 +
            df['语音需求指数'] * 0.15
        )
        
        # 归一化到 0-1
        intent_score = (intent_score - intent_score.min()) / (intent_score.max() - intent_score.min())
        
        # 转换为标签 (0: 低意向，1: 高意向)
        df['意向标签'] = (intent_score > 0.5).astype(int)
        
        return df
    
    def load_model(self):
        """加载已训练的模型"""
        try:
            if self.model_path.exists():
                model_data = joblib.load(self.model_path)
                self.model = model_data['model']
                self.scaler = model_data['scaler']
                self.feature_columns = model_data['feature_columns']
                self.is_trained = True
                print("[Model] 模型加载成功")
            else:
                print("[Model] 模型文件不存在，将使用规则引擎")
        except Exception as e:
            print(f"加载模型失败：{e}")


class ConversionPredictor:
    """转化率预测模型"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.model_path = Path("models/conversion_model.pkl")
        self.is_trained = False
    
    def predict(self, customer_data: Dict[str, Any]) -> Tuple[float, float, str]:
        """
        预测转化概率
        返回：(转化概率，置信度，推荐建议)
        """
        try:
            # 提取特征
            features = self._extract_features(customer_data)
            features_scaled = self.scaler.transform(features.reshape(1, -1))
            
            # 预测
            if self.model and self.is_trained:
                conversion_prob = self.model.predict_proba(features_scaled)[0][1]
                confidence = max(self.model.predict_proba(features_scaled)[0])
            else:
                # 使用规则引擎
                conversion_prob = self._rule_based_conversion(customer_data)
                confidence = 0.65
            
            # 生成推荐
            recommendation = self._generate_conversion_recommendation(conversion_prob, customer_data)
            
            return round(conversion_prob, 3), round(confidence, 3), recommendation
            
        except Exception as e:
            print(f"转化预测失败：{e}")
            return 0.3, 0.5, "建议进一步了解客户需求"
    
    def _extract_features(self, customer_data: Dict[str, Any]) -> np.ndarray:
        """提取特征"""
        features = [
            customer_data.get('月均消费', 79.37),
            customer_data.get('月租', 59),
            customer_data.get('近 3 月流量超套', 0),
            customer_data.get('近 3 月语音超套', 0),
            customer_data.get('信用分', 70),
            customer_data.get('月均流量', 12.75),
            customer_data.get('月均语音', 88.87)
        ]
        return np.array(features)
    
    def _rule_based_conversion(self, customer_data: Dict[str, Any]) -> float:
        """基于规则的转化预测"""
        prob = 0.3
        
        # 超套加分
        if customer_data.get('近 3 月流量超套', 0) > 0:
            prob += 0.2
        if customer_data.get('近 3 月语音超套', 0) > 0:
            prob += 0.15
        
        # 高价值客户加分
        if customer_data.get('月均消费', 79.37) > 100:
            prob += 0.1
        
        return min(prob, 0.85)
    
    def _generate_conversion_recommendation(self, prob: float, customer_data: Dict[str, Any]) -> str:
        """生成转化建议"""
        if prob > 0.6:
            return "高转化概率，建议立即联系，成功率较高"
        elif prob > 0.4:
            return "中等转化概率，建议优化话术后联系"
        else:
            return "低转化概率，建议先发送营销短信培养意向"
    
    def train(self, training_data: pd.DataFrame = None) -> Dict[str, Any]:
        """训练模型"""
        try:
            if training_data is None:
                training_data = self._generate_training_data()
            
            # 准备特征
            feature_cols = [
                '月均消费', '月租', '近 3 月流量超套', '近 3 月语音超套',
                '信用分', '月均流量', '月均语音'
            ]
            
            X = training_data[feature_cols].values
            y = training_data['转化标签'].values
            
            # 标准化
            X_scaled = self.scaler.fit_transform(X)
            
            # 划分数据集
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.2, random_state=42
            )
            
            # 训练
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=6,
                random_state=42
            )
            self.model.fit(X_train, y_train)
            
            # 评估
            y_pred = self.model.predict(X_test)
            y_pred_proba = self.model.predict_proba(X_test)[:, 1]
            
            metrics = {
                "accuracy": accuracy_score(y_test, y_pred),
                "auc_roc": roc_auc_score(y_test, y_pred_proba)
            }
            
            # 保存模型
            self.model_path.parent.mkdir(exist_ok=True)
            joblib.dump({
                'model': self.model,
                'scaler': self.scaler
            }, self.model_path)
            
            self.is_trained = True
            
            return metrics
            
        except Exception as e:
            print(f"训练失败：{e}")
            return {"error": str(e)}
    
    def _generate_training_data(self, n_samples: int = 5000) -> pd.DataFrame:
        """生成模拟训练数据"""
        np.random.seed(42)
        
        data = {
            '月均消费': np.random.normal(79.37, 39.64, n_samples),
            '月租': np.random.choice([59, 79, 99, 129], n_samples),
            '近 3 月流量超套': np.random.choice([0, 1, 2, 3], n_samples),
            '近 3 月语音超套': np.random.choice([0, 1, 2, 3], n_samples),
            '信用分': np.random.normal(70, 15, n_samples),
            '月均流量': np.random.normal(12.75, 5.0, n_samples),
            '月均语音': np.random.normal(88.87, 40.0, n_samples)
        }
        
        df = pd.DataFrame(data)
        
        # 生成转化标签
        conversion_score = (
            df['近 3 月流量超套'] * 0.3 +
            df['近 3 月语音超套'] * 0.2 +
            (df['月均消费'] / 100) * 0.3 +
            df['信用分'] / 100 * 0.2
        )
        
        df['转化标签'] = (conversion_score > conversion_score.median()).astype(int)
        
        return df
