#requires -Version 7.0
<#
.SYNOPSIS
檢查 Herdr 更新後的自訂模組、版面與備份。
.PARAMETER UpdateBaseline
重新建立官方檔案雜湊基準；請在確認並重新套用自訂改動後使用。
.PARAMETER BaselinePath
測試用基準檔路徑；預設為腳本旁的 official-baseline.json。
#>
[CmdletBinding()]
param(
    [switch]$UpdateBaseline,
    [Parameter(DontShow)][string]$BaselinePath = (Join-Path $PSScriptRoot 'official-baseline.json')
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$results = [Collections.Generic.List[object]]::new()
$herdrRoot = Join-Path $env:USERPROFILE '.config/herdr-app'
$repoRoot = Split-Path -Parent $PSScriptRoot
$mods = @('git-graph', 'git-diff', 'my-tabs', 'my-pane')
$excluded = @('gpui-kit.d.ts', 'jsconfig.json')

function Add-Result([string]$Level, [string]$Name, [string]$Message) {
    $results.Add([pscustomobject]@{ Level=$Level; Name=$Name; Message=$Message })
    Write-Host "$Level $Name：$Message"
}

function Invoke-ReadOnlyProcess([string]$Executable, [string[]]$Arguments) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.WorkingDirectory = $repoRoot
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw '無法啟動檢查程序。' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(60000)) {
            $process.Kill($true)
            $process.WaitForExit()
            throw '檢查超過 60 秒，已停止本次檢查程序。'
        }
        return @{ Code=$process.ExitCode; Out=$stdout.GetAwaiter().GetResult(); Err=$stderr.GetAwaiter().GetResult() }
    } finally { $process.Dispose() }
}

function Get-Hashes([string]$Root, [string[]]$RelativePaths) {
    $hashes = [ordered]@{}
    foreach ($relative in $RelativePaths) {
        $target = Join-Path $Root $relative
        if (-not (Test-Path -LiteralPath $target)) { throw "找不到檔案或資料夾：$target" }
        $files = if (Test-Path -LiteralPath $target -PathType Container) {
            @(Get-ChildItem -LiteralPath $target -Recurse -File -Force)
        } else { @(Get-Item -LiteralPath $target) }
        foreach ($file in ($files | Sort-Object FullName)) {
            if ($file.Name -in $excluded) { continue }
            $key = [IO.Path]::GetRelativePath($Root, $file.FullName).Replace('\', '/')
            $hashes[$key] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        }
    }
    return ,$hashes
}

function Compare-Hashes($Before, $After) {
    foreach ($path in (@(@($Before.Keys) + @($After.Keys)) | Sort-Object -Unique)) {
        if (-not $Before.Contains($path)) { [pscustomobject]@{Path=$path; Change='新增'} }
        elseif (-not $After.Contains($path)) { [pscustomobject]@{Path=$path; Change='刪除'} }
        elseif ($Before[$path] -cne $After[$path]) { [pscustomobject]@{Path=$path; Change='變更'} }
    }
}

$herdr = Get-Command herdr-app -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $herdr) {
    Add-Result '❌' 'Herdr 狀態' '找不到 herdr-app，請確認已安裝且已加入 PATH。'
} else {
    try {
        $result = Invoke-ReadOnlyProcess $herdr.Source @('status')
        try { $state = ConvertFrom-Json -InputObject $result.Out -AsHashtable }
        catch { throw "無法取得狀態 JSON；Herdr 可能未執行或無法連線。診斷：$($result.Err) $($result.Out)" }
        if ($result.Code -ne 0 -or -not $state.Contains('errors') -or -not $state.Contains('layout') -or $null -eq $state.errors -or $state.errors -isnot [array]) {
            throw 'Herdr 可能未執行，或狀態回應缺少有效的 errors／layout。'
        }
        if ($state.errors.Count) { throw "Herdr 回報錯誤：$($state.errors | ConvertTo-Json -Depth 20 -Compress)" }
        if ($state.layout -ne 'my-main') { Add-Result '⚠️' 'Herdr 狀態' "無錯誤，目前版面為 $($state.layout)，並非 my-main。" }
        else { Add-Result '✅' 'Herdr 狀態' '正在使用 my-main，錯誤清單為空。' }
    } catch { Add-Result '❌' 'Herdr 狀態' $_.Exception.Message }
}

foreach ($mod in $mods) {
    try {
        if (-not $herdr) { throw '無法執行：找不到 herdr-app。' }
        $folder = Join-Path $herdrRoot "mods/$mod"
        if (-not (Test-Path -LiteralPath $folder -PathType Container)) { throw "找不到模組：$folder" }
        $result = Invoke-ReadOnlyProcess $herdr.Source @('check', $folder)
        $output = $result.Out + $result.Err
        if ($result.Code -ne 0 -or $output -notmatch 'check passed') { throw "模組檢查未通過（結束碼 $($result.Code)）。診斷：$output" }
        Add-Result '✅' "模組 $mod" '檢查通過（已確認 check passed）。'
    } catch { Add-Result '❌' "模組 $mod" $_.Exception.Message }
}

$cloneVersion = $null
try {
    $layout = Get-Content -Raw -LiteralPath (Join-Path $herdrRoot 'layouts/my-main.json') | ConvertFrom-Json -AsHashtable
    if ($layout -isnot [Collections.IDictionary]) { throw '版面 JSON 必須為物件。' }
    if ($layout.Contains('cloned_from')) { $cloneVersion = $layout.cloned_from.version }
    Add-Result '✅' '版面 JSON' 'my-main.json 格式合法。'
} catch { Add-Result '❌' '版面 JSON' $_.Exception.Message }
try {
    $errorFiles = @(Get-ChildItem -LiteralPath $herdrRoot -Filter '*.error' -File -Recurse -Force)
    if ($errorFiles.Count) {
        foreach ($file in $errorFiles) { Write-Host "錯誤檔案：$($file.FullName)"; Write-Host (Get-Content -Raw -LiteralPath $file.FullName) }
        Add-Result '❌' '錯誤檔案' "發現 $($errorFiles.Count) 個錯誤檔案，內容如上。"
    } else { Add-Result '✅' '錯誤檔案' '未發現 layout.error 或其他 *.error。' }
} catch { Add-Result '❌' '錯誤檔案' $_.Exception.Message }

try {
    $official = Get-Hashes $herdrRoot @('layouts/main.json','mods/tabs','mods/pane')
    if ($UpdateBaseline -or -not (Test-Path -LiteralPath $BaselinePath)) {
        $baseline = [ordered]@{ generated_at=[DateTimeOffset]::Now.ToString('o'); cloned_from_version=$cloneVersion; files=$official }
        $json = ConvertTo-Json -InputObject $baseline -Depth 6
        # 唯一寫入位置；不複製官方檔案內容，也不改動 Herdr 設定。
        [IO.File]::WriteAllText([IO.Path]::GetFullPath($BaselinePath), $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
        $action = if ($UpdateBaseline) { '已重新建立' } else { '首次執行，已自動建立' }
        Add-Result '✅' '官方檔案基準' "$action $BaselinePath；記錄 $($official.Count) 個檔案雜湊。"
    } else {
        $baseline = Get-Content -Raw -LiteralPath $BaselinePath | ConvertFrom-Json -AsHashtable
        if (-not $baseline.Contains('files') -or $baseline.files -isnot [Collections.IDictionary] -or -not $baseline.files.Count) { throw '基準檔格式不正確：缺少檔案雜湊。' }
        $changes = @(Compare-Hashes $baseline.files $official)
        if ($changes.Count) {
            foreach ($change in $changes) { Write-Host "官方檔案$($change.Change)：$($change.Path)" }
            foreach ($group in @('layouts/main.json','mods/tabs/','mods/pane/')) {
                if (@($changes | Where-Object { $_.Path.StartsWith($group) }).Count) {
                    $command = if ($group -eq 'layouts/main.json') { 'layout.clone' } else { 'mod.clone' }
                    Write-Host "官方 $group 已更新，若想取得新功能，需重新 $command 並套用 README 記載的改動。"
                }
            }
            Add-Result '⚠️' '官方檔案基準' "已讀取既有基準，發現 $($changes.Count) 項差異；僅提醒，不算失敗。"
        } else { Add-Result '✅' '官方檔案基準' "已讀取既有基準，$($official.Count) 個官方檔案均無變動。" }
    }
} catch { Add-Result '❌' '官方檔案基準' $_.Exception.Message }

try {
    $custom = @('layouts/my-main.json') + @($mods | ForEach-Object { "mods/$_" })
    $installed = Get-Hashes $herdrRoot $custom
    $backup = Get-Hashes $PSScriptRoot $custom
    $differences = @(Compare-Hashes $backup $installed)
    if ($differences.Count) {
        foreach ($difference in $differences) { Write-Host "相較 repo 備份，Herdr 自訂檔案$($difference.Change)：$($difference.Path)" }
        Add-Result '⚠️' '備份一致性' "共 $($differences.Count) 項差異，請確認後同步備份；不算失敗。"
    } else { Add-Result '✅' '備份一致性' "$($installed.Count) 個自訂檔案與 repo 備份一致。" }
} catch { Add-Result '⚠️' '備份一致性' "無法完成比對，請確認備份是否完整：$($_.Exception.Message)" }

$node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $node) { Add-Result '⚠️' 'Node 測試' '找不到 node，已略過測試。' }
else {
    foreach ($test in @(
        @{Name='圖表檔案清單測試'; Arguments=@((Join-Path $PSScriptRoot 'mods/git-graph/files.test.mjs'),$repoRoot)},
        @{Name='差異解析測試'; Arguments=@((Join-Path $PSScriptRoot 'mods/git-diff/diff.test.mjs'))}
    )) {
        try {
            $result = Invoke-ReadOnlyProcess $node.Source $test.Arguments
            if ($result.Code -ne 0) { throw "測試失敗（結束碼 $($result.Code)）。診斷：$($result.Out) $($result.Err)" }
            Add-Result '✅' $test.Name '測試通過。'
        } catch { Add-Result '❌' $test.Name $_.Exception.Message }
    }
}
Write-Host "`n檢查摘要："
foreach ($result in $results) { Write-Host "$($result.Level) $($result.Name)：$($result.Message)" }
$failures = @($results | Where-Object Level -eq '❌').Count
$warnings = @($results | Where-Object Level -eq '⚠️').Count
Write-Host "合計：$failures 項失敗，$warnings 項提醒。"
if ($failures) {
    Write-Host '暫時恢復方式：可按 ctrl-shift-l 切回官方 main 版面；本腳本不會自動切換版面或修改設定。'
    exit 1
}
exit 0
