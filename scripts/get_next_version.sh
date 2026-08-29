#!/bin/bash -e

# Local tags can be stale/incomplete (e.g. a tag pushed from another machine
# that was never fetched here), which would compute a version that collides
# with one that already exists on origin. Sync first, but don't let a failed
# fetch (offline, etc.) block the commit outright.
git fetch origin --tags || echo "warning: git fetch --tags failed; version may be computed from stale local tags" >&2

LAST_TAG="$(git tag | tr '.' ' ' | tr 'v' ' ' | sort -k 1 -k 2 -h | awk '{print "v"$1"."$2"."$3}' | tail -n 1)"
CURRENT_VERSION="$(echo "$LAST_TAG" | tr '-' ' ' | awk '{print $1}')"
echo "Old version: $CURRENT_VERSION"

export VITE_PRACTICE_VERSION="$(echo $CURRENT_VERSION | awk -F. -v OFS=. '{$(NF-1) += 1 ; print}')"
echo "New version: $VITE_PRACTICE_VERSION"
