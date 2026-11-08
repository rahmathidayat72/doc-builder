#!/usr/bin/env bash
set -euo pipefail

# Script Wrapper Rolling D1 Backup
# Usage: ./backup-d1.sh [--tier=weekly|monthly]

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${DIR}/backup-d1.mjs" "$@"
