param(
    [int]$IntervalSeconds = 60
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Starting Auto-Sync for Gridly-Desktop" -ForegroundColor Green
Write-Host " Syncing every $IntervalSeconds seconds." -ForegroundColor Yellow
Write-Host " Keep this window open to continue syncing." -ForegroundColor Yellow
Write-Host " Press Ctrl+C to stop." -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

while ($true) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$timestamp] Checking for updates..." -ForegroundColor Gray
    
    # Fetch and pull changes from GitHub (auto update local)
    git pull origin main --rebase
    
    # Check if there are local changes
    $status = git status --porcelain
    if ($status) {
        Write-Host "[$timestamp] Local changes detected. Syncing to GitHub..." -ForegroundColor Yellow
        git add .
        git commit -m "Auto sync from local on $timestamp"
        git push origin main
        Write-Host "[$timestamp] Successfully synced to GitHub." -ForegroundColor Green
    } else {
        # Optional: uncomment the next line to see a message when there are no changes
        # Write-Host "[$timestamp] No local changes to push." -ForegroundColor DarkGray
    }
    
    Start-Sleep -Seconds $IntervalSeconds
}
