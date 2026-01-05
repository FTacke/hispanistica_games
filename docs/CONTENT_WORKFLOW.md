# Content Workflow Documentation

**Author:** Repository Maintenance  
**Date:** 2026-01-05  
**Scope:** Quiz module seed content & media management  

## Overview

The games_hispanistica repository maintains **seed data** and **media assets** for the quiz module that should **NOT be committed to Git**. These files are:

- **Seed JSONs:** Quiz unit definitions, topic configurations
- **Media files:** MP3 audio samples, audio segments
- **Data exports:** CSV, JSON exports for data pipelines

This document explains:
1. Where content lives locally
2. How to import/seed content
3. How deployments handle content
4. What goes in `.gitignore`

---

## 1. Local Content Directory Structure

### Primary Locations:

```
content/                           # ⬅️ LOCAL DEVELOPMENT CONTENT (NOT in Git)
├── quiz_units/                    # Quiz seed data
│   ├── topics/
│   │   ├── test_quiz.json
│   │   ├── test_quiz.media/
│   │   │   ├── q01_audio_1.mp3
│   │   │   ├── q01_audio_2.mp3
│   │   │   └── q01_a2_audio_1.mp3
│   │   ├── variation_aussprache.json
│   │   ├── variation_test_quiz.json
│   │   └── variation_test_quiz.media/
│   │       ├── q01_audio_1.mp3
│   │       └── q01_audio_2.mp3
│   └── template/
│       └── quiz_template.json     # Template (reference only)
│
├── media/                         # Audio/Video assets
│   ├── test_quiz/
│   │   └── test_quiz_q_01KE59P9SVXJF4WMBPGHSJXDK6/
│   │       ├── m1.mp3
│   │       ├── m2.mp3
│   │       └── a2_m1.mp3
│   └── variation_test_quiz/
│       └── variation_q01/
│           ├── m1.mp3
│           └── m2.mp3
│
└── exports/                       # Generated data exports (NOT for Git)
    ├── quiz_topics_export_2025.json
    ├── transcripts.csv
    └── media_manifest.json
```

### What Gets Committed to Git:
- `game_modules/quiz/manifest.json` (high-level quiz metadata) ✅
- `game_modules/quiz/quiz_units/template/quiz_template.json` (template reference) ✅
- Documentation in `docs/quiz-seed/` ✅

### What Does NOT Get Committed:
- `content/` directory (all seed data, media, exports)
- Individual quiz unit JSONs
- Audio/MP3 files
- Generated data files

---

## 2. Seeding & Import Workflow

### For Development:

#### Manual Setup (One-Time):
```bash
# 1. Create content directory
mkdir -p content/{quiz_units/topics,media,exports}

# 2. Copy seed data from your source (external storage, backup, etc.)
cp /path/to/seed_backup/test_quiz.json content/quiz_units/topics/
cp -r /path/to/seed_backup/test_quiz.media/ content/quiz_units/topics/
# ... repeat for each quiz unit

# 3. Run seeding script (if exists)
python scripts/seed_quiz_database.py --source content/quiz_units/
```

#### Automated Setup (Ansible/Deployment):
```bash
# Copy seed data from encrypted backup
rsync -av /srv/backups/quiz_seeds/ /srv/webapps/games-hispanistica/content/

# Run seeding
docker exec games-hispanistica python -m game_modules.quiz.seed \
    --input /app/content/quiz_units/ \
    --db postgresql://...
```

### For Testing:
```bash
# Use minimal test fixtures from tests/resources/
pytest tests/quiz/ -v --fixtures-source content/
```

---

## 3. Deployment Content Workflow

### Pre-Deployment (On Production Server):

```bash
# Step 1: Prepare encrypted seed backup (offsite)
# (This is managed via /srv/backups/quiz_seeds/, never in Git)

# Step 2: Deploy code (from Git)
git clone https://github.com/user/games-hispanistica.git /srv/webapps/app

# Step 3: Restore seed content (from backup, NOT from Git)
rsync -av \
    --delete \
    backup-server:/encrypted/quiz_seeds/ \
    /srv/webapps/app/content/quiz_units/

# Step 4: Seed database
cd /srv/webapps/app
python -m game_modules.quiz.seed \
    --input content/quiz_units/ \
    --db $DATABASE_URL
```

### Post-Deployment Verification:
```bash
# Verify content is loaded
curl http://localhost:5000/api/quiz/topics
# Expected: List of quiz units (test_quiz, variation_aussprache, variation_test_quiz)

# Check media files
ls -la content/quiz_units/topics/*/media/
```

---

## 4. Git Configuration

### .gitignore Rules:

The `.gitignore` file **must** include:

```ignore
# Content & Media (NEVER commit seed data!)
content/
local_content/
*.mp3
*.wav
*.ogg
*.m4a
*.flac
static/quiz-media/**/*.mp3
static/quiz-media/**/*.wav
game_modules/quiz/quiz_units/topics/*.json
game_modules/quiz/quiz_units/topics/**/*.mp3
game_modules/quiz/quiz_units/topics/**/*.wav
```

### Removing Tracked Files:

If seed files were accidentally committed (they currently are!), remove them:

```bash
# Remove from Git tracking (keeps local file)
git rm --cached game_modules/quiz/quiz_units/topics/*.json
git rm --cached game_modules/quiz/quiz_units/topics/**/*.mp3
git rm --cached static/quiz-media/**/*.mp3

# Verify they're gone
git status

# Commit the removal
git commit -m "chore: remove seed content from Git tracking"
```

---

## 5. Development Environment Setup

### Local Setup Script:

Create `scripts/setup_content.sh` (for developers):

```bash
#!/bin/bash
set -e

echo "Setting up local content directories..."

# Create structure
mkdir -p content/{quiz_units/topics,media,exports}

# Create .gitkeep for version control
touch content/.gitkeep
touch content/quiz_units/.gitkeep
touch content/media/.gitkeep

echo "✓ Content directories created (not tracked by Git)"
echo ""
echo "Next steps:"
echo "1. Obtain seed data from project maintainers (encrypted backup)"
echo "2. Extract to: content/quiz_units/topics/"
echo "3. Run: python -m game_modules.quiz.seed --input content/quiz_units/"
```

### Environment Variables:

In `.env` (never commit this):

```bash
QUIZ_CONTENT_PATH=./content/quiz_units/
QUIZ_MEDIA_PATH=./content/media/
DATABASE_URL=postgresql+psycopg://user:pass@localhost/hispanistica_games
```

---

## 6. Backup & Archive Strategy

### What to Backup (Outside Git):

```
/srv/backups/
├── quiz_seeds/                    # Encrypted backup of seed JSONs
│   ├── test_quiz.json.gpg
│   ├── variation_aussprache.json.gpg
│   └── ...
├── quiz_media/                    # Audio files (can be large, compress)
│   ├── test_quiz.tar.gz.gpg
│   └── variation_test_quiz.tar.gz.gpg
└── manifest.json                  # What's in backups
```

### Backup Frequency:
- **Daily:** Automatic incremental backup of seed content
- **Monthly:** Full backup + encryption
- **On Release:** Tag backup with version number

### Restore Procedure:
```bash
# Production restore after deployment
gpg --decrypt /backup/quiz_seeds/test_quiz.json.gpg > /app/content/quiz_units/test_quiz.json
tar -xzf /backup/quiz_media/test_quiz.tar.gz.gpg -C /app/content/media/
```

---

## 7. CI/CD Integration

### GitHub Actions (if applicable):

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Code deployment (from Git)
      - name: Deploy code
        run: |
          rsync -av . $DEPLOY_HOST:/srv/webapps/app/
      
      # Content deployment (from secure backup, NOT Git)
      - name: Restore content
        run: |
          ssh $DEPLOY_HOST 'rsync -av \
            backup:/encrypted/quiz_seeds/ \
            /srv/webapps/app/content/quiz_units/'
      
      # Seed database
      - name: Seed quiz content
        run: |
          ssh $DEPLOY_HOST 'cd /srv/webapps/app && \
            python -m game_modules.quiz.seed \
            --input content/quiz_units/'
```

---

## 8. Troubleshooting

### Problem: "Quiz topics not loading"
```bash
# Check content exists locally
ls -la content/quiz_units/topics/

# Check database was seeded
python -c "from game_modules.quiz import models; \
           print(models.QuizUnit.query.count())"

# Check file permissions
chmod -R 755 content/quiz_units/
```

### Problem: "Can't find media files"
```bash
# Verify static/quiz-media structure
find static/quiz-media -type f -name "*.mp3" | head -10

# Verify QUIZ_MEDIA_PATH env var
echo $QUIZ_MEDIA_PATH

# Rebuild media index (if applicable)
python scripts/index_quiz_media.py --source content/media/
```

### Problem: "Accidentally committed seed files"
```bash
# Remove from tracking (one time)
git rm --cached game_modules/quiz/quiz_units/topics/**
git commit -m "Remove seed content from tracking"

# Verify cleanup
git ls-files | grep -i 'quiz_units/topics'  # Should be empty
```

---

## 9. Checklist for Developers

- [ ] `.gitignore` includes all content paths
- [ ] `content/` directory exists and is .gitignored
- [ ] Seed files are in `content/`, NOT in `game_modules/quiz/quiz_units/topics/`
- [ ] Media files are in `content/media/`, NOT in `static/quiz-media/`
- [ ] No commit should add `.mp3`, `.json`, or other seed files
- [ ] Database seeding script is documented and working
- [ ] Environment variables are set for content paths
- [ ] Deployment includes content restoration from backup

---

## 10. Questions & Support

For seed content issues:
- Check this doc first
- Review `.gitignore` rules
- Consult `docs/quiz-seed/` for quiz module details
- Ask maintainers for backup access

---

**Last Updated:** 2026-01-05  
**Version:** 1.0
