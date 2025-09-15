#!/bin/bash -e

CURRENT_VERSION="$(git describe --tags || echo "v1.0.0")"
echo "Old version: $CURRENT_VERSION"
export VITE_PRACTICE_VERSION="$(echo $CURRENT_VERSION | awk -F. -v OFS=. '{$(NF-1) += 1 ; print}')"
echo "New version: $VITE_PRACTICE_VERSION"
