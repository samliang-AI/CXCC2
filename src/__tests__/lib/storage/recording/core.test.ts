// 录音存储核心功能测试
import { extractDateFromStartTime, getRecordingFilePath, groupByDate, parseJsonArraySafely } from '@/lib/storage/recording/core'

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  rename: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn()
}))

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/'))
}))

describe('Recording Storage Core', () => {
  describe('extractDateFromStartTime', () => {
    it('should extract date from valid startTime', () => {
      const startTime = '2026-03-22 10:30:00'
      const result = extractDateFromStartTime(startTime)
      expect(result).toBe('2026-03-22')
    })

    it('should return null for invalid startTime', () => {
      const startTime = 'invalid-date'
      const result = extractDateFromStartTime(startTime)
      expect(result).toBeNull()
    })

    it('should return null for null startTime', () => {
      const result = extractDateFromStartTime(null)
      expect(result).toBeNull()
    })
  })

  describe('getRecordingFilePath', () => {
    it('should return path for specific date', () => {
      const date = '2026-03-22'
      const result = getRecordingFilePath(date)
      expect(result).toContain('qms_recording_list_2026-03-22.json')
    })

    it('should return default path for null date', () => {
      const result = getRecordingFilePath(null)
      expect(result).toContain('qms_recording_list_2026-03-22.json')
    })
  })

  describe('groupByDate', () => {
    it('should group recordings by date', () => {
      const recordings = [
        {
          uuid: '1',
          start_time: '2026-03-22 10:00:00',
          company_id: null,
          project_id: null,
          task_id: null,
          agent: null,
          agent_name: null,
          calling_phone: null,
          called_phone: null,
          end_time: null,
          answer_duration: null,
          play_url: null,
          status: null,
          status_name: null,
          quality_status: null,
          sync_time: '',
          updated_at: ''
        },
        {
          uuid: '2',
          start_time: '2026-03-23 11:00:00',
          company_id: null,
          project_id: null,
          task_id: null,
          agent: null,
          agent_name: null,
          calling_phone: null,
          called_phone: null,
          end_time: null,
          answer_duration: null,
          play_url: null,
          status: null,
          status_name: null,
          quality_status: null,
          sync_time: '',
          updated_at: ''
        }
      ]

      const result = groupByDate(recordings)
      expect(result.size).toBe(2)
      expect(result.has('2026-03-22')).toBe(true)
      expect(result.has('2026-03-23')).toBe(true)
      expect(result.get('2026-03-22')?.length).toBe(1)
      expect(result.get('2026-03-23')?.length).toBe(1)
    })

    it('should exclude recordings with null start_time', () => {
      const recordings = [
        {
          uuid: '1',
          start_time: null,
          company_id: null,
          project_id: null,
          task_id: null,
          agent: null,
          agent_name: null,
          calling_phone: null,
          called_phone: null,
          end_time: null,
          answer_duration: null,
          play_url: null,
          status: null,
          status_name: null,
          quality_status: null,
          sync_time: '',
          updated_at: ''
        }
      ]

      const result = groupByDate(recordings)
      expect(result.size).toBe(0)
    })
  })

  describe('parseJsonArraySafely', () => {
    it('should parse valid JSON array', () => {
      const json = '[{"id": 1}, {"id": 2}]'
      const result = parseJsonArraySafely(json)
      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }])
      expect(result.recovered).toBe(false)
    })

    it('should return empty array for empty string', () => {
      const result = parseJsonArraySafely('')
      expect(result.rows).toEqual([])
      expect(result.recovered).toBe(false)
    })

    it('should return empty array for invalid JSON', () => {
      const json = 'invalid json'
      const result = parseJsonArraySafely(json)
      expect(result.rows).toEqual([])
      expect(result.recovered).toBe(false)
    })

    it('should return empty array for non-array JSON', () => {
      const json = '{"id": 1}'
      const result = parseJsonArraySafely(json)
      expect(result.rows).toEqual([])
      expect(result.recovered).toBe(false)
    })
  })
})
