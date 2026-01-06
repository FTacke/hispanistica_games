# Release EXAMPLE_RELEASE

**Status:** Example/Template Release Structure

## Purpose

This directory demonstrates the expected structure for quiz content releases.

## Structure

```
EXAMPLE_RELEASE/
├── topics/              # Quiz topic JSON files (*.json)
├── media/
│   ├── audio/          # Audio snippets (.mp3, .ogg)
│   └── images/         # Images (if needed)
└── RELEASE_NOTES.md    # This file
```

## Usage

Copy this structure when creating a new release:

```powershell
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
Copy-Item -Recurse content/quiz_releases/EXAMPLE_RELEASE content/quiz_releases/$timestamp
```

Then populate with actual content:
- Copy topics from `content/quiz/topics/*.json`
- Copy media from `static/quiz-media/*`
- Update this RELEASE_NOTES.md with changes

## Do Not Deploy

This is a template only. Always use timestamped releases for deployment.
