# smoke_edge_functions.ps1 — NEXUS AI Supabase Edge Function Smoke Tests
# Run from project root: pwsh -File .\smoke_edge_functions.ps1

$SUPABASE_URL = "https://lzaxqfxwgnqhrbhfbjai.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6YXhxZnh3Z25xaHJiaGZiamFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzkyNDUsImV4cCI6MjA4Nzc1NTI0NX0.R-ZnbEh1sk5DiiLvhVpq9eJkgjzBU5E78V48Ut009Jc"

$headers = @{
    "Authorization" = "Bearer $ANON_KEY"
    "Content-Type"  = "application/json"
}

$pass = 0
$fail = 0
$skip = 0

function Test-Fn {
    param([string]$Name, [string]$Url, [string]$Body, [string]$ExpectField)
    Write-Host ""
    Write-Host "--- $Name" -ForegroundColor Cyan
    try {
        $resp = Invoke-RestMethod -Uri $Url -Method POST -Headers $headers -Body $Body -TimeoutSec 30 -ErrorAction Stop
        if ($ExpectField -and $null -eq $resp.$ExpectField) {
            Write-Host "  FAIL — field '$ExpectField' missing" -ForegroundColor Red
            Write-Host "  Got: $($resp | ConvertTo-Json -Depth 2 -Compress)" -ForegroundColor DarkGray
            $script:fail++
        } else {
            $preview = ($resp | ConvertTo-Json -Depth 2 -Compress)
            if ($preview.Length -gt 200) { $preview = $preview.Substring(0, 200) + "..." }
            Write-Host "  PASS $preview" -ForegroundColor Green
            $script:pass++
        }
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 404) {
            Write-Host "  SKIP — not deployed (404)" -ForegroundColor Yellow
            $script:skip++
        } else {
            Write-Host "  FAIL — HTTP $status : $($_.Exception.Message)" -ForegroundColor Red
            $script:fail++
        }
    }
}

Write-Host "=================================================="
Write-Host "  NEXUS AI — Edge Function Smoke Tests"
Write-Host "=================================================="

Test-Fn -Name "veritas-runner" `
    -Url "$SUPABASE_URL/functions/v1/veritas-runner" `
    -Body '{"criticalModules":["src/stores/OrchestratorStore.ts"],"projectModules":["src/stores/OrchestratorStore.ts"]}' `
    -ExpectField "exitCode"

Test-Fn -Name "code-executor (run)" `
    -Url "$SUPABASE_URL/functions/v1/code-executor" `
    -Body '{"code":"console.log(2+2);","language":"javascript","mode":"run"}' `
    -ExpectField "stdout"

Test-Fn -Name "code-executor (test)" `
    -Url "$SUPABASE_URL/functions/v1/code-executor" `
    -Body '{"code":"test(\"math\", () => { if (2+2!==4) throw new Error(\"fail\"); });","language":"javascript","mode":"test"}' `
    -ExpectField "tests_passed"

Test-Fn -Name "file-writer (reachability)" `
    -Url "$SUPABASE_URL/functions/v1/file-writer" `
    -Body '{"owner":"x","repo":"x","path":"x.md","content":"hi","message":"test","token":"invalid"}' `
    -ExpectField $null

Test-Fn -Name "deploy-trigger (reachability)" `
    -Url "$SUPABASE_URL/functions/v1/deploy-trigger" `
    -Body '{"provider":"netlify","hook_url":"https://httpbin.org/status/200"}' `
    -ExpectField "triggered"

Write-Host ""
Write-Host "=================================================="
Write-Host "  PASS : $pass" -ForegroundColor Green
Write-Host "  FAIL : $fail" -ForegroundColor Red
Write-Host "  SKIP : $skip  (not deployed on Supabase)" -ForegroundColor Yellow
Write-Host "=================================================="

if ($fail -gt 0) { exit 1 }
