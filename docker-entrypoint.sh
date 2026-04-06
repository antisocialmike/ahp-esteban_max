#!/bin/sh
set -e

PORT=${PORT:-3000}

printf '\n'
printf '==============================================\n'
printf 'AHP app is starting\n'
printf 'Open your browser at: http://localhost:%s\n' "$PORT"
printf '==============================================\n'
printf '\n'

exec npm start
