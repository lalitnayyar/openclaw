#!/usr/bin/env bash
set -euo pipefail

# Simple installer for OpenClaw dashboard on an Azure Ubuntu VM.
# Prereqs: Docker and docker-compose plugin installed, repo cloned to this VM.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."

cd "${PROJECT_ROOT}"

echo "Building and starting OpenClaw dashboard with Docker Compose..."

docker compose build

docker compose up -d

echo "Deployment complete. Backend on port 8000, dashboard on port 80."
