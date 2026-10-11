param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination, [Parameter(Mandatory=$true)][int]$Size)
$ErrorActionPreference = 'Stop'
# Tamaños de entrega del mismo emblema: no genera ni rediseña contenido.
Add-Type -AssemblyName System.Drawing
$brandRoot = [System.IO.Path]::GetFullPath((Get-Location).Path)
$brandTarget = [System.IO.Path]::GetFullPath((Join-Path $brandRoot $Destination))
$brandSource = [System.IO.Path]::GetFullPath($Source)
$allowedBrandDirectory = [System.IO.Path]::GetFullPath((Join-Path $brandRoot 'public/assets/brands')) + [System.IO.Path]::DirectorySeparatorChar
if ((!$brandTarget.StartsWith($allowedBrandDirectory, [System.StringComparison]::OrdinalIgnoreCase) -and $brandTarget -ne (Join-Path $brandRoot 'public/favicon.png')) -or [System.IO.Path]::GetExtension($brandTarget) -ne '.png' -or $brandTarget -eq $brandSource -or $Size -lt 16 -or $Size -gt 256) { throw 'Destino o tamaño no permitido' }
$brandImage = [System.Drawing.Image]::FromFile($brandSource)
$brandBitmap = New-Object System.Drawing.Bitmap($Size,$Size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$brandGraphics = [System.Drawing.Graphics]::FromImage($brandBitmap)
try {
  $brandGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $brandGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $brandGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $brandGraphics.DrawImage($brandImage,0,0,$Size,$Size)
  $brandBitmap.Save($brandTarget,[System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output ($Destination + ': ' + $Size + 'x' + $Size + ' · ' + (Get-Item -LiteralPath $brandTarget).Length + ' bytes')
} finally { $brandGraphics.Dispose(); $brandBitmap.Dispose(); $brandImage.Dispose() }
