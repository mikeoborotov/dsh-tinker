#requires -Version 7.4
<#
Start/Stop only the owned Tinker demo. Invoke with installed PowerShell 7,
-NoProfile -File (never ExecutionPolicy/Bypass). Review before first execution.
The supervisor stays resident until the demo window closes or Stop is requested.
It never installs software, attaches to a browser, discovers PIDs or kills by name.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Start', 'Stop')][string]$Action,
    [Parameter(Mandatory)][string]$Root
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-PlainPath([string]$Path, [switch]$MayBeMissing) {
    if ($Path -notmatch '^[A-Za-z]:[\\/]') { throw 'invalid-path' }
    $invalidParts = @($Path.Substring(3).Split([char[]]'\/') | Where-Object {
        $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' -or $_ -match '[. ]$' -or $_ -ieq '.env'
    })
    if ($Path.Substring(2).Contains(':') -or $Path -match '[\x00-\x1f<>"|?*]' -or $invalidParts.Count -gt 0) { throw 'invalid-path' }
    $full = [IO.Path]::GetFullPath($Path)
    $current = [IO.Path]::GetPathRoot($full)
    foreach ($part in $full.Substring($current.Length).Split('\')) {
        $current = [IO.Path]::Combine($current, $part)
        try { $attributes = [IO.File]::GetAttributes($current) }
        catch [IO.FileNotFoundException] { if ($MayBeMissing) { return }; throw 'required-path-missing' }
        catch [IO.DirectoryNotFoundException] { if ($MayBeMissing) { return }; throw 'required-path-missing' }
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse-path-forbidden' }
    }
}
function Read-PrivateJson([string]$Path) {
    Assert-PlainPath $Path
    if (([IO.FileInfo]::new($Path)).Length -gt 32768) { throw 'metadata-size-invalid' }
    return (ConvertFrom-Json -AsHashtable -InputObject ([IO.File]::ReadAllText($Path)))
}
function Write-JsonNew([string]$Path, $Value) {
    Assert-PlainPath $Path -MayBeMissing
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes((ConvertTo-Json -Depth 8 -Compress -InputObject $Value) + "`n")
    $file = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $file.Write($bytes, 0, $bytes.Length); $file.Flush($true) } finally { $file.Dispose() }
}
function Assert-LeaseOwner($Owner, [string]$LeaseName) {
    if ($Owner.schema -ne 1 -or $Owner.tool -cne 'dsh-tinker-manual-supervisor' -or
        $Owner.root -cne $Root -or $Owner.lease -cne $LeaseName) { throw 'manual-lease-owner-invalid' }
}
function New-ChildEnvironment {
    # Exact fresh 54-key allowlist, matching demoEnvironment() in the controller.
    # Never spread/copy the supervisor's own ambient environment.
    $h = [IO.Path]::Combine($Root, 'oshome')
    $pm = [IO.Path]::Combine($Root, 'package-manager')
    return @{
        SYSTEMROOT='C:\Windows'; WINDIR='C:\Windows'; COMSPEC='C:\Windows\System32\cmd.exe'
        PATH='C:\Program Files\nodejs;C:\Windows\System32;C:\Windows;C:\Windows\System32\WindowsPowerShell\v1.0'; PATHEXT='.COM;.EXE;.BAT;.CMD'
        USERPROFILE=$h; HOME=$h; HOMEDRIVE='C:'; HOMEPATH=$h.Substring(2)
        APPDATA="$h\AppData\Roaming"; LOCALAPPDATA="$h\AppData\Local"
        TEMP="$Root\temp"; TMP="$Root\temp"; TMPDIR="$Root\temp"
        DSH_HOME="$Root\home"; DSH_AGENTS_HOME="$Root\agents"; DSH_TELEMETRY_DISABLED='1'
        XDG_CONFIG_HOME="$h\.config"; XDG_DATA_HOME="$h\.local\share"; XDG_CACHE_HOME="$h\.cache"
        XDG_STATE_HOME="$h\.local\state"; XDG_RUNTIME_DIR="$h\.runtime"; NARB_NATIVE_CACHE_DIR="$Root\native-cache"
        LANG='en_US.UTF-8'; TZ='UTC'
        NPM_CONFIG_USERCONFIG="$pm\user.npmrc"; NPM_CONFIG_GLOBALCONFIG="$pm\global.npmrc"; NPM_CONFIG_CACHE="$pm\cache"
        NPM_CONFIG_OFFLINE='true'; NPM_CONFIG_IGNORE_SCRIPTS='true'; NPM_CONFIG_IGNORE_PNPMFILE='true'
        PNPM_CONFIG_OFFLINE='true'; PNPM_CONFIG_IGNORE_SCRIPTS='true'; PNPM_CONFIG_IGNORE_PNPMFILE='true'
        PNPM_CONFIG_CACHE_DIR="$pm\cache"; PNPM_CONFIG_STORE_DIR="$pm\store"; PNPM_CONFIG_STATE_DIR="$pm\state"
        PNPM_CONFIG_GLOBAL_DIR="$pm\global"; PNPM_CONFIG_GLOBAL_BIN_DIR="$pm\pnpm-home"
        NPM_CONFIG_AUDIT='false'; NPM_CONFIG_FUND='false'; NPM_CONFIG_UPDATE_NOTIFIER='false'; NPM_CONFIG_SAVE_EXACT='true'
        NPM_CONFIG_REGISTRY='http://127.0.0.1:9'; PNPM_CONFIG_REGISTRY='http://127.0.0.1:9'
        PNPM_HOME="$pm\pnpm-home"; COREPACK_HOME="$pm\corepack"; COREPACK_ENABLE_NETWORK='0'; COREPACK_ENABLE_DOWNLOAD_PROMPT='0'
        GIT_CONFIG_GLOBAL="$pm\gitconfig"; GIT_CONFIG_SYSTEM="$pm\gitconfig"; GIT_CONFIG_NOSYSTEM='1'; GIT_CONFIG_COUNT='0'; GIT_TERMINAL_PROMPT='0'
    }
}
function Invoke-ManualSupervisor {
    Assert-PlainPath $Root
    $script:Root = [IO.Path]::GetFullPath($Root)
    $rootMatch = [regex]::Match($Root, '^(C:\\Users\\[^\\]+)\\AppData\\Local\\DSH-Tinker-Demo$', 'IgnoreCase')
    if (-not $rootMatch.Success -or $rootMatch.Groups[1].Value -match '\\(Public|Default)$') { throw 'private-root-required' }
    $userRoot = $rootMatch.Groups[1].Value
    $owner = Read-PrivateJson "$Root\.workspace-icon-owner.json"
    $node = 'C:\Program Files\nodejs\node.exe'
    $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    if ($owner.schema -ne 1 -or $owner.tool -cne 'dsh-tinker-workspace-icon' -or $owner.role -cne 'private' -or
        $owner.root -cne $Root -or $owner.node -ine $node -or $owner.browserExecutable -ine $browser -or
        $owner.publicRoot -ine 'C:\Users\Public\Documents\TinkerDemo' -or
        $owner.program -ine "$userRoot\AppData\Local\Programs\DSH-Tinker-Demo" -or
        $owner.out -ine "$userRoot\ai\ai-dsh-tinker\tasks\T-185\out" -or
        $owner.archiveSha256 -cne '1ef988ace37b01e2cccd37c1f61a8c790c3018335e3f696495bf348f782eff1f') { throw 'owned-root-required' }
    $controller = [IO.Path]::Combine($PSScriptRoot, 'workspace-icon.mjs')
    if ($controller -ine "$userRoot\code\personal\dsh-tinker\scripts\demo\workspace-icon.mjs") { throw 'controller-location-invalid' }
    Assert-PlainPath $controller; Assert-PlainPath $node
    Assert-PlainPath "$Root\private"
    $manual = "$Root\manual"; $leases = "$manual\leases"
    if (-not [IO.Directory]::Exists($manual)) {
        if ($Action -eq 'Stop') { [Console]::WriteLine('{"phase":"manual-not-running"}'); return 0 }
        Assert-PlainPath $manual -MayBeMissing
        [void][IO.Directory]::CreateDirectory($manual)
        Write-JsonNew "$manual\.manual-owner.json" ([ordered]@{schema=1;tool='dsh-tinker-manual';root=$Root})
    }
    $manualOwner = Read-PrivateJson "$manual\.manual-owner.json"
    if ($manualOwner.schema -ne 1 -or $manualOwner.tool -cne 'dsh-tinker-manual' -or $manualOwner.root -cne $Root) { throw 'manual-root-unowned' }
    Assert-PlainPath $leases -MayBeMissing
    if (-not [IO.Directory]::Exists($leases)) {
        if ($Action -eq 'Stop') { [Console]::WriteLine('{"phase":"manual-not-running"}'); return 0 }
        [void][IO.Directory]::CreateDirectory($leases)
    }
    # A held FileShare.None lock excludes two supervisors without PID discovery.
    $lock = $null
    try {
        if ($Action -eq 'Start') {
            Assert-PlainPath "$manual\supervisor.lock" -MayBeMissing
            $lock = [IO.File]::Open("$manual\supervisor.lock", [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        }
        $previous = @([IO.Directory]::GetDirectories($leases) | Where-Object { [IO.Path]::GetFileName($_) -cmatch '^manual-[0-9]{6}$' } | Sort-Object)
        $last = if ($previous.Count) { $previous[-1] } else { $null }
        if ($Action -eq 'Stop') {
            if (-not $last) { [Console]::WriteLine('{"phase":"manual-not-running"}'); return 0 }
            Assert-LeaseOwner (Read-PrivateJson "$last\owner.json") ([IO.Path]::GetFileName($last))
            if ([IO.File]::Exists("$last\finished.json")) {
                if ((Read-PrivateJson "$last\finished.json").cleanStop -ne $true) { throw 'previous-supervisor-unfinished' }
                [Console]::WriteLine('{"phase":"manual-not-running"}'); return 0
            }
            if (-not [IO.File]::Exists("$last\stop.request")) { Write-JsonNew "$last\stop.request" ([ordered]@{requested=$true}) }
            [Console]::WriteLine('{"phase":"manual-stop-requested","requested":true}')
            return 0
        }
        if ($last) {
            Assert-LeaseOwner (Read-PrivateJson "$last\owner.json") ([IO.Path]::GetFileName($last))
            $prior = Read-PrivateJson "$last\finished.json" # absent/unclean means stop, never reset/adopt
            if ($prior.cleanStop -ne $true) { throw 'previous-supervisor-unfinished' }
        }
        $number = if ($last) { [int](([IO.Path]::GetFileName($last)).Substring(7)) + 1 } else { 1 }
        if ($number -gt 999999) { throw 'manual-lease-limit' }
        $name = 'manual-{0:D6}' -f $number
        $lease = [IO.Path]::Combine($leases, $name)
        if ([IO.Directory]::Exists($lease) -or [IO.File]::Exists($lease)) { throw 'manual-lease-already-exists' }
        [void][IO.Directory]::CreateDirectory($lease)
        Write-JsonNew "$lease\owner.json" ([ordered]@{schema=1;tool='dsh-tinker-manual-supervisor';root=$Root;lease=$name})
        $heartbeatFile = [IO.File]::Open("$lease\heartbeat", [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
        try { $heartbeatFile.WriteByte(49) } finally { $heartbeatFile.Dispose() }
        $id = [guid]::NewGuid().ToString('N')
        $stdout = $null; $stderr = $null; $process = $null; $stdoutTask = $null; $stderrTask = $null; $drainCancellation = $null
        $resourcesClosed = $true
        $started = $false; $exited = $false; $forced = $false; $drained = $false; $failed = $false
        $failureCode = 'manual-operation-failed'
        try {
            # Files AND OS redirection are established before Start(). CopyToAsync
            # uses fixed buffers, not unbounded ReadToEnd/string accumulation.
            $stdout = [IO.FileStream]::new("$Root\private\manual-$id.stdout.log", [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read, 65536, [IO.FileOptions]::Asynchronous)
            $stderr = [IO.FileStream]::new("$Root\private\manual-$id.stderr.log", [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read, 65536, [IO.FileOptions]::Asynchronous)
            $info = [Diagnostics.ProcessStartInfo]::new()
            $info.FileName = $node; $info.WorkingDirectory = "$($owner.publicRoot)\cwd"
            $info.UseShellExecute = $false; $info.CreateNoWindow = $true
            $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true; $info.RedirectStandardInput = $true
            $info.Environment.Clear()
            $environment = New-ChildEnvironment
            if ($environment.Count -ne 54) { throw 'child-environment-count-invalid' }
            foreach ($entry in $environment.GetEnumerator()) { $info.Environment[$entry.Key] = [string]$entry.Value }
            foreach ($argument in @($controller, '--manual', '--root', $Root, '--program', $owner.program, '--node', $owner.node,
                '--public-root', $owner.publicRoot, '--out', $owner.out, '--manual-lease', $lease)) { $info.ArgumentList.Add([string]$argument) }
            foreach ($pair in @(@('--ffmpeg','ffmpeg'), @('--pnpm-node','pnpmNode'), @('--pnpm-script','pnpmScript'))) {
                if ($owner[$pair[1]]) { $info.ArgumentList.Add($pair[0]); $info.ArgumentList.Add([string]$owner[$pair[1]]) }
            }
            $drainCancellation = [Threading.CancellationTokenSource]::new()
            $process = [Diagnostics.Process]::new(); $process.StartInfo = $info
            # EVERY operation after Start is covered by this try/finally, including
            # starting drains, metadata writes, startup timeout and Stop handling.
            if (-not $process.Start()) { throw 'controller-start-failed' }
            $started = $true
            $stdoutTask = $process.StandardOutput.BaseStream.CopyToAsync($stdout, 65536, $drainCancellation.Token)
            $stderrTask = $process.StandardError.BaseStream.CopyToAsync($stderr, 65536, $drainCancellation.Token)
            $process.StandardInput.Close()
            Write-JsonNew "$lease\started.json" ([ordered]@{pid=$process.Id;startedAt=$process.StartTime.ToUniversalTime().ToString('O')})
            $startupDeadline = [datetime]::UtcNow.AddSeconds(120)
            $stopDeadline = $null; $ready = $false
            $heartbeatStamp = ([IO.FileInfo]::new("$lease\heartbeat")).LastWriteTimeUtc
            $heartbeatSeenAt = [datetime]::UtcNow
            while (-not $process.HasExited) {
                if ([IO.File]::Exists("$lease\handoff.request")) { $failureCode = 'manual-cleanup-handoff'; throw 'manual-cleanup-handoff' }
                $beat = [IO.FileInfo]::new("$lease\heartbeat")
                if ($beat.Length -ne 1) { throw 'manual-heartbeat-invalid' }
                if ($beat.LastWriteTimeUtc -ne $heartbeatStamp) { $heartbeatStamp = $beat.LastWriteTimeUtc; $heartbeatSeenAt = [datetime]::UtcNow }
                if ($ready -and ([datetime]::UtcNow - $heartbeatSeenAt).TotalSeconds -ge 30) {
                    $failureCode = 'manual-controller-unresponsive'; throw 'manual-controller-unresponsive'
                }
                # A failed sink or exhausted disk budget stops only our tree; never
                # truncate/delete an old log or accumulate output strings in memory.
                if ($stdoutTask.IsFaulted -or $stderrTask.IsFaulted -or $stdoutTask.IsCanceled -or $stderrTask.IsCanceled) {
                    $failureCode = 'manual-log-sink-failed'; throw 'manual-log-sink-failed'
                }
                if (([IO.FileInfo]::new("$Root\private\manual-$id.stdout.log")).Length -gt 64MB -or
                    ([IO.FileInfo]::new("$Root\private\manual-$id.stderr.log")).Length -gt 64MB) {
                    $failureCode = 'manual-log-limit'; throw 'manual-log-limit'
                }
                if (-not $ready -and [IO.File]::Exists("$lease\ready.json")) {
                    $status = Read-PrivateJson "$lease\ready.json"
                    Assert-LeaseOwner $status $name
                    if ($status.ready -ne $true -or $status.pid -ne $process.Id) { throw 'controller-ready-invalid' }
                    $ready = $true; $heartbeatSeenAt = [datetime]::UtcNow
                    [Console]::WriteLine('{"phase":"manual-open","ready":true}')
                }
                if (-not $ready -and [datetime]::UtcNow -ge $startupDeadline) { throw 'manual-startup-timeout' }
                if ([IO.File]::Exists("$lease\stop.request") -and $null -eq $stopDeadline) { $stopDeadline = [datetime]::UtcNow.AddSeconds(30) }
                if ($null -ne $stopDeadline -and [datetime]::UtcNow -ge $stopDeadline) { throw 'manual-stop-timeout' }
                if ([IO.File]::Exists("$lease\controller-finished.json")) {
                    $done = Read-PrivateJson "$lease\controller-finished.json"
                    Assert-LeaseOwner $done $name
                    if ($done.browserClosed -ne $true -or $done.childrenStopped -ne $true) { throw 'controller-cleanup-failed' }
                    if ($null -eq $stopDeadline) { $stopDeadline = [datetime]::UtcNow.AddSeconds(10) }
                }
                Start-Sleep -Milliseconds 250 # resident lifetime has NO duration limit
            }
            $exited = $true
            if ($process.ExitCode -ne 0) { $failed = $true }
        } catch { $failed = $true }
        finally {
            # Only this retained live ROOT Process handle, never a persisted PID,
            # process name or discovered browser. Descendants are this run's tree.
            if ($started) {
                try {
                    if (-not $process.HasExited) { $process.Kill($true); $forced = $true; [void]$process.WaitForExit(10000) }
                    $exited = $process.HasExited
                } catch { $failed = $true; $exited = $false }
                try {
                    if ($null -ne $stdoutTask -and $null -ne $stderrTask) {
                        $drained = [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($stdoutTask, $stderrTask), 10000)
                    }
                } catch { $failed = $true }
            }
            if ($started -and -not $drained) {
                $failed = $true
                if ($failureCode -eq 'manual-operation-failed') { $failureCode = 'manual-drain-failed' }
            }
            if (-not $drained -and $null -ne $drainCancellation) {
                try {
                    if (-not $drainCancellation.CancelAsync().Wait(2000)) { $failed = $true; $resourcesClosed = $false }
                } catch { $failed = $true; $resourcesClosed = $false }
            }
            # Close ALL redirected endpoints on success, timeout and sink fault.
            # This unblocks pending pipe reads even when the child misbehaved.
            if ($started) {
                foreach ($streamName in @('StandardInput', 'StandardOutput', 'StandardError')) {
                    try { $process.$streamName.Close() } catch { $failed = $true; $resourcesClosed = $false }
                }
            }
            if (-not $drained) {
                $tasks = @($stdoutTask, $stderrTask) | Where-Object { $null -ne $_ }
                if (@($tasks).Count) { try { [void][Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($tasks), 2000) } catch { } }
            }
            foreach ($sink in @($stdout, $stderr)) {
                if ($null -ne $sink) {
                    try {
                        if (-not $sink.DisposeAsync().AsTask().Wait(2000)) {
                            $failed = $true; $resourcesClosed = $false
                            try { $sink.SafeFileHandle.Close() } catch { }
                        }
                    } catch {
                        $failed = $true; $resourcesClosed = $false
                        try { $sink.SafeFileHandle.Close() } catch { }
                    }
                }
            }
            if ($null -ne $drainCancellation) { try { $drainCancellation.Dispose() } catch { $failed = $true; $resourcesClosed = $false } }
            if ($null -ne $process) { try { $process.Dispose() } catch { $failed = $true; $resourcesClosed = $false } }
            # Fallible terminal metadata is LAST: it cannot skip resource cleanup.
            try {
                $proof = $null
                if ([IO.File]::Exists("$lease\controller-finished.json")) { $proof = Read-PrivateJson "$lease\controller-finished.json"; Assert-LeaseOwner $proof $name }
                $clean = (-not $started -and $resourcesClosed) -or ($exited -and $drained -and $resourcesClosed -and -not $forced -and $null -ne $proof -and $proof.browserClosed -eq $true -and $proof.childrenStopped -eq $true)
                Write-JsonNew "$lease\finished.json" ([ordered]@{cleanStop=$clean;processExited=$exited;forcedKill=$forced;ok=($clean -and -not $failed);code=$(if ($failed) {$failureCode} else {$null});finishedAt=[datetime]::UtcNow.ToString('O')})
                if (-not $clean) { $failed = $true }
            } catch { $failed = $true }
        }
        if ($failed) { [Console]::WriteLine('{"phase":"manual-supervisor","ok":false,"code":"manual-operation-failed"}'); return 1 }
        [Console]::WriteLine('{"phase":"manual-stopped","ok":true}'); return 0
    } finally { if ($null -ne $lock) { $lock.Dispose() } }
}
try { $result = Invoke-ManualSupervisor; exit $result }
catch { [Console]::Error.WriteLine('{"phase":"manual-supervisor","ok":false,"code":"manual-operation-failed"}'); exit 1 }
