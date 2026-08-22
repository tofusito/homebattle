#!/usr/bin/env bash

set -euo pipefail

readonly IMAGE="${1:?Usage: deploy-homelab.sh <image>}"
readonly STACK_DIR="/home/tofu/docker/dockerhand/data/stacks/Homelab/happy-home"
readonly RUNTIME_DIR="/home/tofu/docker/happy-home/deploy"
readonly VAPID_FILE="${RUNTIME_DIR}/vapid.env"
readonly OVERRIDE_FILE="${RUNTIME_DIR}/compose.override.yaml"

get_container_env() {
  local container="$1"
  local key="$2"

  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${container}" \
    | sed -n "s/^${key}=//p" \
    | head -n 1
}

require_value() {
  local name="$1"
  local value="$2"

  if [[ -z "${value}" ]]; then
    echo "Missing required runtime value: ${name}" >&2
    exit 1
  fi
}

wait_for_health() {
  local attempts=45

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    local state
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' happy-home 2>/dev/null || true)"
    if [[ "${state}" == "healthy" ]]; then
      return 0
    fi
    if [[ "${state}" == "exited" || "${state}" == "dead" ]]; then
      return 1
    fi
    sleep 2
  done

  return 1
}

docker image inspect "${IMAGE}" >/dev/null

readonly PREVIOUS_IMAGE="$(docker inspect --format '{{.Config.Image}}' happy-home)"
require_value "previous image" "${PREVIOUS_IMAGE}"

export TZ="$(get_container_env happy-home TZ)"
export SITE_URL="$(get_container_env happy-home SITE_URL)"
export MONGO_DATABASE="$(get_container_env happy-home MONGODB_DATABASE)"
export MONGO_APP_USERNAME="$(get_container_env happy-home MONGODB_USERNAME)"
export MONGO_APP_PASSWORD="$(get_container_env happy-home MONGODB_PASSWORD)"
export MONGO_ROOT_USERNAME="$(get_container_env happy-home-mongo MONGO_INITDB_ROOT_USERNAME)"
export MONGO_ROOT_PASSWORD="$(get_container_env happy-home-mongo MONGO_INITDB_ROOT_PASSWORD)"
export BACKUP_RETENTION_DAYS="$(get_container_env happy-home-backup BACKUP_RETENTION_DAYS)"
export BACKUP_INTERVAL_SECONDS="$(get_container_env happy-home-backup BACKUP_INTERVAL_SECONDS)"
export TUNNEL_TOKEN="$(get_container_env cloudflare-happy-home TUNNEL_TOKEN)"

require_value "SITE_URL" "${SITE_URL}"
require_value "MONGO_DATABASE" "${MONGO_DATABASE}"
require_value "MONGO_APP_USERNAME" "${MONGO_APP_USERNAME}"
require_value "MONGO_APP_PASSWORD" "${MONGO_APP_PASSWORD}"
require_value "MONGO_ROOT_USERNAME" "${MONGO_ROOT_USERNAME}"
require_value "MONGO_ROOT_PASSWORD" "${MONGO_ROOT_PASSWORD}"
require_value "TUNNEL_TOKEN" "${TUNNEL_TOKEN}"

install -d -m 700 "${RUNTIME_DIR}"

if [[ -s "${VAPID_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${VAPID_FILE}"
else
  readonly VAPID_JSON="$(
    docker run --rm --entrypoint node "${IMAGE}" \
      -e "const crypto=require('crypto');const pair=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const pub=pair.publicKey.export({format:'jwk'});const priv=pair.privateKey.export({format:'jwk'});const publicKey=Buffer.concat([Buffer.from([4]),Buffer.from(pub.x,'base64url'),Buffer.from(pub.y,'base64url')]).toString('base64url');process.stdout.write(JSON.stringify({publicKey,privateKey:priv.d}))"
  )"
  VAPID_PUBLIC_KEY="$(jq -r '.publicKey' <<<"${VAPID_JSON}")"
  VAPID_PRIVATE_KEY="$(jq -r '.privateKey' <<<"${VAPID_JSON}")"
  VAPID_SUBJECT="mailto:happy-home@tofusito.org"

  require_value "VAPID_PUBLIC_KEY" "${VAPID_PUBLIC_KEY}"
  require_value "VAPID_PRIVATE_KEY" "${VAPID_PRIVATE_KEY}"

  umask 077
  printf 'VAPID_SUBJECT=%s\nVAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n' \
    "${VAPID_SUBJECT}" "${VAPID_PUBLIC_KEY}" "${VAPID_PRIVATE_KEY}" >"${VAPID_FILE}"
fi

export VAPID_SUBJECT VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY

if [[ ! -f "${OVERRIDE_FILE}" ]]; then
  echo "Missing Compose override: ${OVERRIDE_FILE}" >&2
  exit 1
fi
chmod 600 "${OVERRIDE_FILE}"

deploy_image() {
  local image="$1"
  export HAPPY_HOME_IMAGE="${image}"

  docker compose \
    --project-directory "${STACK_DIR}" \
    --env-file /dev/null \
    -f "${STACK_DIR}/compose.yaml" \
    -f "${OVERRIDE_FILE}" \
    config --quiet

  docker compose \
    --project-directory "${STACK_DIR}" \
    --env-file /dev/null \
    -f "${STACK_DIR}/compose.yaml" \
    -f "${OVERRIDE_FILE}" \
    up -d --no-deps --force-recreate happy-home
}

if ! deploy_image "${IMAGE}" || ! wait_for_health; then
  echo "New image failed its health check; restoring ${PREVIOUS_IMAGE}." >&2
  deploy_image "${PREVIOUS_IMAGE}"
  wait_for_health
  exit 1
fi

echo "Happy Home is healthy on ${IMAGE}."
