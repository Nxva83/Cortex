#!/usr/bin/env bash
# Lance Cortex
cd "$(dirname "$(readlink -f "$0")")"
[ -d node_modules ] || npm install
exec ./node_modules/.bin/electron . "$@"
