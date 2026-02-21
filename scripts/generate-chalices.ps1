#requires -Version 5.1
[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $repoRoot 'Assets/chalices'

# Hand-authored palettes and motifs for each chalice image
$chaliceDefinitions = @(
    @{ Name = '19000.png'; Primary = '#d9b15f'; Secondary = '#8c5c2c'; Rim = '#f6e0a3'; Accent = '#5ddfff'; Gem = '#3ca9f5'; Motif = 'Sunburst' },
    @{ Name = '19001.png'; Primary = '#cfd4e3'; Secondary = '#6e6c9e'; Rim = '#f1e7ff'; Accent = '#9c7ad3'; Gem = '#b77cf2'; Motif = 'Runes' },
    @{ Name = '19002.png'; Primary = '#b97a3f'; Secondary = '#5f3a1e'; Rim = '#e8c392'; Accent = '#4fcf90'; Gem = '#6ee2b0'; Motif = 'Laurel' },
    @{ Name = '19003.png'; Primary = '#1f1c2c'; Secondary = '#5b3d25'; Rim = '#d6a86b'; Accent = '#ffdb8a'; Gem = '#ffd36b'; Motif = 'Stars' },
    @{ Name = '19004.png'; Primary = '#e7b5a5'; Secondary = '#8a3f32'; Rim = '#f9e3d7'; Accent = '#3bc7c4'; Gem = '#3ef1f0'; Motif = 'Petal' },
    @{ Name = '19005.png'; Primary = '#e3f2ff'; Secondary = '#6c89b4'; Rim = '#f5fbff'; Accent = '#7db6ff'; Gem = '#a1d9ff'; Motif = 'Moon' },
    @{ Name = '19006.png'; Primary = '#2c4d36'; Secondary = '#1b251a'; Rim = '#6ccf89'; Accent = '#f29f46'; Gem = '#ffcf73'; Motif = 'Knot' },
    @{ Name = '19007.png'; Primary = '#1f2e59'; Secondary = '#0f1935'; Rim = '#adc2ff'; Accent = '#76c3ff'; Gem = '#a4e2ff'; Motif = 'Waves' },
    @{ Name = '19020.png'; Primary = '#c06c31'; Secondary = '#5c2f16'; Rim = '#f7c88a'; Accent = '#30c7c0'; Gem = '#55f1ea'; Motif = 'Chevron' },
    @{ Name = '19021.png'; Primary = '#78716f'; Secondary = '#3e2d2c'; Rim = '#d9c9c5'; Accent = '#d14444'; Gem = '#ef7c7c'; Motif = 'Diamond' },
    @{ Name = '19022.png'; Primary = '#ede5d1'; Secondary = '#9a8f71'; Rim = '#f8f3e8'; Accent = '#4e9f66'; Gem = '#75c28b'; Motif = 'Laurel' },
    @{ Name = '19023.png'; Primary = '#141414'; Secondary = '#3a2a1c'; Rim = '#c8a871'; Accent = '#f2c977'; Gem = '#ffd68e'; Motif = 'Runes' },
    @{ Name = '19024.png'; Primary = '#c2923d'; Secondary = '#5c3a18'; Rim = '#f0d38f'; Accent = '#9ee38a'; Gem = '#b7f0aa'; Motif = 'Filigree' },
    @{ Name = '19025.png'; Primary = '#2c4a91'; Secondary = '#1a2c52'; Rim = '#9fb7ff'; Accent = '#ffb347'; Gem = '#ffd37a'; Motif = 'Sunburst' },
    @{ Name = '19026.png'; Primary = '#d6dce6'; Secondary = '#6f8799'; Rim = '#f3f6fb'; Accent = '#5bd9d2'; Gem = '#7df2e7'; Motif = 'Compass' },
    @{ Name = '19027.png'; Primary = '#5d6d53'; Secondary = '#2f3626'; Rim = '#b9c59f'; Accent = '#f7e08c'; Gem = '#ffe499'; Motif = 'Diamond' },
    @{ Name = '19030.png'; Primary = '#f1e8ff'; Secondary = '#6d4f8b'; Rim = '#fdf6ff'; Accent = '#bf9cf8'; Gem = '#d9c2ff'; Motif = 'Stars' },
    @{ Name = '19031.png'; Primary = '#b68652'; Secondary = '#4f3a22'; Rim = '#e8c89f'; Accent = '#2f79c1'; Gem = '#58a4f0'; Motif = 'Waves' },
    @{ Name = '19032.png'; Primary = '#2c2c30'; Secondary = '#60331d'; Rim = '#c27c52'; Accent = '#ff8847'; Gem = '#ffb36f'; Motif = 'Flame' },
    @{ Name = '19033.png'; Primary = '#f7f2e9'; Secondary = '#c18c7a'; Rim = '#fff7ef'; Accent = '#e67491'; Gem = '#ff9db8'; Motif = 'Filigree' },
    @{ Name = '19034.png'; Primary = '#4a7044'; Secondary = '#23361f'; Rim = '#98c17e'; Accent = '#ffdd7b'; Gem = '#ffe8a3'; Motif = 'Laurel' },
    @{ Name = '19035.png'; Primary = '#1f2445'; Secondary = '#0e1327'; Rim = '#c2c6ff'; Accent = '#79e2ff'; Gem = '#9bf3ff'; Motif = 'Halo' },
    @{ Name = '19036.png'; Primary = '#6e2a2a'; Secondary = '#3a1414'; Rim = '#d9a28c'; Accent = '#f8c26a'; Gem = '#ffd996'; Motif = 'Knot' },
    @{ Name = '19037.png'; Primary = '#13181d'; Secondary = '#2a3c2f'; Rim = '#a8d0aa'; Accent = '#5fe0a6'; Gem = '#74f7bf'; Motif = 'Arc' },
    @{ Name = '19040.png'; Primary = '#3c6fa8'; Secondary = '#23446d'; Rim = '#c6dcff'; Accent = '#6cf2ff'; Gem = '#8bf8ff'; Motif = 'Waves' },
    @{ Name = '19041.png'; Primary = '#414141'; Secondary = '#1f1f1f'; Rim = '#c9d9e5'; Accent = '#7ad4ff'; Gem = '#a6e9ff'; Motif = 'Runes' },
    @{ Name = '19042.png'; Primary = '#6c1f2f'; Secondary = '#2e0d13'; Rim = '#f1c178'; Accent = '#f58fb3'; Gem = '#ffbad4'; Motif = 'Filigree' },
    @{ Name = '19045.png'; Primary = '#2b6f6c'; Secondary = '#1b3f3d'; Rim = '#98e1d7'; Accent = '#f0d066'; Gem = '#ffe587'; Motif = 'Compass' },
    @{ Name = '19046.png'; Primary = '#c7f0d8'; Secondary = '#6ba98e'; Rim = '#e5f9ee'; Accent = '#ff8d9e'; Gem = '#ffb2c1'; Motif = 'Petal' },
    @{ Name = '19047.png'; Primary = '#292c44'; Secondary = '#181a2c'; Rim = '#cdd9ff'; Accent = '#d86cf0'; Gem = '#f49cff'; Motif = 'Stars' },
    @{ Name = 'blue_inactive.png'; Primary = '#3b4c64'; Secondary = '#1f2937'; Rim = '#9fb4d6'; Accent = '#7cb5ff'; Gem = '#a4ccff'; Motif = 'Minimal' },
    @{ Name = 'green_inactive.png'; Primary = '#3e5a42'; Secondary = '#1f3122'; Rim = '#a4c7a5'; Accent = '#7bd97b'; Gem = '#b6f4b6'; Motif = 'Minimal' },
    @{ Name = 'red_inactive.png'; Primary = '#5b2a2a'; Secondary = '#2f1212'; Rim = '#d1a1a1'; Accent = '#f47f7f'; Gem = '#ffb1b1'; Motif = 'Minimal' },
    @{ Name = 'white_active.png'; Primary = '#fdfdf8'; Secondary = '#c7c3b8'; Rim = '#fffaf0'; Accent = '#f2c553'; Gem = '#ffe194'; Motif = 'Sunburst' },
    @{ Name = 'white_inactive.png'; Primary = '#f1f1f1'; Secondary = '#a0a0a0'; Rim = '#fbfbfb'; Accent = '#cfcfcf'; Gem = '#e5e5e5'; Motif = 'Minimal' },
    @{ Name = 'yellow_inactive.png'; Primary = '#d7b347'; Secondary = '#7c5f1b'; Rim = '#f0d993'; Accent = '#ffd26b'; Gem = '#ffe6a1'; Motif = 'Minimal' },
    @{ Name = 'placeholder.png'; Primary = '#b7b7b7'; Secondary = '#6a6a6a'; Rim = '#dedede'; Accent = '#9ad7f5'; Gem = '#c4e9ff'; Motif = 'Plain' }
)

$existing = Get-ChildItem -Path $outputDir -Filter '*.png' | Select-Object -ExpandProperty Name
$missingDefinitions = $existing | Where-Object { -not ($chaliceDefinitions.Name -contains $_) }
if ($missingDefinitions) {
    throw "Missing definitions for: $($missingDefinitions -join ', ')"
}
$extraDefinitions = $chaliceDefinitions | Where-Object { -not ($existing -contains $_.Name) }
if ($extraDefinitions) {
    Write-Warning "Definitions without matching files: $($extraDefinitions.Name -join ', ')"
}

function Get-Color {
    param([string]$Hex)
    return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function New-StarPath {
    param(
        [double]$Cx,
        [double]$Cy,
        [double]$Outer,
        [double]$Inner
    )
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $points = New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
    for ($i = 0; $i -lt 10; $i++) {
        $angleDeg = ($i * 36) - 90
        $angle = $angleDeg * [Math]::PI / 180
        $r = if ($i % 2 -eq 0) { $Outer } else { $Inner }
        $x = $Cx + [Math]::Cos($angle) * $r
        $y = $Cy + [Math]::Sin($angle) * $r
        $points.Add([System.Drawing.PointF]::new([float]$x, [float]$y))
    }
    $path.AddPolygon($points.ToArray())
    return $path
}

function Draw-Motif {
    param(
        [System.Drawing.Graphics]$Graphics,
        [hashtable]$Definition,
        [System.Drawing.RectangleF]$BandRect
    )
    $color = Get-Color($Definition.Accent)
    $pen = [System.Drawing.Pen]::new($color, 2)
    $pen.LineJoin = 'Round'
    switch ($Definition.Motif) {
        'Sunburst' {
            $center = [System.Drawing.PointF]::new($BandRect.X + $BandRect.Width / 2, $BandRect.Y + ($BandRect.Height / 2))
            for ($i = 0; $i -lt 14; $i++) {
                $angle = (12 * $i) * [Math]::PI / 180
                $length = 55 + ($i % 2) * 10
                $x = $center.X + [Math]::Cos($angle) * $length
                $y = $center.Y - [Math]::Sin($angle) * ($length * 0.8)
                $Graphics.DrawLine($pen, $center, [System.Drawing.PointF]::new([float]$x, [float]$y))
            }
        }
        'Runes' {
            $count = 8
            for ($i = 0; $i -lt $count; $i++) {
                $x = $BandRect.X + 10 + ($i * ($BandRect.Width - 20) / ($count - 1))
                $Graphics.DrawLine($pen, $x, $BandRect.Y + 6, $x + 6, $BandRect.Y + $BandRect.Height - 6)
                $Graphics.DrawLine($pen, $x + 2, $BandRect.Y + 6, $x + 10, $BandRect.Y + ($BandRect.Height / 2))
            }
        }
        'Laurel' {
            for ($i = 0; $i -lt 8; $i++) {
                $x = $BandRect.X + 8 + ($i * ($BandRect.Width - 16) / 7)
                $leaf = [System.Drawing.Drawing2D.GraphicsPath]::new()
                $leaf.AddBezier($x, $BandRect.Y + $BandRect.Height, $x + 8, $BandRect.Y + 6, $x + 20, $BandRect.Y + 6, $x + 22, $BandRect.Y + $BandRect.Height)
                $leaf.AddBezier($x + 22, $BandRect.Y + $BandRect.Height, $x + 12, $BandRect.Y + $BandRect.Height + 6, $x + 4, $BandRect.Y + $BandRect.Height + 4, $x, $BandRect.Y + $BandRect.Height)
                $brush = [System.Drawing.SolidBrush]::new($color)
                $Graphics.FillPath($brush, $leaf)
                $brush.Dispose()
                $leaf.Dispose()
            }
        }
        'Stars' {
            for ($i = 0; $i -lt 5; $i++) {
                $x = $BandRect.X + 14 + ($i * ($BandRect.Width - 28) / 4)
                $y = $BandRect.Y + ($BandRect.Height / 2)
                $star = New-StarPath -Cx $x -Cy $y -Outer 10 -Inner 5
                $brush = [System.Drawing.SolidBrush]::new($color)
                $Graphics.FillPath($brush, $star)
                $brush.Dispose(); $star.Dispose()
            }
        }
        'Petal' {
            for ($i = 0; $i -lt 6; $i++) {
                $x = $BandRect.X + 10 + ($i * ($BandRect.Width - 20) / 5)
                $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
                $path.AddBezier($x, $BandRect.Bottom, $x + 6, $BandRect.Y + 4, $x + 18, $BandRect.Y + 4, $x + 24, $BandRect.Bottom)
                $path.AddBezier($x + 24, $BandRect.Bottom, $x + 16, $BandRect.Bottom + 6, $x + 8, $BandRect.Bottom + 4, $x, $BandRect.Bottom)
                $brush = [System.Drawing.SolidBrush]::new($color)
                $Graphics.FillPath($brush, $path)
                $brush.Dispose(); $path.Dispose()
            }
        }
        'Moon' {
            $pen.Width = 3
            for ($i = 0; $i -lt 3; $i++) {
                $x = $BandRect.X + 20 + ($i * ($BandRect.Width - 40) / 2)
                $y = $BandRect.Y + 6
                $Graphics.DrawArc($pen, $x, $y, 28, 28, 110, 260)
            }
        }
        'Knot' {
            $pen.Width = 3
            $offsets = @(0, 18, 36)
            foreach ($o in $offsets) {
                $Graphics.DrawBezier($pen, $BandRect.X + 10 + $o, $BandRect.Bottom, $BandRect.X + 25 + $o, $BandRect.Y, $BandRect.X + 35 + $o, $BandRect.Bottom, $BandRect.X + 50 + $o, $BandRect.Y)
            }
        }
        'Waves' {
            $pen.Width = 3
            $step = 26
            for ($x = $BandRect.X; $x -lt $BandRect.Right - 8; $x += $step) {
                $Graphics.DrawBezier($pen, $x, $BandRect.Y + ($BandRect.Height / 2), $x + ($step / 3), $BandRect.Y, $x + (2 * $step / 3), $BandRect.Bottom, $x + $step, $BandRect.Y + ($BandRect.Height / 2))
            }
        }
        'Chevron' {
            $pen.Width = 3
            $step = 28
            for ($x = $BandRect.X + 6; $x -lt $BandRect.Right - 6; $x += $step) {
                $Graphics.DrawLine($pen, $x, $BandRect.Bottom - 4, $x + ($step / 2), $BandRect.Y + 6)
                $Graphics.DrawLine($pen, $x + ($step / 2), $BandRect.Y + 6, $x + $step, $BandRect.Bottom - 4)
            }
        }
        'Diamond' {
            $pen.Width = 3
            for ($i = 0; $i -lt 6; $i++) {
                $cx = $BandRect.X + 10 + ($i * ($BandRect.Width - 20) / 5)
                $cy = $BandRect.Y + ($BandRect.Height / 2)
                $diamond = [System.Drawing.Drawing2D.GraphicsPath]::new()
                $diamond.AddLine($cx, $cy - 12, $cx + 12, $cy)
                $diamond.AddLine($cx + 12, $cy, $cx, $cy + 12)
                $diamond.AddLine($cx, $cy + 12, $cx - 12, $cy)
                $diamond.AddLine($cx - 12, $cy, $cx, $cy - 12)
                $brush = [System.Drawing.SolidBrush]::new($color)
                $Graphics.FillPath($brush, $diamond)
                $brush.Dispose(); $diamond.Dispose()
            }
        }
        'Filigree' {
            $pen.Width = 2.5
            $Graphics.DrawBezier($pen, $BandRect.X + 6, $BandRect.Bottom - 6, $BandRect.X + 30, $BandRect.Y, $BandRect.Right - 30, $BandRect.Bottom, $BandRect.Right - 6, $BandRect.Y + 6)
            $Graphics.DrawBezier($pen, $BandRect.X + 6, $BandRect.Y + 6, $BandRect.X + 24, $BandRect.Bottom, $BandRect.Right - 24, $BandRect.Y, $BandRect.Right - 6, $BandRect.Bottom - 6)
        }
        'Compass' {
            $pen.Width = 3
            $cx = $BandRect.X + ($BandRect.Width / 2)
            $cy = $BandRect.Y + ($BandRect.Height / 2)
            $Graphics.DrawLine($pen, $cx - 26, $cy, $cx + 26, $cy)
            $Graphics.DrawLine($pen, $cx, $cy - 20, $cx, $cy + 20)
            $Graphics.DrawLine($pen, $cx - 18, $cy - 16, $cx + 18, $cy + 16)
            $Graphics.DrawLine($pen, $cx + 18, $cy - 16, $cx - 18, $cy + 16)
        }
        'Flame' {
            $pen.Width = 2.5
            for ($i = 0; $i -lt 5; $i++) {
                $x = $BandRect.X + 12 + ($i * ($BandRect.Width - 24) / 4)
                $flame = [System.Drawing.Drawing2D.GraphicsPath]::new()
                $flame.AddBezier($x, $BandRect.Bottom, $x + 8, $BandRect.Y + 6, $x + 10, $BandRect.Y, $x + 14, $BandRect.Bottom - 8)
                $flame.AddBezier($x + 14, $BandRect.Bottom - 8, $x + 6, $BandRect.Bottom + 4, $x + 2, $BandRect.Bottom + 2, $x, $BandRect.Bottom)
                $brush = [System.Drawing.SolidBrush]::new($color)
                $Graphics.FillPath($brush, $flame)
                $brush.Dispose(); $flame.Dispose()
            }
        }
        'Halo' {
            $pen.Width = 3
            $cx = $BandRect.X + ($BandRect.Width / 2)
            $cy = $BandRect.Y + ($BandRect.Height / 2)
            $Graphics.DrawEllipse($pen, $cx - 36, $cy - 12, 72, 24)
            $Graphics.DrawEllipse($pen, $cx - 26, $cy - 6, 52, 12)
        }
        'Arc' {
            $pen.Width = 3
            for ($i = 0; $i -lt 4; $i++) {
                $x = $BandRect.X + 8 + ($i * ($BandRect.Width - 16) / 3)
                $Graphics.DrawArc($pen, $x, $BandRect.Y + 4, 32, $BandRect.Height - 8, 200, 140)
            }
        }
        'Minimal' {
            $thinPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, $color), 2)
            $Graphics.DrawLine($thinPen, $BandRect.X + 4, $BandRect.Y + 6, $BandRect.Right - 4, $BandRect.Y + 6)
            $Graphics.DrawLine($thinPen, $BandRect.X + 4, $BandRect.Bottom - 6, $BandRect.Right - 4, $BandRect.Bottom - 6)
            $thinPen.Dispose()
        }
        default { }
    }
    $pen.Dispose()
}

function Write-Chalice {
    param([hashtable]$Definition)

    $bmp = [System.Drawing.Bitmap]::new(400, 400, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gfx.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))

    $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
    $gfx.FillEllipse($shadowBrush, 120, 250, 160, 90)
    $shadowBrush.Dispose()

    $primary = Get-Color($Definition.Primary)
    $secondary = Get-Color($Definition.Secondary)
    $rim = Get-Color($Definition.Rim)
    $accent = Get-Color($Definition.Accent)
    $gem = Get-Color($Definition.Gem)

    $bowlPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $bowlPath.AddBezier(120, 100, 160, 60, 240, 60, 280, 100)
    $bowlPath.AddBezier(280, 100, 250, 170, 230, 200, 200, 206)
    $bowlPath.AddBezier(200, 206, 170, 200, 150, 170, 120, 100)
    $bowlPath.CloseFigure()

    $bodyBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.RectangleF]::new(120, 60, 160, 150), $primary, $secondary, 270)
    $gfx.FillPath($bodyBrush, $bowlPath)
    $bodyBrush.Dispose()

    $rimPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $rimPath.AddBezier(116, 96, 160, 76, 240, 76, 284, 96)
    $rimPath.AddBezier(284, 96, 252, 108, 228, 116, 200, 116)
    $rimPath.AddBezier(200, 116, 172, 116, 148, 108, 116, 96)
    $rimPath.CloseFigure()
    $rimBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.RectangleF]::new(116, 76, 168, 40), $rim, $accent, 0)
    $gfx.FillPath($rimBrush, $rimPath)
    $rimBrush.Dispose()

    $stemPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $stemPath.AddBezier(185, 206, 180, 244, 176, 284, 170, 320)
    $stemPath.AddBezier(170, 320, 200, 332, 230, 320, 230, 320)
    $stemPath.AddBezier(230, 320, 224, 284, 220, 244, 215, 206)
    $stemPath.AddBezier(215, 206, 200, 210, 200, 210, 185, 206)
    $stemPath.CloseFigure()
    $stemBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.RectangleF]::new(170, 206, 60, 120), $secondary, $primary, 260)
    $gfx.FillPath($stemBrush, $stemPath)
    $stemBrush.Dispose()

    $basePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $basePath.AddBezier(150, 320, 200, 340, 250, 320, 250, 320)
    $basePath.AddBezier(250, 320, 236, 350, 200, 362, 164, 350)
    $basePath.AddBezier(164, 350, 150, 340, 150, 320, 150, 320)
    $basePath.CloseFigure()
    $baseBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.RectangleF]::new(150, 320, 100, 44), $secondary, $primary, 90)
    $gfx.FillPath($baseBrush, $basePath)
    $baseBrush.Dispose()

    $highlight = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $highlight.AddBezier(135, 120, 170, 90, 190, 90, 215, 120)
    $highlight.AddBezier(215, 120, 200, 126, 185, 126, 170, 122)
    $highlight.CloseFigure()
    $highlightBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(70, 255, 255, 255))
    $gfx.FillPath($highlightBrush, $highlight)
    $highlightBrush.Dispose(); $highlight.Dispose()

    $bandRect = [System.Drawing.RectangleF]::new(135, 150, 130, 46)
    Draw-Motif -Graphics $gfx -Definition $Definition -BandRect $bandRect

    $gemPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $gemPath.AddEllipse(180, 158, 40, 28)
    $gemBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.RectangleF]::new(180, 158, 40, 28), $gem, $accent, 90)
    $gfx.FillPath($gemBrush, $gemPath)
    $gemBrush.Dispose(); $gemPath.Dispose()

    $outline = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(210, $secondary), 3)
    $outline.LineJoin = 'Round'
    $gfx.DrawPath($outline, $bowlPath)
    $gfx.DrawPath($outline, $rimPath)
    $gfx.DrawPath($outline, $stemPath)
    $gfx.DrawPath($outline, $basePath)
    $outline.Dispose()

    $bowlPath.Dispose(); $rimPath.Dispose(); $stemPath.Dispose(); $basePath.Dispose()
    $gfx.Dispose()

    $outputPath = Join-Path $outputDir $Definition.Name
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

foreach ($definition in $chaliceDefinitions) {
    Write-Chalice -Definition $definition
}

Write-Host "Chalice sprites regenerated in $outputDir"