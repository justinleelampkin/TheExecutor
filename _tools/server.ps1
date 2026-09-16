param([int]$Port = 8099, [string]$Root = (Get-Location).Path)

Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Web

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/  (Ctrl+C to stop)"

$mimeMap = @{
  ".html"="text/html"; ".js"="application/javascript"; ".css"="text/css";
  ".png"="image/png"; ".webp"="image/webp"; ".jpg"="image/jpeg"; ".json"="application/json"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    if ($req.HttpMethod -eq "POST" -and $req.Url.AbsolutePath -eq "/save") {
      $qs = [System.Web.HttpUtility]::ParseQueryString($req.Url.Query)
      $relPath = $qs["path"]
      $fullPath = Join-Path $Root $relPath
      $dir = Split-Path $fullPath -Parent
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      $ms = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      [System.IO.File]::WriteAllBytes($fullPath, $ms.ToArray())
      $res.StatusCode = 200
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("OK $relPath ($($ms.Length) bytes)")
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host "SAVED $fullPath ($($ms.Length) bytes)"
    } else {
      $relUrl = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($relUrl)) { $relUrl = "index.html" }
      $fullPath = Join-Path $Root $relUrl
      if (Test-Path $fullPath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
        $mime = $mimeMap[$ext]; if (-not $mime) { $mime = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $res.ContentType = $mime
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found: $relUrl")
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    }
  } catch {
    Write-Host "ERROR: $_"
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
