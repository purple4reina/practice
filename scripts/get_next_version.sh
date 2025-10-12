#!/bin/bash -e

LAST_TAG="$(git tag | tr '.' ' ' | tr 'v' ' ' | sort -k 1 -k 2 -h | tr ' ' '.' | tail -n 1)"
CURRENT_VERSION=v"$(echo "$LAST_TAG" | tr '-' ' ' | awk '{print $1}')"
echo "Old version: $CURRENT_VERSION"

export VITE_PRACTICE_VERSION="$(echo $CURRENT_VERSION | awk -F. -v OFS=. '{$(NF-1) += 1 ; print}')"
echo "New version: $VITE_PRACTICE_VERSION"
