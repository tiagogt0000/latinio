#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/home/tiago/vokabeltrainer
PACKAGE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
VERSION=__VERSION__
STAMP=$(date +%Y%m%d-%H%M%S)-$$
CODE_BACKUP="$PACKAGE/alter-code"
CODE_WRITTEN=0
UP_ATTEMPTED=0
OLD_IMAGE=''
OLD_REF=''
FILES=(google/Code.gs google/Accounts.gs google/AutoSharing.gs server/database.mjs server/start.mjs server/http.mjs server/Dockerfile server/notifications.mjs server/package.json server/package-lock.json)

compose() { sudo docker compose -p vokabeltrainer -f "$ROOT/server/compose.yaml" "$@" </dev/null; }
rollback() {
  local result=$1 line=$2
  trap - ERR
  set +e
  printf '\nInstallation fehlgeschlagen (Zeile %s).\n' "$line"
  if [[ "$CODE_WRITTEN" == 1 ]]; then
    for file in "${FILES[@]}"; do
      if [[ -f "$CODE_BACKUP/$file" ]]; then cp -p -- "$CODE_BACKUP/$file" "$ROOT/$file";
      elif [[ -f "$CODE_BACKUP/$file.neu" ]]; then rm -f -- "$ROOT/$file"; fi
    done
    if [[ -n "$OLD_IMAGE" && -n "$OLD_REF" ]]; then sudo docker image tag "$OLD_IMAGE" "$OLD_REF" </dev/null; fi
    if [[ "$UP_ATTEMPTED" == 1 ]]; then
      if compose up -d --no-build api; then printf 'Die vorherige Vokabel-Version wurde wieder gestartet.\n';
      else printf 'Die Vokabel-App konnte nicht automatisch wieder gestartet werden. Bitte diese Ausgabe senden.\n'; fi
    fi
  fi
  printf 'Die Datenbank wurde nicht zurueckgesetzt. Die Elektro-App wurde nicht geaendert.\n'
  exit "$result"
}
trap 'rollback "$?" "$LINENO"' ERR

printf '\nLatinio %s - Pi-Installation\n' "$VERSION"
python3 "$PACKAGE/Pruefen.py" package "$PACKAGE" "$ROOT"
sudo -v </dev/null
compose config --format json > "$PACKAGE/compose-pruefung.json"
python3 "$PACKAGE/Pruefen.py" config "$PACKAGE/compose-pruefung.json" "$ROOT"
API_ID=$(compose ps -a -q api)
[[ -n "$API_ID" ]]
sudo docker inspect "$API_ID" > "$PACKAGE/container-pruefung.json" </dev/null
python3 "$PACKAGE/Pruefen.py" container "$PACKAGE/container-pruefung.json"
OLD_REF=$(sudo docker inspect --format '{{.Config.Image}}' "$API_ID" </dev/null)
[[ "$OLD_REF" =~ ^vokabeltrainer[-_:][a-zA-Z0-9_.:-]+$ ]]
if ! (curl -fsS --max-time 3 -o "$PACKAGE/vorher-health.json" http://127.0.0.1:8081/health 2>/dev/null &&
      python3 "$PACKAGE/Pruefen.py" ready "$PACKAGE/vorher-health.json" 2>/dev/null); then
  printf '\nDie Vokabel-App ist nicht bereit. Gesicherte vorherige Version wird gestartet ...\n'
  sudo docker logs --tail 15 "$API_ID" </dev/null || true
  sudo docker image ls --format '{{.Repository}}:{{.Tag}}' > "$PACKAGE/gesicherte-images.txt" </dev/null
  RECOVERY_TAG=$(python3 "$PACKAGE/Pruefen.py" rollback-image "$PACKAGE/gesicherte-images.txt" "$VERSION")
  sudo docker image tag "$RECOVERY_TAG" "$OLD_REF" </dev/null
  compose up -d --no-build api
  RECOVERED=0
  for attempt in $(seq 1 25); do
    if curl -fsS --max-time 3 -o "$PACKAGE/vorher-health.json" http://127.0.0.1:8081/health 2>/dev/null &&
       python3 "$PACKAGE/Pruefen.py" ready "$PACKAGE/vorher-health.json" 2>/dev/null; then RECOVERED=1; break; fi
    sleep 1
  done
  [[ "$RECOVERED" == 1 ]]
  API_ID=$(compose ps -q api)
fi
OLD_IMAGE=$(sudo docker inspect --format '{{.Image}}' "$API_ID" </dev/null)
BUSINESS_BEFORE=$(sudo docker inspect --format '{{.Id}} {{.State.StartedAt}} {{.State.Running}}' gilbers-app-app-1 2>/dev/null </dev/null || true)

printf '\n1/4 - Vokabel-Datenbank sichern ...\n'
BACKUP_NAME="latinio-vor-$VERSION-$STAMP.sqlite"
compose exec -T api node server/backup.mjs /data/latinio.sqlite "/data/$BACKUP_NAME"
mkdir -p -m 700 "$ROOT/backups"
compose cp "api:/data/$BACKUP_NAME" "$ROOT/backups/$BACKUP_NAME"
sudo chown "$(id -u):$(id -g)" "$ROOT/backups/$BACKUP_NAME" </dev/null
chmod 600 "$ROOT/backups/$BACKUP_NAME"
python3 "$PACKAGE/Pruefen.py" database "$ROOT/backups/$BACKUP_NAME"

printf '\n2/4 - Backend-Dateien vorbereiten ...\n'
for file in "${FILES[@]}"; do
  mkdir -p "$CODE_BACKUP/$(dirname "$file")"
  if [[ -f "$ROOT/$file" ]]; then cp -p -- "$ROOT/$file" "$CODE_BACKUP/$file";
  else touch "$CODE_BACKUP/$file.neu"; fi
done
sudo docker image tag "$OLD_IMAGE" "vokabeltrainer:vor-$VERSION-$STAMP" </dev/null
CODE_WRITTEN=1
for file in "${FILES[@]}"; do install -m 644 -- "$PACKAGE/Dateien/$file" "$ROOT/$file"; done

printf '\n3/4 - Nur den Vokabel-Container bauen und aktualisieren ...\n'
compose build api
UP_ATTEMPTED=1
compose up -d api

printf '\n4/4 - Neues Backend pruefen ...\n'
READY=0
for attempt in $(seq 1 45); do
  if curl -fsS --max-time 3 -o "$PACKAGE/health.json" http://127.0.0.1:8081/health &&
     python3 "$PACKAGE/Pruefen.py" health "$PACKAGE/health.json" 2>/dev/null; then READY=1; break; fi
  sleep 1
done
if [[ "$READY" != 1 ]]; then
  NEW_ID=$(compose ps -q api)
  if [[ -n "$NEW_ID" ]]; then sudo docker logs --tail 30 "$NEW_ID" </dev/null || true; fi
fi
[[ "$READY" == 1 ]]
BUSINESS_AFTER=$(sudo docker inspect --format '{{.Id}} {{.State.StartedAt}} {{.State.Running}}' gilbers-app-app-1 2>/dev/null </dev/null || true)
if [[ "$BUSINESS_BEFORE" == "$BUSINESS_AFTER" && -n "$BUSINESS_BEFORE" ]]; then
  printf 'Elektro-Container unveraendert.\n'
elif [[ -n "$BUSINESS_BEFORE" ]]; then
  printf 'Der Elektro-Container hat sich zeitgleich geaendert. Dieser Installer hat ihn nicht bearbeitet.\n'
fi
printf '\nERFOLGREICH: Latinio %s Backend installiert.\n' "$VERSION"
printf 'Sicherung: %s\n' "$ROOT/backups/$BACKUP_NAME"
cat "$PACKAGE/health.json"
printf '\nBitte ChatGPT kurz die erfolgreiche Installation mitteilen.\n'
