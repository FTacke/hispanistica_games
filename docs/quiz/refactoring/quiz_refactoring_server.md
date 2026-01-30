# Quiz Refactoring Server Report (games_hispanistica)

Date: 2026-01-30
Scope: **games_hispanistica only** (read-only)

## 1) Environment data (names only, values redacted)
**Command(s) run**
- `awk -F= '/^[A-Z0-9_]+=/ {print $1}' /srv/webapps/games_hispanistica/config/passwords.env | sort -u`

**Output excerpt**
```
AUTH_DATABASE_URL
AUTH_HASH_ALGO
DB_WAIT_SECONDS
DOCKER_NETWORK
FLASK_ENV
FLASK_SECRET_KEY
JWT_COOKIE_SECURE
JWT_SECRET_KEY
START_ADMIN_EMAIL
START_ADMIN_USERNAME
```

**Notes/observations**
- Only keys from /srv/webapps/games_hispanistica/config/passwords.env were listed. Values were not read or disclosed.
- No systemd/env sources were inspected because they are not clearly scoped to games_hispanistica from the current workspace view.

## 2) Release / Import / Publish pipeline (games_hispanistica only)
**Command(s) run**
- `ls -la /srv/webapps/games_hispanistica/media`
- `ls -la /srv/webapps/games_hispanistica/media/releases`
- `sed -n '35,55p' /srv/webapps/games_hispanistica/app/scripts/content_release/README.md`
- `sed -n '80,110p' /srv/webapps/games_hispanistica/app/scripts/content_release/README.md`
- `grep -n -E "Destination Path|ln -sfn|import-content|publish-release" /srv/webapps/games_hispanistica/app/scripts/content_release/README.md`

**Output excerpts**
```
/srv/webapps/games_hispanistica/media
lrwxrwxrwx 1 root root 32 Jan  6 20:27 current -> releases/release_20260106_202412

/srv/webapps/games_hispanistica/media/releases
20260106_2200
release_20260106_202412
release_20260107_223906_7b66
```
```
Destination Path: /srv/webapps/games_hispanistica/media/releases/<release_id>/

# Set symlink to new release
cd /srv/webapps/games_hispanistica/media
ln -sfn releases/2026-01-06_1430 current

# Import content
./manage import-content \
  --units-path media/current/units \
  --audio-path media/current/audio \
  --release 2026-01-06_1430

# Publish (make live)
./manage publish-release --release 2026-01-06_1430
```

**Notes/observations**
- Releases live on disk under /srv/webapps/games_hispanistica/media/releases/<release_id>/.
- “Current” is selected via the symlink /srv/webapps/games_hispanistica/media/current → releases/<release_id>.
- Upload is done via rsync wrappers in scripts/content_release (run_release_upload.ps1, sync_release.ps1) **on the local machine**; server-side activation uses the symlink + `./manage import-content` + `./manage publish-release` as documented in scripts/content_release/README.md.

## 3) Database facts (read-only, games_hispanistica DB only)
**Command(s) run**
- `set -a; . /srv/webapps/games_hispanistica/config/passwords.env; set +a; python3 - <<'PY' ...` (SQLAlchemy counts)
- `set -a; . /srv/webapps/games_hispanistica/config/passwords.env; set +a; psql "$AUTH_DATABASE_URL" -t -A -c "select count(*) from quiz_topics"`

**Output excerpts (redacted)**
```
python3: ModuleNotFoundError: No module named 'sqlalchemy'
```
```
psql: error: connection to server ... failed: FATAL: no pg_hba.conf entry for host "<redacted>", user "games_app", database "games_hispanistica", SSL encryption
```

**Notes/observations**
- Read-only queries could not be executed from this host due to missing SQLAlchemy in the system Python and a pg_hba.conf restriction on direct psql access.
- If a project-managed virtualenv or container provides SQLAlchemy and DB connectivity, re-run the counts there.
- Required tables per scope: quiz_topics, quiz_questions, quiz_content_releases, quiz_runs, quiz_scores. Active release should be obtained from quiz_content_releases where status='published'.

## 4) Logs / error patterns (games_hispanistica only)
**Command(s) run**
- `grep -n -i -E "quiz|import|seed|release|publish" /srv/webapps/games_hispanistica/logs/games_hispanistica.log | tail -n 20`
- `sed -n '3490,3505p' /srv/webapps/games_hispanistica/logs/games_hispanistica.log`

**Output excerpt**
```
NameError: name 'app' is not defined
[2026-01-12 17:04:08,471] ERROR in app: Exception on /api/quiz/admin/topics/variation_aussprache/highscores/reset [POST]
Traceback (most recent call last):
  File "/home/gamesapp/.local/lib/python3.12/site-packages/flask/app.py", line 917, in full_dispatch_request
    rv = self.dispatch_request()
```

**Notes/observations**
- Recurring quiz-admin API errors appear around quiz highscores reset/delete endpoints; the snippet shows a NameError in an auth/extension callback.
- No explicit import/publish errors were found in the recent log tail; only quiz-admin API errors were visible in the scanned excerpts.

## 5) Health / permissions (games_hispanistica only)
**Command(s) run**
- `stat -c "%A %U:%G %n" /srv/webapps/games_hispanistica/media /srv/webapps/games_hispanistica/media/releases /srv/webapps/games_hispanistica/media/current`

**Output excerpt**
```
drwxr-xr-x root:root /srv/webapps/games_hispanistica/media
drwxrwxr-x hrzadmin:hrzadmin /srv/webapps/games_hispanistica/media/releases
lrwxrwxrwx root:root /srv/webapps/games_hispanistica/media/current
```

**Notes/observations**
- Permissions allow group write for releases/; current is a symlink owned by root.
- No write tests were performed (read-only constraint).
