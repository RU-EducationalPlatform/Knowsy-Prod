#!/usr/bin/env bash
# Promote an email to teacher by adding it to the teacherEmails allowlist.
#
#   bash infra/scripts/add-teacher.sh someone@rutgers.edu
#
# What happens:
#   1. Writes a doc at teacherEmails/{email}. (Admins-only per firestore.rules.)
#   2. The `refreshRoleOnAllowlistChange` Cloud Function fires:
#        - if a user with that email already exists, their `role` claim
#          flips to 'teacher' and the catalog re-renders teacher tools on
#          their next sign-in / token refresh
#        - if no user exists yet, the email is queued — they'll be promoted
#          at signup time by `assignRoleOnCreate`
#
# Demote a teacher: delete the same doc via `firebase firestore:delete`.
#
# Requirements:
#   - firebase CLI installed and `firebase login` done
#   - Authenticated as a project admin (or `firebase use <project>` first)

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: bash infra/scripts/add-teacher.sh <email>" >&2
  exit 2
fi

EMAIL="$(echo "$1" | tr '[:upper:]' '[:lower:]')"

# Basic shape check. Real validation lives server-side.
if ! [[ "$EMAIL" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$ ]]; then
  echo "error: '$EMAIL' doesn't look like an email address" >&2
  exit 2
fi

echo "→ Adding $EMAIL to teacherEmails allowlist"
firebase firestore:write "teacherEmails/$EMAIL" \
  --data "{\"addedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"addedBy\": \"$(whoami)\"}" \
  --merge

echo "✓ Done. The user's role claim flips to 'teacher' on their next sign-in (or within ~10s of a token refresh if already signed in)."
