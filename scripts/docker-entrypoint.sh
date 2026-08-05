#!/bin/sh
set -eu

# Pre-deploy runs on separate compute where Render deliberately does not attach
# the service disk. It still runs as the unprivileged application user.
case " $* " in
  *" scripts/migrate.js "*)
    exec runuser -u nextjs -- "$@"
    ;;
esac

node /app/scripts/prepareStorage.js
exec runuser -u nextjs -- "$@"
