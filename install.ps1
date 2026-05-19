# Claude StatusLine Installation Script for Windows
# Enhanced version with bug fixes for Windows environment
# Author: Modified for Windows UTF-8 support
# Version: 1.0.1

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Claude StatusLine Installer" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "[1/5] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python not found!" -ForegroundColor Red
    Write-Host "  Please install Python from https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}

# Install keyring package
Write-Host ""
Write-Host "[2/5] Installing keyring package..." -ForegroundColor Yellow
try {
    pip install keyring | Out-Null
    Write-Host "  keyring package installed successfully" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Failed to install keyring. Rate limits may not work." -ForegroundColor Yellow
}

# Create directory structure
Write-Host ""
Write-Host "[3/5] Creating directory structure..." -ForegroundColor Yellow
$claudeDir = "$env:USERPROFILE\.claude\scripts"
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
Write-Host "  Created: $claudeDir" -ForegroundColor Green

# Copy Python scripts
Write-Host ""
Write-Host "[4/5] Installing Python scripts..." -ForegroundColor Yellow
$scriptDir = $PSScriptRoot

Copy-Item "$scriptDir\context-bar.py" -Destination "$claudeDir\context-bar.py" -Force
Write-Host "  Installed: context-bar.py" -ForegroundColor Green

Copy-Item "$scriptDir\update-usage-cache.py" -Destination "$claudeDir\update-usage-cache.py" -Force
Write-Host "  Installed: update-usage-cache.py" -ForegroundColor Green

# Update settings.json
Write-Host ""
Write-Host "[5/5] Updating Claude Code settings..." -ForegroundColor Yellow
$settingsPath = "$env:USERPROFILE\.claude\settings.json"

if (Test-Path $settingsPath) {
    # Read existing settings
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    
    # Add or update statusLine configuration
    $settings | Add-Member -NotePropertyName "statusLine" -NotePropertyValue @{
        type = "command"
        command = "python $($env:USERPROFILE)\.claude\scripts\context-bar.py".Replace("\", "/")
    } -Force
    
    # Save updated settings
    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
    Write-Host "  Updated: settings.json" -ForegroundColor Green
} else {
    # Create new settings file
    $newSettings = @{
        statusLine = @{
            type = "command"
            command = "python $($env:USERPROFILE)\.claude\scripts\context-bar.py".Replace("\", "/")
        }
    }
    $newSettings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
    Write-Host "  Created: settings.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart Claude Code" -ForegroundColor White
Write-Host "2. The status line should appear at the bottom" -ForegroundColor White
Write-Host ""
Write-Host "Troubleshooting:" -ForegroundColor Yellow
Write-Host "- If rate limits show '?%', check:" -ForegroundColor White
Write-Host "  * You are logged into Claude Code" -ForegroundColor White
Write-Host "  * keyring is installed: pip install keyring" -ForegroundColor White
Write-Host "- Check logs at: $env:USERPROFILE\.claude\statusline.log" -ForegroundColor White
Write-Host "               : $env:USERPROFILE\.claude\usage_update.log" -ForegroundColor White
Write-Host ""
