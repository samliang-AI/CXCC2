// 测试环境配置
import '@testing-library/jest-dom'

// 模拟Next.js相关的全局对象
global.window = window as any
global.document = document
global.navigator = navigator as any

// 模拟process.env
// NODE_ENV 由 Jest 自动设置，无需手动设置
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'