#!/usr/bin/env bash
set -euo pipefail

LB_HOST="${1:-localhost}"
LB_PORT="${2:-1883}"
DIRECT_BROKER_HOST="${3:-broker-2.your-domain.com}"
DIRECT_BROKER_PORT="${4:-1883}"
TOPIC="cars/test/events/cross-node"
PAYLOAD="cross-ok-$(date +%s%3N)"

echo "Subscribing through LB ${LB_HOST}:${LB_PORT}"
docker run --rm eclipse-mosquitto:2.0 sh -lc \
  "mosquitto_sub -h '${LB_HOST}' -p '${LB_PORT}' -t '${TOPIC}' -C 1 -W 20" \
  > /tmp/mqtt-cross-node.out &
SUB_PID=$!

sleep 2

echo "Publishing directly to broker ${DIRECT_BROKER_HOST}:${DIRECT_BROKER_PORT}"
docker run --rm eclipse-mosquitto:2.0 sh -lc \
  "mosquitto_pub -h '${DIRECT_BROKER_HOST}' -p '${DIRECT_BROKER_PORT}' -t '${TOPIC}' -m '${PAYLOAD}'"

wait "${SUB_PID}" || true

if grep -q "${PAYLOAD}" /tmp/mqtt-cross-node.out; then
  echo "PASS: Cross-node routing works (${PAYLOAD})"
  rm -f /tmp/mqtt-cross-node.out
  exit 0
fi

echo "FAIL: LB subscriber did not receive direct broker publish"
echo "Expected: ${PAYLOAD}"
echo "Received:"
cat /tmp/mqtt-cross-node.out || true
rm -f /tmp/mqtt-cross-node.out
exit 1
