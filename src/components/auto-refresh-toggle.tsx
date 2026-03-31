'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw, Clock } from 'lucide-react'

interface AutoRefreshToggleProps {
  enabled: boolean
  onToggle: () => void
  refreshCount?: number
  lastRefreshTime?: Date | null
  isRefreshing?: boolean
  showDetails?: boolean
}

export function AutoRefreshToggle({
  enabled,
  onToggle,
  refreshCount = 0,
  lastRefreshTime = null,
  isRefreshing = false,
  showDetails = true,
}: AutoRefreshToggleProps) {
  const formatTime = (date: Date | null) => {
    if (!date) return '从未刷新'
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  const getTimeAgo = (date: Date | null) => {
    if (!date) return ''
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 5) return '刚刚'
    if (diff < 60) return `${diff}秒前`
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    return `${Math.floor(diff / 3600)}小时前`
  }

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Switch
                checked={enabled}
                onCheckedChange={onToggle}
                id="auto-refresh-toggle"
              />
              <label
                htmlFor="auto-refresh-toggle"
                className="text-sm font-medium cursor-pointer select-none"
              >
                自动刷新
              </label>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>开启后每 30 秒自动刷新数据</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showDetails && enabled && (
        <>
          {isRefreshing && (
            <Badge variant="secondary" className="animate-pulse">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              刷新中...
            </Badge>
          )}
          
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {refreshCount}次
          </Badge>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs cursor-help">
                  {formatTime(lastRefreshTime)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>上次刷新：{formatTime(lastRefreshTime)} ({getTimeAgo(lastRefreshTime)})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  )
}
