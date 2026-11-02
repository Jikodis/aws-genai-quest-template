#!/usr/bin/env bash
# Apply every migration to a throwaway Postgres and run the SQL assertions.
# Needs podman (or docker, via CONTAINER_CLI=docker). Nothing here touches the
# real project — the container is destroyed on exit, pass or fail.
set -euo pipefail

CLI="${CONTAINER_CLI:-podman}"
IMAGE="${POSTGRES_IMAGE:-docker.io/library/postgres:17-alpine}"   # matches production's major version
NAME="aws-quest-test-$$"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() { "$CLI" rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting $IMAGE as $NAME"
"$CLI" run -d --name "$NAME" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test "$IMAGE" >/dev/null

echo "==> waiting for postgres"
for _ in $(seq 1 60); do
  if "$CLI" exec "$NAME" pg_isready -U postgres -d test >/dev/null 2>&1; then break; fi
  sleep 1
done
"$CLI" exec "$NAME" pg_isready -U postgres -d test >/dev/null

run_sql() {  # run_sql <file> ; ON_ERROR_STOP makes any failed assertion fatal
  "$CLI" exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -d test -q < "$1"
}

echo "==> harness"
run_sql "$ROOT/supabase/tests/harness.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "==> migration $(basename "$f")"
  run_sql "$f"
done

status=0
for f in "$ROOT"/supabase/tests/*_test.sql; do
  [ -e "$f" ] || continue
  echo "==> test $(basename "$f")"
  if run_sql "$f"; then echo "    PASS"; else echo "    FAIL"; status=1; fi
done

echo
if [ "$status" -eq 0 ]; then echo "All SQL tests passed."; else echo "SQL tests FAILED."; fi
exit "$status"
