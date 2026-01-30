# Games Server Audit – Quiz Upload/Import 500 (Prod)
Date: 2026-01-30

## 0) Endpoint from Nginx access log (required)
**Command (before):**
sudo tail -n 200 /var/log/nginx/access.log | egrep -i "quiz-admin|upload|import| 500 " | tail -n 50

**Output (before):**
(no matches in last 200 lines – no quiz-related 500s found)

**Error log snapshot (before):**
```
2026/01/30 03:59:49 [crit] 1762203#1762203: *1853230 SSL_do_handshake() failed (SSL: error:0A00006C:SSL routines::bad key share) while SSL handshaking, client: 35.216.195.77, server: 0.0.0.0:443
2026/01/30 07:35:55 [crit] 1762203#1762203: *1854188 SSL_do_handshake() failed (SSL: error:0A00006C:SSL routines::bad key share) while SSL handshaking, client: 142.93.219.229, server: 0.0.0.0:443
2026/01/30 10:37:40 [crit] 1762203#1762203: *1854813 SSL_do_handshake() failed (SSL: error:0A00006C:SSL routines::bad key share) while SSL handshaking, client: 20.65.194.104, server: 0.0.0.0:443
2026/01/30 13:30:45 [crit] 1762203#1762203: *1855169 SSL_do_handshake() failed (SSL: error:0A00006C:SSL routines::bad key share) while SSL handshaking, client: 161.35.192.14, server: 0.0.0.0:443
```

## 1) App logs: Traceback check
**Command (before):**
docker logs games-webapp --tail 400 | egrep -i "traceback|error|exception|permission|denied|no such file|file not found|json|schema|release|upload|import|psycopg|sqlalchemy" -n || true

**Output (before):**
Only auth refresh error found, no quiz upload/import traceback:
```
[2026-01-30 15:28:12,391] ERROR in app: Exception on /auth/refresh [POST]
psycopg2.errors.StringDataRightTruncation: value too long for type character varying(36)
... SQL: UPDATE refresh_tokens SET replaced_by=...
```

## 2) Nginx upload size/timeout
**Command (before):**
sudo nginx -T | egrep -i "client_max_body_size|proxy_read_timeout|proxy_send_timeout|proxy_connect_timeout" -n

**Output (before):**
```
309:        proxy_connect_timeout 60s;
310:        proxy_send_timeout 60s;
311:        proxy_read_timeout 60s;
```
**Finding:** `client_max_body_size` not set anywhere → potential upload limit risk. Timeouts are 60s (may be too low for large audio uploads).

## 3) Container/Upstream health
**Command (before):**
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

**Output (before):**
```
games-webapp       games-webapp:latest                        Up 2 hours (healthy)   0.0.0.0:7000->5000/tcp, :::7000->5000/tcp
```

**Command (before):**
curl -sS -D- http://127.0.0.1:7000/quiz-admin/ | head -n 30 || true

**Output (before):**
```
HTTP/1.1 302 FOUND
Server: gunicorn
Location: /?showlogin=1
```

## 4) ENV & config (paths + DB)
**Command (before):**
docker inspect games-webapp --format '{{range .Config.Env}}{{println .}}{{end}}' | egrep -i "ENV=|FLASK|APP|QUIZ|RELEASE|MEDIA|UPLOAD|DATABASE|AUTH|DB|JWT" | sort

**Output (before, secrets masked):**
```
AUTH_DATABASE_URL=postgresql://games_app:***@172.18.0.1:5432/games_hispanistica
FLASK_ENV=production
QUIZ_DATABASE_URL=postgresql://games_app:***@172.18.0.1:5432/games_hispanistica_quiz
```

**DB env probe (before, secrets masked):**
```
AUTH_DATABASE_URL= postgresql://games_app:***@172.18.0.1:5432/games_hispanistica
QUIZ_DATABASE_URL= postgresql://games_app:***@172.18.0.1:5432/games_hispanistica_quiz
QUIZ_DB_HOST= None
QUIZ_DB_PORT= None
QUIZ_DB_NAME= None
QUIZ_DB_USER= None
```
**Finding:** `QUIZ_DATABASE_URL` is present (OK). `QUIZ_DB_*` not set (OK if code uses URL).

## 5) Filesystem & permissions (ROOT CAUSE)
### 5a) Host directories (before)
```
cd /srv/webapps/games_hispanistica/app
ls -la media
ls: cannot access 'media': No such file or directory

ls -la /srv/webapps/games_hispanistica/media
drwxr-xr-x 1 root root 30 Jan  6 22:43 /srv/webapps/games_hispanistica/media
```

### 5b) Container directories (before)
```
docker exec -it games-webapp sh -lc 'id; ls -la /app/media'
uid=1000(gamesapp) gid=1000(gamesapp)
drwxr-xr-x 1 root root 30 Jan  6 21:43 /app/media
lrwxrwxrwx 1 root root 32 Jan  6 19:27 /app/media/current -> releases/release_20260106_202412
drwxrwxr-x 1 gamesapp gamesapp 128 Jan  7 22:39 /app/media/releases
ls: cannot access '/app/media/quiz': No such file or directory
```

### 5c) Write test (before) – FAIL
```
== /app/media
touch: cannot touch '/app/media/.writetest_1769791349': Read-only file system
FAIL write /app/media
== /app/media/releases
touch: cannot touch '/app/media/releases/.writetest_1769791349': Read-only file system
FAIL write /app/media/releases
== /app/media/quiz
mkdir: cannot create directory ‘/app/media/quiz’: Read-only file system
```

### 5d) Mounts (before)
```
"Source": "/srv/webapps/games_hispanistica/media",
"Destination": "/app/media",
"Mode": "ro",
"RW": false
```

### Fix applied (server-side)
1) Created quiz dir and fixed ownership/permissions on host:
```
sudo mkdir -p /srv/webapps/games_hispanistica/media/quiz
sudo chown -R 1000:1000 /srv/webapps/games_hispanistica/media
sudo chmod -R u+rwX,g+rwX /srv/webapps/games_hispanistica/media
```
2) Recreated container with **RW** media mount:
```
docker stop games-webapp
docker rm games-webapp
docker run -d --name games-webapp --restart unless-stopped --network corapan-network \
  -p 7000:5000 --env-file /tmp/games-webapp.env \
  -v /srv/webapps/games_hispanistica/data:/app/data \
  -v /srv/webapps/games_hispanistica/media:/app/media \
  -v /srv/webapps/games_hispanistica/logs:/app/logs \
  games-webapp:latest
```

### Mounts (after)
```
"Source": "/srv/webapps/games_hispanistica/media",
"Destination": "/app/media",
"Mode": "",
"RW": true
```

### Write test (after) – OK
```
== /app/media
OK write /app/media
== /app/media/releases
OK write /app/media/releases
== /app/media/quiz
OK write /app/media/quiz
```

**Root Cause:** `/app/media` was mounted **read-only** → upload/import writes failed → 500.

## 6) DB: reachability + schema
**Command (before):**
sudo -u postgres psql -d games_hispanistica_quiz -c "\dt" | head -n 80

**Output (before):**
```
public | quiz_content_releases | table | games_app
public | quiz_players          | table | games_app
public | quiz_question_stats   | table | games_app
public | quiz_questions        | table | games_app
public | quiz_run_answers      | table | games_app
public | quiz_runs             | table | games_app
public | quiz_scores           | table | games_app
public | quiz_sessions         | table | games_app
public | quiz_topics           | table | games_app
```

**Schemas:**
```
public | postgres
```
**Finding:** Tables exist and owned by `games_app` (OK). Schema owner is `postgres` (not critical if grants are OK).

## 7) How container is started
**Observations:**
- No Docker compose labels on `games-webapp` (started via plain `docker run`).
- Service present: `actions.runner.FTacke-hispanistica_games.games-prod-vhrz2184.service` (GitHub Actions runner).

## Checklist (required)
1) **QUIZ_DATABASE_URL fehlt/falsch?** → **OK** (set)
2) **media/ mount/permissions?** → **FAIL (root cause)** → **FIXED** (RW mount + chown)
3) **Nginx limits/timeouts?** → **WARN** (no `client_max_body_size`, timeouts 60s)
4) **DB schema vorhanden?** → **OK** (tables present)
5) **Release/Current path layout?** → **OK** (current symlink exists, releases present)

## Repo/Infra Patch Hint
1) Ensure prod deploy spec mounts media as **RW**:
	- `/srv/webapps/games_hispanistica/media:/app/media` (no `:ro`).
2) Ensure `/app/media/quiz` is created on startup.
3) Add Nginx vhost config for uploads:
	- `client_max_body_size 50m;`
	- `proxy_read_timeout 300;` and `proxy_send_timeout 300;`

## Extra non-quiz error observed (separate)
`/auth/refresh` throws `StringDataRightTruncation` on `refresh_tokens.replaced_by` (value longer than 36). This is unrelated to quiz upload/import but should be tracked as a separate DB schema/code fix.
