#!/bin/bash -e

LAST_TAG="$(git describe --tags || echo "v1.0.0")"
CURRENT_VERSION="$(echo "$LAST_TAG" | tr '-' ' ' | awk '{print $1}')"
echo "Old version: $CURRENT_VERSION"

export VITE_PRACTICE_VERSION="$(echo $CURRENT_VERSION | awk -F. -v OFS=. '{$(NF-1) += 1 ; print}')"
echo "New version: $VITE_PRACTICE_VERSION"
