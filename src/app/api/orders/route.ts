import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, access, mkdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json')

// 订单数据缓存
const orderCache = {
  data: null,
  lastModified: 0,
  ttl: 60 * 1000 // 1分钟缓存
}

// 确保数据目录存在
async function ensureDataDir() {
  try {
    await access(DATA_DIR)
  } catch {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

// 读取订单数据
async function readOrders() {
  try {
    // 检查缓存是否有效
    const now = Date.now()
    if (orderCache.data && (now - orderCache.lastModified) < orderCache.ttl) {
      return orderCache.data
    }
    
    await ensureDataDir()
    const data = await readFile(ORDERS_FILE, 'utf-8')
    const orders = JSON.parse(data)
    
    // 更新缓存
    orderCache.data = orders
    orderCache.lastModified = now
    
    return orders
  } catch {
    return []
  }
}

// 保存订单数据
async function saveOrders(orders: any[]) {
  await ensureDataDir()
  await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8')
  
  // 清除缓存
  orderCache.data = null
  orderCache.lastModified = 0
}

// GET - 获取订单（支持筛选和分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 提取筛选参数
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const phone = searchParams.get('phone')
    const businessType = searchParams.get('businessType')
    const city = searchParams.get('city')
    const team = searchParams.get('team')
    
    // 提取分页参数
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    
    const orders = await readOrders()
    
    // 应用筛选
    let filteredOrders = orders
    
    // 日期筛选
    if (date) {
      filteredOrders = filteredOrders.filter((order: any) => {
        const orderDate = order.date ? order.date.split(' ')[0] : ''
        return orderDate === date
      })
    } else if (startDate && endDate) {
      filteredOrders = filteredOrders.filter((order: any) => {
        const orderDate = order.date ? order.date.split(' ')[0] : ''
        return orderDate >= startDate && orderDate <= endDate
      })
    } else if (startDate) {
      filteredOrders = filteredOrders.filter((order: any) => {
        const orderDate = order.date ? order.date.split(' ')[0] : ''
        return orderDate >= startDate
      })
    } else if (endDate) {
      filteredOrders = filteredOrders.filter((order: any) => {
        const orderDate = order.date ? order.date.split(' ')[0] : ''
        return orderDate <= endDate
      })
    }
    
    // 手机号筛选
    if (phone) {
      filteredOrders = filteredOrders.filter((order: any) => 
        order.phone.includes(phone)
      )
    }
    
    // 业务类型筛选
    if (businessType && businessType !== 'all') {
      filteredOrders = filteredOrders.filter((order: any) => 
        order.businessType === businessType
      )
    }
    
    // 项目名称筛选
    if (city && city !== 'all') {
      filteredOrders = filteredOrders.filter((order: any) => 
        order.city === city
      )
    }
    
    // 外呼团队筛选
    if (team && team !== 'all') {
      filteredOrders = filteredOrders.filter((order: any) => 
        order.team === team
      )
    }
    
    // 应用分页
    const total = filteredOrders.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex)
    
    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: paginatedOrders,
      total,
      page,
      pageSize
    })
  } catch (error) {
    console.error('获取订单数据失败:', error)
    return NextResponse.json(
      { error: 'Failed to get orders data' },
      { status: 500 }
    )
  }
}

// PUT - 更新订单（支持单个或批量更新）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const orders = await readOrders()
    
    // 检查是否是批量请求
    if (Array.isArray(body)) {
      // 批量更新
      for (const updatedOrder of body) {
        const index = orders.findIndex((order: any) => order.id === updatedOrder.id)
        if (index !== -1) {
          orders[index] = updatedOrder
        }
      }
      await saveOrders(orders)
      
      return NextResponse.json({
        code: 0,
        message: `Successfully updated ${body.length} orders`,
        data: body
      })
    } else {
      // 单个订单更新
      const updatedOrder = body
      const index = orders.findIndex((order: any) => order.id === updatedOrder.id)
      if (index === -1) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        )
      }
      
      orders[index] = updatedOrder
      await saveOrders(orders)
      
      return NextResponse.json({
        code: 0,
        message: 'Order updated successfully',
        data: updatedOrder
      })
    }
  } catch (error) {
    console.error('更新订单失败:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

// DELETE - 删除订单
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }
    
    const orders = await readOrders()
    const filteredOrders = orders.filter((order: any) => order.id !== id)
    
    if (filteredOrders.length === orders.length) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    
    await saveOrders(filteredOrders)
    
    return NextResponse.json({
      code: 0,
      message: 'Order deleted successfully'
    })
  } catch (error) {
    console.error('删除订单失败:', error)
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    )
  }
}

// POST - 添加订单（支持批量）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 检查是否是批量请求
    if (Array.isArray(body)) {
      // 批量添加订单
      const orders = await readOrders()
      const newOrders: any[] = []
      
      for (const orderData of body) {
        // 检查是否已存在
        const isDuplicate = orders.some((order: any) => order.phone === orderData.phone)
        if (!isDuplicate) {
          const newId: string = String(orders.length + newOrders.length + 1).padStart(4, '0')
          const orderWithId = {
            ...orderData,
            id: newId
          }
          newOrders.push(orderWithId)
        }
      }
      
      const updatedOrders = [...orders, ...newOrders]
      await saveOrders(updatedOrders)
      
      return NextResponse.json({
        code: 0,
        message: `Successfully added ${newOrders.length} orders`,
        data: newOrders
      })
    } else {
      // 单个订单添加
      const newOrder = body
      const orders = await readOrders()
      
      // 生成新ID
      const newId = String(orders.length + 1).padStart(4, '0')
      const orderWithId = {
        ...newOrder,
        id: newId
      }
      
      orders.push(orderWithId)
      await saveOrders(orders)
      
      return NextResponse.json({
        code: 0,
        message: 'Order added successfully',
        data: orderWithId
      })
    }
  } catch (error) {
    console.error('添加订单失败:', error)
    return NextResponse.json(
      { error: 'Failed to add order' },
      { status: 500 }
    )
  }
}
