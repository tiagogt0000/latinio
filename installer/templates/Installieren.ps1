$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $version = '__VERSION__'
    $target = 'tiago@elektrogilbersserver.tail7c7157.ts.net'
    $payload = Join-Path $PSScriptRoot "Latinio-Backend-$version.zip"
    $expectedHash = '__PAYLOAD_HASH__'
    Write-Host "Latinio $version - Installation auf dem Raspberry Pi" -ForegroundColor Cyan
    Write-Host 'Aktualisiert ausschliesslich /home/tiago/vokabeltrainer.'
    Write-Host 'SSH- und sudo-Passwoerter werden nicht gespeichert.'
    Write-Host ''
    $ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
    $scp = (Get-Command scp.exe -ErrorAction Stop).Source
    if (!(Test-Path -LiteralPath $payload -PathType Leaf)) {
        throw 'Die Backend-ZIP fehlt. Bitte zuerst die gesamte heruntergeladene ZIP entpacken.'
    }
    if ((Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
        throw 'Die Backend-Datei stimmt nicht mit diesem Installer ueberein. Bitte die ZIP erneut herunterladen und entpacken.'
    }
    $id = [guid]::NewGuid().ToString('N')
    $remoteArchive = "/home/tiago/latinio-update-$id.zip"
    $remoteStage = "/home/tiago/latinio-installer-$id"
    Write-Host '1/2 - Dateien auf den Pi uebertragen ...' -ForegroundColor Cyan
    & $scp -o ConnectTimeout=20 $payload "${target}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Die Uebertragung auf den Pi ist fehlgeschlagen. Pruefe die Verbindung und Tailscale.' }
    Write-Host ''
    Write-Host '2/2 - Sicherung und Installation ...' -ForegroundColor Cyan
    $command = "umask 077; mkdir -p '$remoteStage' && python3 -m zipfile -e '$remoteArchive' '$remoteStage' && bash '$remoteStage/Installieren-Pi.sh'"
    & $ssh -t -o ConnectTimeout=20 -o ServerAliveInterval=15 $target $command
    if ($LASTEXITCODE -ne 0) { throw 'Die Installation wurde nicht erfolgreich abgeschlossen. Bitte die letzte Fehlermeldung an ChatGPT senden.' }
    Write-Host ''
    Write-Host 'Das Latinio-Backend wurde erfolgreich aktualisiert.' -ForegroundColor Green
    Write-Host 'Bitte ChatGPT kurz Bescheid geben, damit die vorbereitete App-Version veroeffentlicht wird.'
    exit 0
} catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
