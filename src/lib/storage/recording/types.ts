// 录音数据类型定义
export type LocalRecordingRow = {
  uuid: string
  company_id: number | null
  project_id: number | null
  task_id: number | null
  agent: string | null
  agent_name: string | null
  calling_phone: string | null
  called_phone: string | null
  start_time: string | null
  end_time: string | null
  answer_duration: number | null
  play_url: string | null
  status: number | null
  status_name: string | null
  quality_status: number | null
  sync_time: string
  updated_at: string
}

export type RecordingStorageStats = {
  totalFiles: number
  totalRows: number
  dateRange: {
    earliest: string | null
    latest: string | null
  }
  fileSize: number
}

export type MigrationResult = {
  migrated: boolean
  fileCount: number
  totalRows: number
}

export type CleanupResult = {
  deletedFiles: number
  deletedRows: number
}

export type RecordingReadOptions = {
  startDate?: string
  endDate?: string
  batchSize?: number
}

export type UpsertOptions = {
  batchSize?: number
  writeBatchSize?: number
  onlyAddNew?: boolean
}