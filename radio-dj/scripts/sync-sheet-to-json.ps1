# Syncs the Radio Now Google Sheet into data/songs.json
param(
  [string]$SheetId = '1EXNdRluPjwyaY5ktt-qHI2bNF7IT5bD1udnCgkKNdkU',
  [string[]]$SheetNames = @('Form Responses 1', 'Sheet1'),
  [string]$OutPath = ''
)

if (-not $OutPath) {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $OutPath = Join-Path (Join-Path $repoRoot 'data') 'songs.json'
}

function Get-CellValue($cell) {
  if (-not $cell) { return '' }
  if ($cell.f -and "$($cell.f)".Trim()) { return "$($cell.f)".Trim() }
  if ($null -eq $cell.v) { return '' }
  if ($cell.v -is [double] -or $cell.v -is [int]) { return ([int][Math]::Round($cell.v)).ToString() }
  return "$($cell.v)".Trim()
}

function Get-DriveId([string]$Url) {
  if (-not $Url) { return '' }
  if ($Url -match '/file/d/([^/]+)') { return $matches[1] }
  if ($Url -match '[?&]id=([^&]+)') { return $matches[1] }
  return ''
}

function Get-DriveDownload([string]$Url) {
  $id = Get-DriveId $Url
  if ($id) { return "https://drive.google.com/uc?export=download&id=$id" }
  return $Url
}

function Get-DriveStream([string]$Url) {
  $id = Get-DriveId $Url
  if ($id) { return "https://drive.usercontent.google.com/download?id=$id&export=download" }
  return $Url
}

function Get-DriveThumbnail([string]$Url) {
  $id = Get-DriveId $Url
  if ($id) { return "https://drive.google.com/thumbnail?id=$id&sz=w400" }
  return $Url
}

function Strip-Html([string]$Html) {
  if (-not $Html) { return '' }
  return ($Html -replace '<[^>]+>', ' ' -replace '\s+', ' ').Trim()
}

function Format-InstrumentLine([string]$Value) {
  $text = $Value.Trim()
  if ($text -match '^(.+?)\s*-\s*(.+)$') {
    return "$($matches[1].Trim()): $($matches[2].Trim())"
  }
  return $text
}

function Build-BandMemberLines([hashtable]$Record) {
  $lines = New-Object System.Collections.Generic.List[string]

  if ($Record['Lead Vocals']) { $lines.Add("Lead Vocals: $($Record['Lead Vocals'].Trim())") }

  foreach ($n in 1..4) {
    $value = $Record["Harmony Vocals $n"]
    if ($value) { $lines.Add("Harmony Vocals: $($value.Trim())") }
  }

  foreach ($n in 1..8) {
    $value = $Record["Instrument  Player $n"]
    if (-not $value) { $value = $Record["Instrument Player $n"] }
    if ($value) { $lines.Add((Format-InstrumentLine $value)) }
  }

  if ($Record['Band Members']) {
    foreach ($legacyLine in ($Record['Band Members'] -split '\r?\n')) {
      $legacyLine = $legacyLine.Trim()
      if ($legacyLine) { $lines.Add($legacyLine) }
    }
  }

  return ,$lines.ToArray()
}

function Save-CoverArt {
  param(
    [string]$DriveId,
    [string]$DestPath
  )

  if (-not $DriveId) { return $false }

  $urls = @(
    "https://drive.google.com/thumbnail?id=$DriveId&sz=w800",
    "https://drive.usercontent.google.com/download?id=$DriveId&export=download"
  )

  foreach ($url in $urls) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $DestPath -UseBasicParsing
      if ((Test-Path $DestPath) -and ((Get-Item $DestPath).Length -gt 1200)) {
        return $true
      }
    } catch {
      # Try the next source.
    }
  }

  if (Test-Path $DestPath) { Remove-Item $DestPath -Force -ErrorAction SilentlyContinue }
  return $false
}

$outDir = Split-Path $OutPath -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$coversDir = Join-Path $outDir 'covers'
if (-not (Test-Path $coversDir)) { New-Item -ItemType Directory -Path $coversDir | Out-Null }

function Build-SongFromRecord {
  param(
    [hashtable]$Record,
    [int]$Index
  )

  $artist = $Record['Artist Name']
  $title = $Record['Song Title']
  if (-not $artist -and -not $title) { return $null }

  $mp3 = $Record['MP3']
  if (-not $mp3) { $mp3 = $Record['MP3s'] }
  $cover = $Record['Cover Art']
  if (-not $cover) { $cover = $Record['Cover'] }
  $wav = $Record['WAV']

  $previewDriveId = Get-DriveId $mp3
  $previewStreamUrl = ''
  if ($previewDriveId) {
    $previewStreamUrl = Get-DriveStream $mp3
  } elseif ($mp3 -and $mp3 -match '^https?://') {
    $previewStreamUrl = $mp3
  }

  $bandMemberLines = Build-BandMemberLines $Record
  $coverDriveId = Get-DriveId $cover

  $releaseType = if ($Record['TAG - Album/Single']) { $Record['TAG - Album/Single'] }
    elseif ($Record['Album/Single']) { $Record['Album/Single'] }
    else { '' }
  $albumName = if ($Record['Album Title']) { $Record['Album Title'] }
    elseif ($Record['Album Name']) { $Record['Album Name'] }
    elseif ($Record['Album']) { $Record['Album'] }
    else { '' }
  $releaseDate = $Record['Release Date']
  if (-not $releaseDate) { $releaseDate = $Record['Radio Now Release'] }
  if (-not $releaseDate) { $releaseDate = $Record['Added Date'] }
  $spotlightPriority = $Record['Spotlight Priority']
  if (-not $spotlightPriority) { $spotlightPriority = $Record['Spotlight'] }
  $spotlightUntil = $Record['Spotlight Until']
  if (-not $spotlightUntil) { $spotlightUntil = $Record['Spotlight End'] }

  return [ordered]@{
    id                 = "song-$Index"
    artistName         = $artist
    songTitle          = $title
    year               = $Record['Year']
    mp3                = Get-DriveDownload $mp3
    previewLink        = $mp3
    previewStreamUrl   = $previewStreamUrl
    previewDriveId     = $previewDriveId
    wav                = Get-DriveDownload $wav
    cover              = $cover
    coverDriveId       = $coverDriveId
    coverLocal         = ''
    coverThumbnailUrl  = Get-DriveThumbnail $cover
    songTime           = $Record['Song Time']
    description        = Strip-Html $Record['Description']
    musicStyle         = $Record['Music Style']
    bandMemberLines    = $bandMemberLines
    bandMembers        = ($bandMemberLines -join '; ')
    songwriter         = $Record['Songwriter']
    featuredArtist     = $Record['Featured Artist']
    website            = $Record['Website']
    recordLabel        = $Record['Record Label']
    releaseType        = $releaseType
    albumName          = $albumName
    contactEmail       = $Record['Contact E-Mail']
    releaseDate        = $releaseDate
    spotlightPriority  = $spotlightPriority
    spotlightUntil     = $spotlightUntil
  }
}

$catalog = @{}
$index = 0

foreach ($sheetName in $SheetNames) {
  $gvizUrl = "https://docs.google.com/spreadsheets/d/$SheetId/gviz/tq?tqx=out:json&sheet=$([uri]::EscapeDataString($sheetName))"
  try {
    $text = (Invoke-WebRequest -Uri $gvizUrl -UseBasicParsing).Content
  } catch {
    Write-Warning "Skipping sheet '$sheetName': $($_.Exception.Message)"
    continue
  }

  if ($text -notmatch 'google\.visualization\.Query\.setResponse\(([\s\S]+)\);?') {
    Write-Warning "Skipping sheet '$sheetName': could not parse response"
    continue
  }

  $payload = $matches[1] | ConvertFrom-Json
  $cols = @($payload.table.cols | ForEach-Object { $_.label })
  $rows = @($payload.table.rows)

  foreach ($row in $rows) {
    $record = @{}
    for ($i = 0; $i -lt $cols.Count; $i++) {
      $label = $cols[$i]
      if (-not $label) { continue }
      $cell = $null
      if ($row.c.Count -gt $i) { $cell = $row.c[$i] }
      $record[$label] = Get-CellValue $cell
    }

    $artist = $record['Artist Name']
    $title = $record['Song Title']
    if (-not $artist -and -not $title) { continue }

    $index++
    $song = Build-SongFromRecord -Record $record -Index $index
    if (-not $song) { continue }

    $key = ("$artist|$title").ToLower()
    $catalog[$key] = $song
  }
}

$songs = [System.Collections.Generic.List[object]]::new()
$sortIndex = 1
foreach ($entry in ($catalog.GetEnumerator() | Sort-Object { $_.Value.artistName }, { $_.Value.songTitle })) {
  $entry.Value.id = "song-$sortIndex"
  if ($entry.Value.coverDriveId) {
    $coverFile = Join-Path $coversDir "song-$sortIndex.jpg"
    if (Save-CoverArt -DriveId $entry.Value.coverDriveId -DestPath $coverFile) {
      $entry.Value.coverLocal = "data/covers/song-$sortIndex.jpg"
    } else {
      $entry.Value.coverLocal = ''
    }
  }
  $songs.Add($entry.Value)
  $sortIndex++
}

$output = [ordered]@{
  success    = $true
  source     = 'google-sheet'
  sheetId    = $SheetId
  sheetNames = $SheetNames
  syncedAt   = (Get-Date).ToUniversalTime().ToString('o')
  songCount  = $songs.Count
  songs      = $songs
}

$json = $output | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($OutPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($songs.Count) songs to $OutPath"