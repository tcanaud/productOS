#!/bin/sh
set -e

# Copy claudegraph from mounted volume into node_modules (Turbopack doesn't follow symlinks)
if [ -d "/claudegraph" ] && [ -f "/claudegraph/package.json" ]; then
  echo "Copying claudegraph into node_modules..."
  rm -rf /app/node_modules/claudegraph
  cp -r /claudegraph /app/node_modules/claudegraph
  echo "claudegraph installed in /app/node_modules/claudegraph"
else
  echo "WARNING: /claudegraph volume not mounted — claudegraph features disabled."
fi

echo "Waiting for postgres..."
until pg_isready -h postgres -p 5432 2>/dev/null; do
  sleep 1
done
echo "Postgres is ready."

echo "Generating Prisma client..."
npx prisma generate

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running seed data..."
npx prisma db seed

echo "Starting Next.js dev server..."
exec npm run dev
