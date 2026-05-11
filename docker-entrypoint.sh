#!/bin/sh
set -e
#hola esteban
PORT=${PORT:-3000}
LOCKFILE_HASH_FILE=node_modules/.package-lock.sha256

mkdir -p node_modules

if [ -f package-lock.json ]; then
	CURRENT_LOCKFILE_HASH=$(sha256sum package-lock.json | awk '{print $1}')
	SAVED_LOCKFILE_HASH=""

	if [ -f "$LOCKFILE_HASH_FILE" ]; then
		SAVED_LOCKFILE_HASH=$(cat "$LOCKFILE_HASH_FILE")
	fi

	if [ ! -d node_modules/express ] || [ "$CURRENT_LOCKFILE_HASH" != "$SAVED_LOCKFILE_HASH" ]; then
		printf 'Syncing Node dependencies for container startup...\n'
		npm install
		printf '%s' "$CURRENT_LOCKFILE_HASH" > "$LOCKFILE_HASH_FILE"
	fi
fi

printf '\n'
printf '==============================================\n'
printf 'AHP app is starting\n'
printf 'Open your browser at: http://localhost:%s\n' "$PORT"
printf '==============================================\n'
printf '\n'

exec npm start
