#!/usr/bin/env bash
set -euo pipefail

BRANCH="${BRANCH:-main}"

git config user.name  "mirror-bot"
git config user.email "mirror-bot@noreply.local"

git remote remove mirror 2>/dev/null || true
git remote add mirror "$MIRROR_URL"

git fetch origin "$BRANCH"
git fetch mirror "$BRANCH"

if git rev-parse --verify -q "mirror/$BRANCH" >/dev/null; then
  if ! git merge-base --is-ancestor "mirror/$BRANCH" HEAD; then
    git merge --no-edit "mirror/$BRANCH"
  fi
fi

git push origin "HEAD:$BRANCH"
git push mirror "HEAD:$BRANCH"
