# EMQX Production Deployment (3 VPS + Load Balancer)

This setup runs:
- `broker-1` on VPS 1
- `broker-2` on VPS 2
- `broker-3` on VPS 3
- `haproxy` on VPS 4 (public endpoint for clients)

Use this when you want each broker on a separate server instead of one local Docker network.

## 1) Architecture

Traffic flow:
- MQTT clients -> `lb.your-domain.com:1883` (HAProxy)
- HAProxy -> one of `broker-1`, `broker-2`, `broker-3` on port `1883`
- Brokers sync cluster state between themselves on EMQX cluster ports

Cluster model:
- Discovery strategy is static.
- Every node knows the full seed list:
  - `emqx@broker-1.your-domain.com`
  - `emqx@broker-2.your-domain.com`
  - `emqx@broker-3.your-domain.com`

## 2) DNS and Firewall Requirements

Create DNS records:
- `broker-1.your-domain.com` -> VPS 1 public/private IP
- `broker-2.your-domain.com` -> VPS 2 public/private IP
- `broker-3.your-domain.com` -> VPS 3 public/private IP
- `lb.your-domain.com` -> VPS 4 public IP

Open firewall ports:
- On LB VPS:
  - `1883/tcp` from clients
- On broker VPSs:
  - `1883/tcp` from LB VPS
  - `18083/tcp` from your admin IP (optional dashboard access)
  - `4370/tcp` from broker VPSs only (Erlang distribution)
  - `5369/tcp` from broker VPSs only (cluster RPC in Docker)

Reference: EMQX docs list `4370` and `5369` for Docker-based cluster communication.

## 3) Deploy Brokers (repeat on each broker VPS)

Install Docker + Docker Compose plugin, then copy this folder to the server.

On each broker VPS:

1. Copy env template:
```bash
cp broker.env.example .env
```

2. Edit `.env`:
- `EMQX_NODE_NAME` must match that broker FQDN
- `EMQX_CLUSTER_STATIC_SEEDS` must include all 3 broker node names
- `EMQX_NODE_COOKIE` must be identical on all 3 brokers
- `EMQX_DASHBOARD_PASS` should be changed

3. Start broker:
```bash
docker compose -f broker-compose.yml up -d
```

4. Check local node:
```bash
docker compose -f broker-compose.yml exec -T emqx sh -lc "emqx ctl status || /opt/emqx/bin/emqx ctl status"
```

After all 3 are up, verify cluster from any broker:
```bash
docker compose -f broker-compose.yml exec -T emqx sh -lc "emqx ctl cluster status || /opt/emqx/bin/emqx ctl cluster status"
```

You should see all 3 node names.

## 4) Deploy Load Balancer (on LB VPS)

1. Copy env template:
```bash
cp lb.env.example .env
```

2. Edit `.env` with broker DNS names/IPs.

3. Start HAProxy:
```bash
docker compose -f lb-compose.yml up -d
```

4. Confirm LB listening:
```bash
docker compose -f lb-compose.yml ps
```

## 5) End-to-End Tests

Run from your laptop or any host with Docker access to LB:

1. Simple publish/subscribe through LB:
```bash
./scripts/test-lb-e2e.sh lb.your-domain.com 1883
```

2. Cross-node routing test:
- Subscribe via LB (`lb:1883`)
- Publish directly to `broker-2:1883`
- Subscriber should still receive the message (proves cluster forwarding)

```bash
./scripts/test-cross-node.sh lb.your-domain.com 1883 broker-2.your-domain.com 1883
```

3. Failover test:
- Keep a subscriber connected to LB.
- Stop one broker:
```bash
docker compose -f broker-compose.yml stop emqx
```
- Publish again via LB and verify delivery still works.

## 6) Notes for NestJS Clients

In production, point clients to the LB endpoint:
- host: `lb.your-domain.com`
- port: `1883`

Optionally still keep a broker list as fallback if your client library supports it.
