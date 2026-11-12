<#
.SYNOPSIS
  Puts the runtime binaries VeilBox needs into src-tauri/bin (Windows):
  Xray (pinned, SHA-256 verified), fresh GeoIP/GeoSite rules, wintun.dll and
  AmneziaWG (amneziawg.exe + awg.exe from the bundled MSI).

  Used by `npm run setup` for local development and by CI.

.PARAMETER GeoOnly
  Only refresh geoip.dat / geosite.dat.
#>
param(
    [switch]$GeoOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $root 'src-tauri/bin'
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("veilbox-setup-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null

# Geo rules for Russia, rebuilt several times a day; every file has a .sha256sum.
$geoRepo = 'https://github.com/runetfreedom/russia-v2ray-rules-dat/releases/latest/download'
$wintunVersion = '0.14.1'
$wintunSha256 = '07c256185d6ee3652e09fa55c0b673e2624b565e02c4b9091c79ca7d2f24ef51'

function Get-Verified([string]$url, [string]$shaUrl, [string]$out) {
    Invoke-WebRequest -Uri $url -OutFile $out
    # The .sha256sum comes as application/octet-stream: .Content would be a
    # byte array, not text. Save it and read it as a file instead.
    $shaFile = "$out.sha256sum"
    Invoke-WebRequest -Uri $shaUrl -OutFile $shaFile
    $want = ((Get-Content -LiteralPath $shaFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
    $have = (Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($want -ne $have) { throw "SHA-256 mismatch for $url" }
}

try {
    if (-not $GeoOnly) {
        & (Join-Path $PSScriptRoot 'install-xray.ps1')
    }

    Write-Host 'Geo rules (runetfreedom/russia-v2ray-rules-dat)...'
    foreach ($name in @('geoip.dat', 'geosite.dat')) {
        $file = Join-Path $tmp $name
        Get-Verified "$geoRepo/$name" "$geoRepo/$name.sha256sum" $file
        Copy-Item $file (Join-Path $bin $name) -Force
    }

    # Every geo category VeilBox puts into Xray configs must exist in the new
    # files, otherwise Xray refuses to start. Validate before shipping them.
    $xray = Join-Path $bin 'xray.exe'
    if (Test-Path $xray) {
        $check = Join-Path $tmp 'geo-check.json'
        @'
{
  "inbounds": [{ "port": 10999, "listen": "127.0.0.1", "protocol": "socks" }],
  "outbounds": [{ "protocol": "freedom", "tag": "direct" }],
  "routing": { "rules": [
    { "type": "field", "outboundTag": "direct",
      "domain": ["geosite:telegram", "geosite:private", "geosite:netflix", "geosite:google", "geosite:category-ads-all"] },
    { "type": "field", "outboundTag": "direct",
      "ip": ["geoip:ru", "geoip:private", "geoip:telegram", "geoip:google"] }
  ] }
}
'@ | Set-Content -LiteralPath $check -Encoding utf8
        Push-Location $bin
        try {
            & $xray run -test -c $check
            if ($LASTEXITCODE -ne 0) { throw 'Xray rejected the new geo files (a category VeilBox uses is missing).' }
        } finally { Pop-Location }
    }

    if ($GeoOnly) { return }

    # Wintun (TUN mode). Skipped when already present; a failed download is
    # only a warning locally (wintun.net may be unreachable), but fails CI —
    # a release without wintun.dll would have a broken TUN mode.
    $wintunDll = Join-Path $bin 'wintun.dll'
    if (Test-Path $wintunDll) {
        Write-Host 'Wintun: already present, skipped.'
    } else {
        Write-Host 'Wintun...'
        try {
            $zip = Join-Path $tmp 'wintun.zip'
            Invoke-WebRequest "https://www.wintun.net/builds/wintun-$wintunVersion.zip" -OutFile $zip
            if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $wintunSha256) { throw 'wintun SHA-256 mismatch' }
            Expand-Archive $zip -DestinationPath (Join-Path $tmp 'wintun')
            Copy-Item (Join-Path $tmp 'wintun/wintun/bin/amd64/wintun.dll') $wintunDll -Force
        } catch {
            if ($env:CI) { throw }
            Write-Warning "Wintun not installed ($($_.Exception.Message)). TUN mode will not work until src-tauri/bin/wintun.dll is in place."
        }
    }

    Write-Host 'AmneziaWG (from src-tauri/bin/amneziawg.msi)...'
    $msi = (Resolve-Path (Join-Path $bin 'amneziawg.msi')).Path
    $out = Join-Path $tmp 'amneziawg'
    $p = Start-Process msiexec.exe -ArgumentList "/a `"$msi`" /qn TARGETDIR=`"$out`"" -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "msiexec /a failed: $($p.ExitCode)" }
    foreach ($name in @('amneziawg.exe', 'awg.exe')) {
        $file = Get-ChildItem $out -Recurse -Filter $name | Select-Object -First 1
        if (-not $file) { throw "$name not found in amneziawg.msi" }
        Copy-Item $file.FullName (Join-Path $bin $name) -Force
    }

    Get-ChildItem $bin | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
        '{0,-16} {1,12} {2}' -f $_.Name, $_.Length, (Get-FileHash $_.FullName -Algorithm SHA256).Hash
    }
} finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
