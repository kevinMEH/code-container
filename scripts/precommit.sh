#!/bin/bash

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | xargs -r)

if [ -n "$STAGED_FILES" ]; then
  if ! npx prettier --check --ignore-unknown $STAGED_FILES >/dev/null 2>&1; then
    npx prettier --write --ignore-unknown $STAGED_FILES >/dev/null 2>&1
    echo "Formatting issues detected. Please stage the formatted files."
    exit 1
  fi
fi

if ! npx tsc --noEmit >/dev/null 2>&1; then
  echo "Type check failed."
  exit 1
fi

if ! npx eslint . >/dev/null 2>&1; then
  echo "Linting failed."
  exit 1
fi

echo "All checks passed."
