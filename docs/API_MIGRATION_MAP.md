# API 路由映射表

## CXCC API
- `/api/cxcc/agents` → `/api/cxcc?action=agents`
- `/api/cxcc/teams` → `/api/cxcc?action=teams`
- `/api/cxcc/login` → `/api/cxcc?action=login`
- `/api/cxcc/recordings` → `/api/cxcc?action=recordings`
- `/api/cxcc/call-logs` → `/api/cxcc?action=call-logs`
- `/api/cxcc/call-logs/update-local` → `/api/cxcc?action=call-logs-update`
- `/api/cxcc/recordings/update-local` → `/api/cxcc?action=recordings-update`

## Local API
- `/api/local/agents` → `/api/local?action=agents`
- `/api/local/teams` → `/api/local?action=teams`
- `/api/local/call-logs` → `/api/local?action=call-logs`
- `/api/local/recordings` → `/api/local?action=recordings`

## Auth API
- `/api/auth/login` → `/api/auth?action=login`
- `/api/auth/logout` → `/api/auth?action=logout`

## Recordings API
- `/api/recordings` → `/api/recordings?action=list`
- `/api/recordings/success-customers` → `/api/recordings?action=success-customers`

## Reports API
- `/api/reports/outbound-result/statistics` → `/api/reports?type=outbound-result`
- `/api/reports/team/statistics` → `/api/reports?type=team`
- `/api/reports/team/agent-daily` → `/api/reports?type=team-agent-daily`
- `/api/reports/type-filter/statistics` → `/api/reports?type=type-filter`
