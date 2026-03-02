#!/bin/sh
set -e

echo "Waiting for postgres..."
until pg_isready -h postgres -p 5432 -U productos; do
  sleep 1
done
echo "Postgres is ready."

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running seed data..."
npx prisma db seed

echo "Starting Next.js dev server..."
exec npm run dev
