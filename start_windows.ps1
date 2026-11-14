# Brumaria: Elo dos Dragoes 1.6.0 - Servidor local portatil para Windows 10/11.
# Usa apenas PowerShell + .NET embutidos; nao requer instalar Python ou Node.
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
Set-Location $root
$threePath = Join-Path $root 'vendor\three.module.js'
if (!(Test-Path $threePath)) {
    [System.IO.Directory]::CreateDirectory((Split-Path $threePath)) | Out-Null
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'
    $sources = @('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js', 'https://unpkg.com/three@0.180.0/build/three.module.js')
    foreach ($url in $sources) {
        try {
            $tmp = "$threePath.part"
            Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -TimeoutSec 7
            if ((Get-Item $tmp).Length -gt 100000) {
                Move-Item -Force $tmp $threePath
                Write-Host 'Three.js guardado: proximas execucoes podem funcionar offline.'
                break
            }
        } catch { Write-Host 'Sem cache local Three.js; navegador tentara o CDN.' }
        Remove-Item -Force -ErrorAction SilentlyContinue "$threePath.part"
    }
}
# Official MIT three.js GLTFLoader and dependencies are cached for offline model imports.
$addons = @('loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js')
foreach ($addon in $addons) {
    $target = Join-Path $root ("vendor/addons/" + $addon)
    if ((Test-Path $target) -and (Get-Item $target).Length -gt 500) { continue }
    [System.IO.Directory]::CreateDirectory((Split-Path $target)) | Out-Null
    foreach ($cdn in @('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/', 'https://unpkg.com/three@0.180.0/examples/jsm/')) {
        try {
            $tmp = "$target.part"
            Invoke-WebRequest -Uri ($cdn+$addon) -OutFile $tmp -UseBasicParsing -TimeoutSec 8
            if ((Get-Item $tmp).Length -gt 500) { Move-Item -Force $tmp $target; break }
        } catch { Write-Host "Leitor GLB ainda ausente: $addon (o navegador tentara internet)." }
        Remove-Item -Force -ErrorAction SilentlyContinue "$target.part"
    }
}
$listener = New-Object System.Net.HttpListener
$port = 0
foreach ($candidate in 8765..8785) {
    try {
        $listener.Prefixes.Clear()
        $listener.Prefixes.Add("http://127.0.0.1:$candidate/")
        $listener.Start()
        $port = $candidate
        break
    } catch { if ($listener.IsListening) { $listener.Stop() } }
}
if (!$port) { throw 'Nenhuma porta local disponivel (8765-8785).' }
$mime = @{'.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.webp'='image/webp'; '.glb'='model/gltf-binary'}
$url = "http://127.0.0.1:$port/"
Write-Host "Brumaria: Elo dos Dragoes 1.6.0 - Jogo aberto em $url"
Write-Host 'Nao feche esta janela enquanto estiver jogando. Ctrl+C encerra.'
Start-Process $url
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $rel = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
            $filename = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
            $within = $filename.StartsWith($root.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase)
            if (!$within -or !(Test-Path -PathType Leaf $filename)) {
                $context.Response.StatusCode = 404
            } else {
                $extension = [System.IO.Path]::GetExtension($filename).ToLowerInvariant()
                $context.Response.ContentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { 'application/octet-stream' }
                $content = [System.IO.File]::ReadAllBytes($filename)
                $context.Response.ContentLength64 = $content.Length
                $context.Response.OutputStream.Write($content, 0, $content.Length)
            }
        } catch {
            try { $context.Response.StatusCode = 500 } catch { }
            Write-Host "Erro HTTP: $_"
        } finally {
            $context.Response.Close()
        }
    }
} finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
}
