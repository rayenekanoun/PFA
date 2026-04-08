#!/usr/bin/env bash
set -euo pipefail

LB_HOST="${1:-localhost}"
LB_PORT="${2:-1883}"
TOPIC="cars/test/events/lb-e2e"
PAYLOAD="lb-ok-$(date +%s%3N)"

echo "Subscribing via LB ${LB_HOST}:${LB_PORT} on topic ${TOPIC}"
docker run --rm eclipse-mosquitto:2.0 sh -lc \
  "mosquitto_sub -h '${LB_HOST}' -p '${LB_PORT}' -t '${TOPIC}' -C 1 -W 20" \
  > /tmp/mqtt-lb-e2e.out &
SUB_PID=$!

sleep 2

echo "Publishing via LB ${LB_HOST}:${LB_PORT}"
docker run --rm eclipse-mosquitto:2.0 sh -lc \
  "mosquitto_pub -h '${LB_HOST}' -p '${LB_PORT}' -t '${TOPIC}' -m '${PAYLOAD}'"

wait "${SUB_PID}" || true

if grep -q "${PAYLOAD}" /tmp/mqtt-lb-e2e.out; then
  echo "PASS: LB publish/subscribe works (${PAYLOAD})"
  rm -f /tmp/mqtt-lb-e2e.out
  exit 0
fi

echo "FAIL: expected payload not received"
echo "Expected: ${PAYLOAD}"
echo "Received:"
cat /tmp/mqtt-lb-e2e.out || true
rm -f /tmp/mqtt-lb-e2e.out
exit 1
