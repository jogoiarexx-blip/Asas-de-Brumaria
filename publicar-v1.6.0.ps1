# Publicacao segura da atualizacao incremental Brumaria: Elo dos Dragoes v1.6.0.
# Requer Git, Node.js, autenticacao no GitHub e internet.
param([switch]$SomenteTestar)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$origem = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifesto = Join-Path $origem 'MANIFESTO_PUBLICACAO.txt'
$repositorio = 'https://github.com/jogoiarexx-blip/Asas-de-Brumaria.git'
$nomePasta = 'brumaria-v160-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6)
$destino = Join-Path ([IO.Path]::GetTempPath()) $nomePasta

function Invocar([string]$executavel, [string[]]$argumentos) {
    & $executavel @argumentos
    if ($LASTEXITCODE -ne 0) { throw "O comando '$executavel $($argumentos -join ' ')' falhou (codigo $LASTEXITCODE). Nenhum push foi feito apos este erro." }
}

try {
    foreach ($programa in @('git','node','npm')) {
        if (-not (Get-Command $programa -ErrorAction SilentlyContinue)) { throw "O programa '$programa' nao esta instalado ou nao esta no PATH." }
    }
    if (-not (Test-Path -LiteralPath $manifesto)) { throw "Manifesto nao encontrado: $manifesto" }
    Write-Host '1/5 - Clonando o repositorio original (sem apagar nenhum arquivo) ...' -ForegroundColor Cyan
    Invocar git @('clone','--branch','main','--single-branch',$repositorio,$destino)

    Write-Host '2/5 - Aplicando somente os arquivos do pacote v1.6.0 ...' -ForegroundColor Cyan
    $arquivos = @(Get-Content -LiteralPath $manifesto -Encoding UTF8 | Where-Object { $_.Trim() -and -not $_.StartsWith('#') })
    foreach ($relativo in $arquivos) {
        if ([IO.Path]::IsPathRooted($relativo) -or $relativo.Split('/') -contains '..') { throw "Caminho inseguro no manifesto: $relativo" }
        $caminhoWindows = $relativo.Replace('/', [IO.Path]::DirectorySeparatorChar)
        $arquivoOrigem = Join-Path $origem $caminhoWindows
        $arquivoDestino = Join-Path $destino $caminhoWindows
        if (-not (Test-Path -LiteralPath $arquivoOrigem -PathType Leaf)) { throw "Arquivo da atualizacao ausente: $relativo" }
        $pastaDestino = Split-Path -Parent $arquivoDestino
        New-Item -ItemType Directory -Force -Path $pastaDestino | Out-Null
        Copy-Item -LiteralPath $arquivoOrigem -Destination $arquivoDestino -Force
    }

    Push-Location $destino
    try {
        Write-Host '3/5 - Conferindo sintaxe e testes automatizados ...' -ForegroundColor Cyan
        foreach ($relativo in $arquivos) {
            if ($relativo.EndsWith('.js')) { Invocar node @('--check', $relativo) }
        }
        Invocar npm @('run','check')

        Write-Host '4/5 - Verificando mudancas ...' -ForegroundColor Cyan
        Invocar git @('add','--all')
        & git diff --cached --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Host 'Todos os arquivos ja estao atualizados. Nada a publicar.' -ForegroundColor Green
            return
        }
        & git diff --cached --stat
        if ($SomenteTestar) {
            Write-Host 'MODO TESTE: nenhuma alteracao foi enviada ao GitHub.' -ForegroundColor Yellow
            return
        }

        Write-Host '5/5 - Criando backup remoto e publicando na branch main ...' -ForegroundColor Cyan
        $backup = 'backup/antes-v160-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
        Invocar git @('push','origin',"HEAD:refs/heads/$backup")
        Invocar git @('commit','-m','release: Brumaria Elo dos Dragoes v1.6.0 (desempenho, ceu, agua e NPCs)')
        Invocar git @('push','origin','HEAD:main')
        Write-Host "PUBLICADO! Backup anterior: $backup" -ForegroundColor Green
        Write-Host 'Link: https://jogoiarexx-blip.github.io/Asas-de-Brumaria/' -ForegroundColor Green
        Write-Host 'Aguarde o GitHub Pages processar a publicacao antes de abrir o site.'
    } finally { Pop-Location }
} catch {
    Write-Host "PUBLICACAO INTERROMPIDA: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Se houve falha nos testes, nenhum commit da atualizacao foi enviado.'
    exit 1
} finally {
    Write-Host "Copia de trabalho preservada em: $destino"
}
