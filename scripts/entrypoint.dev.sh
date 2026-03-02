#!/bin/sh
set -e

echo "Waiting for postgres..."
until nc -z postgres 5432 2>/dev/null; do
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
