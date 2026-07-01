# Simple static file server for local Radio Now development.
param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Radio Now running at http://localhost:$Port/"
Write-Host "Press Ctrl+C to stop."

$mimes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $path = $context.Request.Url.LocalPath
  if ($path -eq '/') { $path = '/index.html' }

  $filePath = Join-Path $Root ($path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar))

  if (Test-Path $filePath -PathType Leaf) {
    $ext = [IO.Path]::GetExtension($filePath).ToLower()
    $context.Response.ContentType = $mimes[$ext]
    if (-not $context.Response.ContentType) { $context.Response.ContentType = 'application/octet-stream' }
    $bytes = [IO.File]::ReadAllBytes($filePath)
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $context.Response.StatusCode = 404
    $msg = [Text.Encoding]::UTF8.GetBytes('Not found')
    $context.Response.OutputStream.Write($msg, 0, $msg.Length)
  }

  $context.Response.Close()
}