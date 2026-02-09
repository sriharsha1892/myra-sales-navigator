#!/bin/bash
# Vercel Ignored Build Step for myragtm project.
# Exit 0 = skip build, Exit 1 = proceed with build.
#
# Skip if ONLY navigator-specific files changed since last deploy.
# Proceed if ANY shared or GTM-specific files changed.

echo "Checking if GTM build is needed..."

# Paths that are navigator-only (changes here should NOT trigger GTM build)
NAVIGATOR_ONLY=(
  "src/app/(navigator)/"
  "src/components/navigator/"
  "src/hooks/navigator/"
  "src/lib/navigator/"
  "src/app/api/search/"
  "src/app/api/company/"
  "src/app/api/contact/"
  "src/app/api/exclusions/"
  "src/app/api/export/"
  "src/app/api/presets/"
  "src/app/api/icp/"
  "src/app/api/outreach/"
  "src/app/api/hubspot/"
  "src/app/api/teams/"
  "src/app/api/cron/"
  "src/app/api/health/"
  "src/app/api/admin/"
  "src/app/api/user/"
  "src/__tests__/navigator/"
)

# Get changed files between current and previous deploy
CHANGED=$(git diff HEAD~1 --name-only 2>/dev/null)

if [ -z "$CHANGED" ]; then
  echo "No diff available — proceeding with build"
  exit 1
fi

echo "Changed files:"
echo "$CHANGED"

# Check each changed file
while IFS= read -r file; do
  is_navigator=false
  for pattern in "${NAVIGATOR_ONLY[@]}"; do
    if [[ "$file" == $pattern* ]]; then
      is_navigator=true
      break
    fi
  done

  if [ "$is_navigator" = false ]; then
    echo "GTM-relevant file changed: $file — proceeding with build"
    exit 1
  fi
done <<< "$CHANGED"

echo "Only navigator files changed — skipping GTM build"
exit 0
