#!/bin/sh
set -e
# Named volumes usually mount /data as root:root (755). The API runs as uid 10001; SQLite
# needs write access for the DB and WAL/SHM sidecars — otherwise inserts fail with SQLITE_READONLY.
if [ -d /data ]; then
  chown -R 10001:10001 /data
  chmod u+rwx /data
fi
exec su-exec 10001:10001 "$@"
