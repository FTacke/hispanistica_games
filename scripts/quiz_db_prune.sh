#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/webapps/games_hispanistica/app"
cd "$APP_DIR"

echo "==[1] ENV/DB URL prüfen =="
# Versuche .env zu laden, falls vorhanden (ignoriert, wenn nicht existiert)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env || true
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL ist nicht gesetzt. Abbruch. (Muss postgresql://... sein)}"

echo "DATABASE_URL=$DATABASE_URL"
if echo "$DATABASE_URL" | grep -qiE '^sqlite:'; then
  echo "FEHLER: DATABASE_URL zeigt auf SQLite. Abbruch."
  exit 1
fi
if ! echo "$DATABASE_URL" | grep -qiE '^postgres(ql)?://'; then
  echo "FEHLER: DATABASE_URL ist nicht postgres(ql)://... Abbruch."
  exit 1
fi

echo
echo "==[2] Ziel-DB identifizieren =="
DBNAME="$(python3 - <<'PY'
import os, urllib.parse
u=urllib.parse.urlparse(os.environ["DATABASE_URL"])
print((u.path or "").lstrip("/"))
PY
)"
echo "DBNAME=$DBNAME"

echo
echo "==[3] Backup ziehen (Plain SQL Dump) =="
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/srv/backup_quiz_prune_${DBNAME}_${TS}.sql"
mkdir -p /srv
pg_dump "$DATABASE_URL" > "$BACKUP"
echo "Backup geschrieben: $BACKUP"

echo
echo "==[4] Quiz-Tabellen finden (heuristisch nach Namen) =="
# Passe die Muster ggf. an: quiz_units, releases, questions, answers, import, publish, joker, etc.
readarray -t TABLES < <(psql "$DATABASE_URL" -Atc "
SELECT schemaname||'.'||tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog','information_schema')
  AND (
    tablename ILIKE '%quiz%'
    OR tablename ILIKE '%release%'
    OR tablename ILIKE '%question%'
    OR tablename ILIKE '%answer%'
    OR tablename ILIKE '%import%'
    OR tablename ILIKE '%publish%'
    OR tablename ILIKE '%joker%'
  )
ORDER BY 1;
")

if [ "${#TABLES[@]}" -eq 0 ]; then
  echo "FEHLER: Keine Tabellen per Muster gefunden. Abbruch, damit wir nichts Falsches leeren."
  echo "Hinweis: überprüfe die echten Tabellennamen via:"
  echo "  psql \"$DATABASE_URL\" -c \"\\dt\""
  exit 1
fi

echo "Gefundene Tabellen:"
printf ' - %s\n' "${TABLES[@]}"

echo
echo "==[5] Vorher-Counts (Top 50) =="
# Zählt Zeilen, ohne bei riesigen Tabellen ewig zu dauern: reltuples ist Schätzung (schnell)
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema, c.relname AS table, c.reltuples::bigint AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND (n.nspname||'.'||c.relname) = ANY (ARRAY[$(printf "'%s'," "${TABLES[@]}" | sed 's/,$//')])
ORDER BY approx_rows DESC
LIMIT 50;
"

echo
echo "==[6] App-Prozesse kurz stoppen (optional, aber empfohlen) =="
echo "Wenn du systemd/gunicorn nutzt, stoppe jetzt den Service in einem 2. Terminal,"
echo "damit während TRUNCATE nichts schreibt."
echo "Beispiele (musst du ggf. anpassen):"
echo "  sudo systemctl stop games_hispanistica"
echo "  sudo systemctl stop gunicorn"
echo

echo "==[7] TRUNCATE CASCADE + ID-Reset ausführen =="
TRUNC_STMT="TRUNCATE TABLE $(IFS=,; echo "${TABLES[*]}") RESTART IDENTITY CASCADE;"
echo "$TRUNC_STMT"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$TRUNC_STMT"

echo
echo "==[8] Nachher-Check =="
psql "$DATABASE_URL" -c "
SELECT n.nspname AS schema, c.relname AS table, c.reltuples::bigint AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND (n.nspname||'.'||c.relname) = ANY (ARRAY[$(printf "'%s'," "${TABLES[@]}" | sed 's/,$//')])
ORDER BY 1;
"

echo
echo "==[9] Optional: Upload-Temp/Artefakte leeren (nur falls ihr Dateiuploads cached) =="
# Diese Pfade sind Beispiele. Nur ausführen, wenn du sie kennst.
echo "Wenn ihr Uploads lokal cached, suche zuerst:"
echo "  find . -maxdepth 4 -type d \\( -iname '*upload*' -o -iname '*imports*' -o -iname '*tmp*' \\) -print"
echo "Dann gezielt leeren."

echo
echo "FERTIG. Quiz-Daten und Releases sind aus Postgres entfernt. Backup liegt hier: $BACKUP"
