# Converts Radio+Now.csv export into data/songs.json for local fallback/demo.
param(
  [string]$CsvPath = "$env:USERPROFILE\Downloads\Radio+Now.csv",
  [string]$OutPath = "$PSScriptRoot\..\data\songs.json"
)

function Get-DriveId([string]$Url) {
  if ($Url -match '/file/d/([^/]+)') { return $matches[1] }
  return $null
}

function Convert-DriveUrl([string]$Url, [string]$Kind = 'download') {
  if (-not $Url) { return '' }
  $id = Get-DriveId $Url
  if (-not $id) { return $Url }
  if ($Kind -eq 'thumbnail') { return "https://drive.google.com/thumbnail?id=$id&sz=w400" }
  return "https://drive.google.com/uc?export=download&id=$id"
}

function Parse-CsvFields([string]$Segment) {
  $fields = New-Object System.Collections.Generic.List[string]
  $current = New-Object System.Text.StringBuilder
  $inQuotes = $false
  $chars = $Segment.ToCharArray()

  for ($i = 0; $i -lt $chars.Length; $i++) {
    $ch = $chars[$i]

    if ($ch -eq '"') {
      if ($inQuotes -and ($i + 1) -lt $chars.Length -and $chars[$i + 1] -eq '"') {
        [void]$current.Append('"')
        $i++
      } else {
        $inQuotes = -not $inQuotes
      }
      continue
    }

    if ($ch -eq ',' -and -not $inQuotes) {
      $fields.Add($current.ToString())
      [void]$current.Clear()
      continue
    }

    [void]$current.Append($ch)
  }

  if ($current.Length -gt 0) {
    $fields.Add($current.ToString())
  }

  return ,$fields.ToArray()
}

$text = Get-Content $CsvPath -Raw -Encoding UTF8
$parts = $text -split '(?="PUBLISHED")'
$songs = @()
$index = 0

foreach ($part in $parts) {
  if ($part -notmatch '^"PUBLISHED"') { continue }
  $index++

  $headerEnd = $part.IndexOf('","<p')
  if ($headerEnd -lt 0) { $headerEnd = $part.IndexOf('","<p class') }
  if ($headerEnd -lt 0) { continue }

  $headerSegment = $part.Substring(0, $headerEnd)
  $fields = Parse-CsvFields $headerSegment
  if ($fields.Count -lt 8) { continue }

  $status = $fields[0]
  if ($status -ne 'PUBLISHED') { continue }

  $artist = $fields[1]
  $song = $fields[2]
  $year = $fields[3]
  $mp3 = $fields[4]
  $wav = $fields[5]
  $cover = $fields[6]
  $songTime = $fields[7]

  $preview = ''
  if ($part -match '"(wix:audio://[^"]+)"') { $preview = $matches[1] }

  $style = ''
  $members = ''
  $songwriter = ''
  $featured = ''
  $website = ''
  $label = ''
  $email = ''

  if ($part -match '","([^"]+)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)@([^"]*)",') {
    $style = $matches[1]
    $members = $matches[2]
    $songwriter = $matches[5]
    $featured = $matches[6]
    $website = $matches[7]
    $label = $matches[10]
    $email = "$($matches[11])@$($matches[12])"
  }

  $driveMp3 = Convert-DriveUrl $mp3 'download'
  $drivePreview = if ($preview -and $preview -notlike 'wix:*') {
    Convert-DriveUrl $preview 'download'
  } else {
    $driveMp3
  }

  $songs += [ordered]@{
    id = "rn-$index"
    artistName = $artist
    songTitle = $song
    year = $year
    mp3 = $driveMp3
    previewLink = $drivePreview
    wav = Convert-DriveUrl $wav 'download'
    cover = Convert-DriveUrl $cover 'thumbnail'
    songTime = $songTime
    description = ''
    musicStyle = $style
    bandMembers = $members
    songwriter = $songwriter
    featuredArtist = $featured
    website = $website
    recordLabel = $label
    contactEmail = $email
  }
}

$payload = @{
  success = $true
  source = 'local-csv'
  syncedAt = (Get-Date).ToString('o')
  songs = $songs
}

$dir = Split-Path $OutPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$json = $payload | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($OutPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($songs.Count) songs to $OutPath"