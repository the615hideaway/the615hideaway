# Radio Now

DJ music catalog for **(615) Hideaway Entertainment**.

- Password-protected catalog loaded from `data/songs.json`
- Audio previews use the **MP3** column
- DJ queue and MP3/WAV ZIP downloads
- Live site: https://the615hideaway.github.io/radio-now/

## Sync catalog from Google Sheet

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-sheet-to-json.ps1
git add data/songs.json
git commit -m "Update catalog"
git push
```

## Local development

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

See `SETUP-INSTRUCTIONS.txt` for full details.