# API 路由迁移脚本

$files = @(
    "k:\CXCC2\src\app\(dashboard)\system\teams\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\recordings\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\data\call-logs\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\business-analysis\revenue-dashboard\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\business-analysis\orders\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\reports\team\page.tsx",
    "k:\CXCC2\src\app\(auth)\login\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\layout.tsx",
    "k:\CXCC2\src\app\(dashboard)\quality\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\system\agents\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\reports\type-filter\page.tsx",
    "k:\CXCC2\src\app\(dashboard)\reports\outbound-result\page.tsx",
    "k:\CXCC2\src\app\test-recordings\page.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -Encoding UTF8
        $originalContent = $content
        
        # CXCC API 路由更新
        $content = $content -replace "`/api/cxcc/agents([`"?])", "/api/cxcc?action=agents`$1"
        $content = $content -replace "`/api/cxcc/teams([`"?])", "/api/cxcc?action=teams`$1"
        $content = $content -replace "`/api/cxcc/login([`"?])", "/api/cxcc?action=login`$1"
        $content = $content -replace "`/api/cxcc/recordings([`"?])", "/api/cxcc?action=recordings`$1"
        $content = $content -replace "`/api/cxcc/call-logs/update-local([`"?])", "/api/cxcc?action=call-logs-update`$1"
        $content = $content -replace "`/api/cxcc/recordings/update-local([`"?])", "/api/cxcc?action=recordings-update`$1"
        
        # Local API 路由更新
        $content = $content -replace "`/api/local/agents([`"?])", "/api/local?action=agents`$1"
        $content = $content -replace "`/api/local/teams([`"?])", "/api/local?action=teams`$1"
        $content = $content -replace "`/api/local/call-logs([`"?])", "/api/local?action=call-logs`$1"
        $content = $content -replace "`/api/local/recordings([`"?])", "/api/local?action=recordings`$1"
        
        # Auth API 路由更新
        $content = $content -replace "`/api/auth/login([`"?])", "/api/auth?action=login`$1"
        $content = $content -replace "`/api/auth/logout([`"?])", "/api/auth?action=logout`$1"
        
        # Recordings API 路由更新
        $content = $content -replace "`/api/recordings/success-customers([`"?])", "/api/recordings?action=success-customers`$1"
        
        # Reports API 路由更新
        $content = $content -replace "`/api/reports/outbound-result/statistics([`"?])", "/api/reports?type=outbound-result`$1"
        $content = $content -replace "`/api/reports/team/statistics([`"?])", "/api/reports?type=team`$1"
        $content = $content -replace "`/api/reports/team/agent-daily([`"?])", "/api/reports?type=team-agent-daily`$1"
        $content = $content -replace "`/api/reports/type-filter/statistics([`"?])", "/api/reports?type=type-filter`$1"
        
        if ($content -ne $originalContent) {
            Set-Content $file -Value $content -Encoding UTF8 -NoNewline
            Write-Host "Updated: $file" -ForegroundColor Green
        } else {
            Write-Host "No changes: $file" -ForegroundColor Gray
        }
    } else {
        Write-Host "Not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nMigration completed!" -ForegroundColor Cyan
