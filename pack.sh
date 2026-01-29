#!/bin/bash

# Build a clean zip for Chrome Web Store or distribution
# Usage: ./pack.sh [--dev] [-o|--output <dir>]

NAME="desktab"
OUTDIR="dist"
DEV=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev) DEV=true; shift ;;
    -o|--output) OUTDIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

TAG=$(git describe --tags --abbrev=0 2>/dev/null)

if [[ -z "$TAG" && "$DEV" == false ]]; then
  echo "Error: no git tag found. Tag a release first (e.g. git tag v1.0.0)" >&2
  echo "       or use --dev to pack anyway." >&2
  exit 1
fi

VERSION="${TAG:-dev}"
OUTFILE="${OUTDIR}/${NAME}-${VERSION}.zip"

mkdir -p "$OUTDIR"
rm -f "$OUTFILE"

(cd src && zip -r "../$OUTFILE" \
  manifest.json \
  background.js \
  content.js \
  icons/ \
  -x "*.DS_Store")

echo "Created $OUTFILE ($(du -h "$OUTFILE" | cut -f1))"
