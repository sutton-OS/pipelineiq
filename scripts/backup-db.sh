#!/usr/bin/env bash

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"

BACKUP_PROVIDER="${BACKUP_PROVIDER:-gcs}"
BACKUP_PREFIX="${BACKUP_PREFIX:-pipelineiq}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_NAME="pipelineiq_${TIMESTAMP}.sql.gz"
OBJECT_KEY="${BACKUP_PREFIX%/}/${ARCHIVE_NAME}"
TMP_DIR="$(mktemp -d)"
DUMP_PATH="${TMP_DIR}/pipelineiq_${TIMESTAMP}.sql"
ARCHIVE_PATH="${DUMP_PATH}.gz"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] pg_dump is required but not found in PATH" >&2
  exit 1
fi

echo "[backup] creating database dump (${TIMESTAMP})"
pg_dump --no-owner --no-privileges --format=plain "${DATABASE_URL}" > "${DUMP_PATH}"
gzip -9 "${DUMP_PATH}"

case "${BACKUP_PROVIDER}" in
  gcs)
    if ! command -v gcloud >/dev/null 2>&1; then
      echo "[backup] gcloud CLI is required for BACKUP_PROVIDER=gcs" >&2
      exit 1
    fi
    gcloud storage cp "${ARCHIVE_PATH}" "gs://${BACKUP_BUCKET}/${OBJECT_KEY}"
    ;;
  s3)
    if ! command -v aws >/dev/null 2>&1; then
      echo "[backup] aws CLI is required for BACKUP_PROVIDER=s3" >&2
      exit 1
    fi
    aws s3 cp "${ARCHIVE_PATH}" "s3://${BACKUP_BUCKET}/${OBJECT_KEY}"
    ;;
  *)
    echo "[backup] Unsupported BACKUP_PROVIDER=${BACKUP_PROVIDER}. Use gcs or s3." >&2
    exit 1
    ;;
esac

echo "[backup] upload complete: ${OBJECT_KEY}"
