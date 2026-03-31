import defaultProjectIdNameMap from '@/config/project-id-name-map.json'

type ProjectIdNameMap = Record<string, string>

function parseEnvMap(): ProjectIdNameMap {
  const raw = process.env.PROJECT_ID_NAME_MAP
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: ProjectIdNameMap = {}
    for (const [k, v] of Object.entries(parsed)) {
      const key = String(k).trim()
      const value = String(v ?? '').trim()
      if (!key || !value) continue
      result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

function normalizeProjectId(projectId: unknown): string {
  const text = String(projectId ?? '').trim()
  if (!text) return ''
  const num = Number(text)
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    return String(Math.trunc(num))
  }
  return text
}

export function getProjectIdNameMap(): ProjectIdNameMap {
  return {
    ...(defaultProjectIdNameMap as ProjectIdNameMap),
    ...parseEnvMap(),
  }
}

export function resolveProjectName(projectId: unknown, map = getProjectIdNameMap()): string {
  const key = normalizeProjectId(projectId)
  if (!key) return '未知项目'
  return map[key] || '未知项目'
}

export function formatProjectDisplay(projectId: unknown, map = getProjectIdNameMap()): string {
  const key = normalizeProjectId(projectId)
  const name = resolveProjectName(projectId, map)
  return key ? `${name}(${key})` : name
}
