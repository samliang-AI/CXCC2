/**
 * Auto-refresh hook for dashboard pages
 * Provides auto-refresh functionality with 30-second intervals
 * Optimized for silent background refresh without page flicker
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface UseAutoRefreshOptions {
  enabled: boolean
  refreshInterval?: number // milliseconds, default 30000 (30 seconds)
  fetchData: (range?: { startDate: string; endDate: string }, isAutoRefresh?: boolean) => Promise<void>
  startDate?: string
  endDate?: string
}

export interface UseAutoRefreshReturn {
  autoRefreshEnabled: boolean
  setAutoRefreshEnabled: (enabled: boolean) => void
  refreshCount: number
  lastRefreshTime: Date | null
  isRefreshing: boolean
  toggleAutoRefresh: () => void
  resetRefreshCount: () => void
}

export function useAutoRefresh({
  enabled = true,
  refreshInterval = 30000,
  fetchData,
  startDate,
  endDate,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(enabled)
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const fetchDataRef = useRef(fetchData)
  const startDateRef = useRef(startDate)
  const endDateRef = useRef(endDate)
  const refreshCountRef = useRef(0)
  const isRefreshingRef = useRef(false)

  // Update refs when dependencies change
  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    startDateRef.current = startDate
  }, [startDate])

  useEffect(() => {
    endDateRef.current = endDate
  }, [endDate])

  // Clear interval on unmount or when disabled
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (autoRefreshEnabled && enabled) {
      // Initial refresh when enabled - use refs to avoid triggering re-renders
      const performRefresh = async () => {
        // Don't update isRefreshing state to avoid page flicker
        isRefreshingRef.current = true
        
        try {
          // Pass true to indicate this is an auto-refresh, so page doesn't show loading
          const start = startDateRef.current
          const end = endDateRef.current
          if (start && end) {
            await fetchDataRef.current(
              {
                startDate: start,
                endDate: end,
              },
              true // isAutoRefresh = true
            )
          }
          
          // Only update these states as they don't cause visible changes
          setLastRefreshTime(new Date())
          refreshCountRef.current += 1
          setRefreshCount(refreshCountRef.current)
        } catch (error) {
          console.error('Auto-refresh failed:', error)
        } finally {
          isRefreshingRef.current = false
        }
      }

      // Perform initial refresh
      performRefresh()

      // Set up interval for subsequent refreshes
      intervalRef.current = setInterval(performRefresh, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefreshEnabled, enabled, refreshInterval])

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(prev => !prev)
  }, [])

  const resetRefreshCount = useCallback(() => {
    refreshCountRef.current = 0
    setRefreshCount(0)
    setLastRefreshTime(null)
  }, [])

  const [isRefreshing, setIsRefreshing] = useState(false)
  
  useEffect(() => {
    // Sync ref state with actual refresh operations
    const checkRefreshing = setInterval(() => {
      setIsRefreshing(isRefreshingRef.current)
    }, 100)
    
    return () => clearInterval(checkRefreshing)
  }, [])

  return {
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    refreshCount,
    lastRefreshTime,
    isRefreshing,
    toggleAutoRefresh,
    resetRefreshCount,
  }
}
