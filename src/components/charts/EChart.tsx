// ECharts 图表组件
'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface ChartProps {
  option: echarts.EChartsOption
  width?: string | number
  height?: string | number
}

export function EChart({ option, width = '100%', height = '400px' }: ChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    // 初始化图表
    chartInstance.current = echarts.init(chartRef.current)

    // 设置配置项
    chartInstance.current.setOption(option)

    // 响应式调整
    const handleResize = () => {
      chartInstance.current?.resize()
    }

    window.addEventListener('resize', handleResize)

    // 清理
    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
    }
  }, [option])

  return (
    <div
      ref={chartRef}
      style={{ width, height }}
      className="w-full"
    />
  )
}

// 套餐分布柱状图
export function PackageDistributionChart({ data }: { data: any[] }) {
  const option: echarts.EChartsOption = {
    title: {
      text: '套餐价格分布',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: '{b}: {c}人 ({d}%)'
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.range),
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '人数'
    },
    series: [
      {
        name: '客户数',
        type: 'bar',
        data: data.map(item => ({
          value: item.count,
          itemStyle: {
            color: getColorByRange(item.range)
          }
        })),
        label: {
          show: true,
          position: 'top',
          formatter: '{c}\n{d}%'
        }
      }
    ]
  }

  return <EChart option={option} height="350px" />
}

// 客户分层饼图
export function CustomerSegmentsChart({ data }: { data: any }) {
  const chartData = [
    { value: data.highValue.count, name: '高价值客户', itemStyle: { color: '#ef4444' } },
    { value: data.mediumValue.count, name: '中等价值客户', itemStyle: { color: '#f59e0b' } },
    { value: data.lowValue.count, name: '低价值客户', itemStyle: { color: '#3b82f6' } }
  ]

  const option: echarts.EChartsOption = {
    title: {
      text: '客户价值分层',
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}人 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '客户分层',
        type: 'pie',
        radius: '60%',
        data: chartData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          formatter: '{b}\n{d}%'
        }
      }
    ]
  }

  return <EChart option={option} height="350px" />
}

// 需求信号仪表盘
export function DemandSignalGauge({ value, name }: { value: number; name: string }) {
  const option: echarts.EChartsOption = {
    title: {
      text: name,
      left: 'center',
      top: '60%'
    },
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 5,
        itemStyle: {
          color: value > 25 ? '#ef4444' : value > 15 ? '#f59e0b' : '#22c55e'
        },
        progress: {
          show: true,
          width: 18
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 18
          }
        },
        axisTick: {
          show: false
        },
        splitLine: {
          length: 15,
          lineStyle: {
            width: 2,
            color: '#999'
          }
        },
        axisLabel: {
          distance: 25,
          color: '#999',
          fontSize: 10
        },
        anchor: {
          show: false
        },
        data: [
          {
            value: value,
            name: value.toFixed(1) + '%'
          }
        ],
        detail: {
          show: false
        }
      }
    ]
  }

  return <EChart option={option} height="200px" />
}

// 数据质量雷达图
export function DataQualityRadar({ data }: { data: any[] }) {
  const indicator = data.map(field => ({
    name: field.name,
    max: 100
  }))

  const seriesData = data.map(field => 100 - field.missing)

  const option: echarts.EChartsOption = {
    title: {
      text: '数据完整性分析',
      left: 'center'
    },
    tooltip: {},
    radar: {
      indicator: indicator,
      radius: '65%'
    },
    series: [
      {
        name: '数据完整性',
        type: 'radar',
        data: [
          {
            value: seriesData,
            name: '完整性',
            areaStyle: {
              color: 'rgba(59, 130, 246, 0.3)'
            },
            lineStyle: {
              color: '#3b82f6'
            },
            itemStyle: {
              color: '#3b82f6'
            }
          }
        ]
      }
    ]
  }

  return <EChart option={option} height="350px" />
}

// 趋势折线图
export function TrendLineChart({ data }: { data: any[] }) {
  const option: echarts.EChartsOption = {
    title: {
      text: '消费趋势分析',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.date)
    },
    yAxis: {
      type: 'value',
      name: 'ARPU (元)'
    },
    series: [
      {
        name: '月均消费',
        type: 'line',
        data: data.map(item => item.value),
        smooth: true,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.01)' }
          ])
        },
        lineStyle: {
          color: '#3b82f6',
          width: 3
        },
        itemStyle: {
          color: '#3b82f6'
        }
      }
    ]
  }

  return <EChart option={option} height="300px" />
}

// 辅助函数：根据价格区间返回颜色
function getColorByRange(range: string): string {
  const colors: Record<string, string> = {
    '59 元以下': '#22c55e',
    '59-79 元': '#84cc16',
    '79-99 元': '#f59e0b',
    '99-129 元': '#f97316',
    '129 元以上': '#ef4444'
  }
  return colors[range] || '#3b82f6'
}
