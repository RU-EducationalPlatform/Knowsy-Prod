#!/usr/bin/env bash
# One-shot, idempotent setup of GitHub branch protection + deployment environments.
#
# Run once after the repo exists on GitHub:
#   gh auth login                   # (admin token on the repo)
#   bash tools/setup-branch-protection.sh
#
# Re-running is safe — every operation is a PUT.

set -euo pipefail

# Resolve the current repo from the local clone so this works for forks.
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "→ Configuring repository: $REPO"

# Status check name comes from the job name in .github/workflows/ci.yml.
CI_CHECK="build-and-test"

# ----- Default branch + dev branch existence -----
# Make sure the dev branch exists before we try to protect it.
if ! gh api "repos/$REPO/branches/dev" >/dev/null 2>&1; then
  echo "→ dev branch does not exist; creating from main"
  MAIN_SHA=$(gh api "repos/$REPO/git/refs/heads/main" -q .object.sha)
  gh api "repos/$REPO/git/refs" -X POST \
    -f ref=refs/heads/dev \
    -f sha="$MAIN_SHA" >/dev/null
fi

# ----- Branch protection helper -----
protect() {
  local branch="$1"
  local approvals="$2"
  echo "→ Protecting branch: $branch (require $approvals approvals)"

  gh api "repos/$REPO/branches/$branch/protection" -X PUT \
    -H "Accept: application/vnd.github+json" \
    --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["$CI_CHECK"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": $approvals,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF
}

# ----- dev: 2 approvals (where new code lands) -----
protect dev 2

# ----- main: 1 approval (work was already approved on its way to dev) -----
# Bump to 2 if you want stricter prod gates.
protect main 1

# ----- GitHub Actions environments -----
# Restrict each environment to only deploy from its corresponding branch.
echo "→ Configuring environment: production (branch=main)"
gh api "repos/$REPO/environments/production" -X PUT \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "wait_timer": 0,
  "reviewers": [],
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOF
gh api "repos/$REPO/environments/production/deployment-branch-policies" -X POST \
  -H "Accept: application/vnd.github+json" \
  -f name=main >/dev/null 2>&1 || true

echo "→ Configuring environment: development (branch=dev)"
gh api "repos/$REPO/environments/development" -X PUT \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "wait_timer": 0,
  "reviewers": [],
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOF
gh api "repos/$REPO/environments/development/deployment-branch-policies" -X POST \
  -H "Accept: application/vnd.github+json" \
  -f name=dev >/dev/null 2>&1 || true

# ----- Repo-level settings -----
echo "→ Disabling allow-merge-commits / squash & rebase only / auto-delete head branches"
gh api "repos/$REPO" -X PATCH \
  -F allow_merge_commit=false \
  -F allow_squash_merge=true \
  -F allow_rebase_merge=true \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=true >/dev/null

echo
echo "✓ Done. Verify in: https://github.com/$REPO/settings/branches"
echo
echo "Don't forget to add these repo secrets (Settings → Secrets and variables → Actions):"
echo "  FIREBASE_SERVICE_ACCOUNT_PROD, FIREBASE_PROJECT_ID_PROD"
echo "  FIREBASE_SERVICE_ACCOUNT_DEV,  FIREBASE_PROJECT_ID_DEV"
echo "  VITE_FIREBASE_*  (one set for prod, one with _DEV suffix)"
echo "  VITE_SENTRY_DSN  (optional, enables error tracking in prod)"
