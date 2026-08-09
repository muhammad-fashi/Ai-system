#!/usr/bin/env bash
# Runs automatically when the codespace is created.
# Installs deps, waits for the built-in Postgres, creates the schema, seeds.
set -e

echo "==> Installing dependencies..."
npm install

# A stray .env with placeholder values must not override the container's real
# DATABASE_URL (which points at the 'db' Postgres service). Remove it if present.
if [ -f .env ]; then
  echo "==> Removing stray .env (the dev container provides real env values)."
  rm -f .env
fi

echo "==> Waiting for the database to accept connections..."
for i in $(seq 1 40); do
  if npx prisma db push --skip-generate >/tmp/dbpush.log 2>&1; then
    echo "==> Database schema created."
    npx prisma generate >/dev/null 2>&1 || true
    npm run db:seed || true
    echo ""
    echo "======================================================"
    echo " Setup complete.  Start the app with:  npm run dev"
    echo " Then sign in with:"
    echo "   Email:    admin@ai-caller.dev"
    echo "   Password: admin12345"
    echo "======================================================"
    exit 0
  fi
  echo "   ...database not ready yet ($i/40)"
  sleep 3
done

echo "!! Could not reach the database after waiting."
echo "!! Last error:"
cat /tmp/dbpush.log || true
exit 1
