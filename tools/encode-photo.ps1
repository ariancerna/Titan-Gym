param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
# Conversión de formato para la web: no redimensiona ni modifica la composición.
Add-Type -AssemblyName System.Drawing
$targetPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Destination))
$targetRoot = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) 'public/assets/generated')) + [System.IO.Path]::DirectorySeparatorChar
if (!$targetPath.StartsWith($targetRoot, [System.StringComparison]::OrdinalIgnoreCase) -or [System.IO.Path]::GetExtension($targetPath) -ne '.jpg') { throw 'Destino fuera de los recursos generados' }
if (Test-Path -LiteralPath $targetPath) { throw 'El recurso ya existe; utiliza un nombre versionado' }
New-Item -ItemType Directory -Path ([System.IO.Path]::GetDirectoryName($targetPath)) -Force | Out-Null
$photoImage = [System.Drawing.Image]::FromFile([System.IO.Path]::GetFullPath($Source))
$photoEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$photoParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
$photoParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
try {
  $photoImage.Save($targetPath, $photoEncoder, $photoParameters)
  Write-Output ($Destination + ': ' + $photoImage.Width + 'x' + $photoImage.Height + ' · ' + (Get-Item -LiteralPath $targetPath).Length + ' bytes')
} finally { $photoImage.Dispose(); $photoParameters.Dispose() }
