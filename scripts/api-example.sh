#!/usr/bin/env bash
# Walks through the main API calls against a running site:
#   log in → read profile & projects → create a project → upload a PDF → make it a "PDF portfolio"
#   → design all project pages from the "PDF portfolio" template and publish → download a backup.
#
#   BASE=http://localhost:3000 EMAIL=you@example.com bash scripts/api-example.sh path/to/portfolio.pdf
#
# The password is asked for (hidden), so it never lands in your shell history. Admins only (Bearer tokens).
# It changes the site (adds a project "api-demo-project", publishes a project page design): try it locally first.
set -euo pipefail
BASE=${BASE:-http://localhost:3000}
EMAIL=${EMAIL:?Set EMAIL=your admin email}
FILE=${1:?Give the path to a PDF}
SLUG=${SLUG:-api-demo-project}
read -rsp "Password for $EMAIL: " PASSWORD; echo

# Prints part of a JSON response, e.g.  json d.token
json() { node -e "const d = JSON.parse(require('fs').readFileSync(0, 'utf8')); if (d.error) { console.error('✗', d.error, d.details ? JSON.stringify(d.details) : ''); process.exit(1) } console.log($1)"; }

# 1. Log in. The token works as "Authorization: Bearer …" (admins only).
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({ email: process.argv[1], password: process.argv[2] }))' "$EMAIL" "$PASSWORD")" | json d.token)
AUTH="Authorization: Bearer $TOKEN"
unset PASSWORD
echo "✓ Logged in"

# 2. Read
echo "Profile: $(curl -s "$BASE/api/profile" -H "$AUTH" | json d.name)"
echo "Projects: $(curl -s "$BASE/api/projects" -H "$AUTH" | json 'd.map((p) => p.slug).join(", ")')"

# 3. Create a project (slug, title, description, stack are required)
curl -s -X POST "$BASE/api/projects" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"slug\":\"$SLUG\",\"title\":\"API demo project\",\"description\":\"Created from scripts/api-example.sh\",\"stack\":[\"Demo\"]}" | json '"✓ Created " + d.slug'

# 4. Upload the PDF: start, send 3 MB parts (Vercel caps requests at 4.5 MB), finish. Max 40 MB.
SIZE=$(wc -c < "$FILE" | tr -d ' ')
START=$(curl -s -X POST "$BASE/api/assets" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"fileName\":\"$(basename "$FILE")\",\"size\":$SIZE,\"mimeType\":\"application/pdf\"}")
ID=$(echo "$START" | json d.id)
PART_BYTES=$(echo "$START" | json d.partBytes)
TMP=$(mktemp -d)
split -b "$PART_BYTES" -a 3 "$FILE" "$TMP/part-"
n=0
for part in "$TMP"/part-*; do
  curl -s -X PUT "$BASE/api/assets/$ID/parts/$n" -H "$AUTH" -H "Content-Type: application/octet-stream" --data-binary @"$part" | json d.ok >/dev/null
  n=$((n + 1))
done
rm -rf "$TMP"
PDF=$(curl -s -X POST "$BASE/api/assets/$ID/complete" -H "$AUTH" | json d.url)
echo "✓ Uploaded $(basename "$FILE") in $n parts: $PDF"

# 5. Make the project a PDF portfolio
curl -s -X PATCH "$BASE/api/projects/$SLUG" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"type\":\"pdf\",\"pdf\":\"$PDF\"}" | json '"✓ " + d.slug + " is now a " + d.type + " project"'

# 6. Design every project page from the "PDF portfolio" template, then publish it
#    (?page=project = all project pages; add &project=<slug> for one project's own design)
curl -s -X POST "$BASE/api/design/template?page=project" -H "$AUTH" -H "Content-Type: application/json" -d '{"id":"project-pdf"}' | json '"✓ Draft from template " + d.template'
curl -s -X POST "$BASE/api/design/publish?page=project" -H "$AUTH" -H "Content-Type: application/json" -d '{}' | json '"✓ Published at " + d.publishedAt'

# 7. Backup of all content (profile, projects, experience, skills, site text)
curl -s "$BASE/api/portfolio" -H "$AUTH" -o portfolio-backup.json
echo "✓ Backup saved to portfolio-backup.json"
echo
echo "Open $BASE/projects/$SLUG"
echo "Undo: curl -X DELETE \"$BASE/api/design/publish?page=project\" -H \"Authorization: Bearer <token>\"  (built-in project pages again)"
