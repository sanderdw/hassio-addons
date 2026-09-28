# VoltViz Home Assistant App: Architecture

This document describes how the VoltViz Home Assistant app wraps the upstream
VoltViz image, how it is reached (Ingress or direct), and how the Sendspin
proxy connects it to Music Assistant.

## Overview

The app does not build VoltViz itself. The `Dockerfile` layers Home Assistant
integration on top of the published `ghcr.io/sanderdw/voltviz` image (an nginx
image serving the VoltViz single-page app):

```mermaid
flowchart LR
    upstream["ghcr.io/sanderdw/voltviz:VERSION<br/>nginx + VoltViz SPA"]
    subgraph app["VoltViz app image"]
        direction TB
        rootfs["rootfs/ingress.conf<br/>(port 8099 server)"]
        run["run.sh<br/>(entrypoint)"]
    end
    upstream -->|"FROM (BASE_IMAGE)"| app
    app -->|"published as"| out["ghcr.io/sanderdw/hassio-addons/<br/>ha-voltviz-ARCH"]
```

The base image tag is pinned in `.github/workflows/voltviz.yml` and matches
`version` in `config.json`.

## Access modes

The app can be opened through Home Assistant Ingress (recommended, works over
HTTPS) or directly on a host port.

```mermaid
flowchart TB
    subgraph browser["Browser"]
        ui["VoltViz UI"]
    end

    subgraph ha["Home Assistant"]
        ingress["Ingress proxy<br/>172.30.32.2"]
    end

    subgraph container["VoltViz app container (nginx)"]
        ing["ingress.conf<br/>:8099"]
        def["default.conf<br/>:80 (host port 8099)"]
        proxy["/sendspin-proxy/<br/>addon.d/sendspin-proxy.conf"]
        spa["static SPA files"]
    end

    ma["Music Assistant<br/>d5369777-music-assistant:8927"]

    ui -->|"HTTPS, via HA"| ingress
    ingress -->|":8099"| ing
    ui -->|"HTTP, direct"| def
    ing --> spa
    def --> spa
    ing --> proxy
    def --> proxy
    proxy -->|"HTTP + WebSocket"| ma
```

| Mode | URL | Nginx server | Sendspin URL |
|------|-----|--------------|--------------|
| Ingress (HTTPS) | `https://ha.example.com/...` (app panel) | `ingress.conf`, port 8099 | `./sendspin-proxy/` |
| Direct (HTTP) | `http://<host>:8099/` | `default.conf`, port 80 | `./sendspin-proxy/` |

### Ingress (port 8099 inside the container)

1. `config.json` sets `"ingress": true` and `"ingress_stream": true` (WebSocket support).
2. Home Assistant connects to the container on port **8099** (the default `ingress_port`).
3. `ingress.conf` only accepts requests from `172.30.32.2` (the Ingress proxy).
4. `sub_filter` rewrites absolute `href="/` and `src="/` paths to relative
   (`./`) so the SPA works behind the Ingress path prefix.

### Direct access (port 80 inside the container, host port 8099)

- The upstream `default.conf` already serves the SPA on port 80. `config.json`
  maps it with `"ports": {"80/tcp": 8099}` and `"webui": "http://[HOST]:[PORT:80]"`
  enables the **OPEN WEB UI** button.
- `run.sh` patches `default.conf` at startup (see below) so the proxy and the
  Sendspin pre-fill also work on this port.
- The port mapping can be changed or disabled in the app's Network settings.

## File structure

```text
voltviz/
├── config.json                          # HA app configuration and schema
├── Dockerfile                           # Layers HA integration on the VoltViz image
├── run.sh                               # Entrypoint (see startup sequence)
├── CHANGELOG.md
├── README.md
├── docs/                                # This document and the development story
└── rootfs/etc/nginx/conf.d/
    └── ingress.conf                     # Nginx server for HA Ingress (port 8099)
```

## Startup sequence

`run.sh` runs on every container start:

```mermaid
flowchart TD
    start(["Container start"]) --> log["Log app version"]
    log --> mk["mkdir /etc/nginx/addon.d"]
    mk --> inject["Patch default.conf (port 80, once):<br/>include addon.d/*.conf<br/>+ ?sendspin= redirect"]
    inject --> has{"SENDSPIN_URL set?"}
    has -- no --> nginx
    has -- yes --> conf["Write addon.d/sendspin-proxy.conf"]
    conf --> slug{"MA slug + SUPERVISOR_TOKEN<br/>available?"}
    slug -- no --> nginx
    slug -- yes --> api["Supervisor API: get MA ingress_entry"]
    api --> json["Write html/ma-config.json"]
    json --> nginx(["exec nginx"])
```

## Sendspin proxy

### The problem

VoltViz connects to a Sendspin server (Music Assistant) over WebSocket. On an
**HTTPS** page (for example Home Assistant behind a reverse proxy) the browser
blocks WebSocket connections to a plain **HTTP** server on the local network
(mixed content), so `http://192.168.x.x:8927` cannot be used directly.

### The solution

nginx proxies Sendspin traffic server-side, so the browser only talks to the
same origin:

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as nginx (app container)
    participant M as Music Assistant

    B->>N: GET / (no sendspin param)
    N-->>B: 302 ?sendspin=./sendspin-proxy/
    B->>N: GET /?sendspin=./sendspin-proxy/
    N-->>B: SPA (Sendspin dialog pre-filled)
    B->>N: WebSocket /sendspin-proxy/sendspin
    N->>M: WebSocket /sendspin (prefix stripped)
    M-->>B: audio stream (via nginx)
```

1. `SENDSPIN_URL` defaults to `http://d5369777-music-assistant:8927` and is read
   from `/data/options.json`.
2. `run.sh` generates `location /sendspin-proxy/` in
   `/etc/nginx/addon.d/sendspin-proxy.conf`. The trailing `/` on `proxy_pass`
   strips the prefix, and the `Upgrade`/`Connection` headers plus a 24 h
   `proxy_read_timeout` keep WebSockets alive.
3. Both nginx servers include `/etc/nginx/addon.d/*.conf`: `ingress.conf` has
   the include built in, `run.sh` injects it into `default.conf`.
4. On the first page load nginx redirects to `?sendspin=./sendspin-proxy/` when
   no `sendspin` parameter is present. The redirect is relative so the browser
   keeps the original scheme (an absolute redirect would downgrade to `http://`
   and cause mixed content). VoltViz reads the parameter and pre-fills the
   connect dialog; users can still enter any URL.

```nginx
# Generated: /etc/nginx/addon.d/sendspin-proxy.conf
location /sendspin-proxy/ {
    proxy_pass http://d5369777-music-assistant:8927/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

VoltViz supports relative Sendspin URLs itself. The runtime sendspin-js patch
this app used to apply was removed in 0.15.0.

## Auto-unhide player

Music Assistant hides new players by default. When `SENDSPIN_URL` points at a
Music Assistant app, `run.sh` looks up its Ingress entry through the Supervisor
API and writes it to `/usr/share/nginx/html/ma-config.json`. The frontend reads
that file and unhides the VoltViz player through Music Assistant's Ingress
(already authenticated by Home Assistant). See
[development-story.md](development-story.md) for the background.

## Configuration reference

### `options`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `SENDSPIN_URL` | `str?` | `http://d5369777-music-assistant:8927` | Internal URL of the Sendspin server |

### Key `config.json` settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `ingress` | `true` | Enable HA Ingress |
| `ingress_stream` | `true` | WebSocket streaming through Ingress |
| `webui` | `http://[HOST]:[PORT:80]` | **OPEN WEB UI** button for direct access |
| `ports` | `{"80/tcp": 8099}` | Container port 80 on host port 8099 |
| `hassio_api` | `true` | Supervisor API access (Music Assistant ingress lookup) |
| `init` | `false` | The VoltViz image has its own CMD (nginx) |

### User setup

1. Install the app from the repository.
2. Adjust `SENDSPIN_URL` if Music Assistant runs elsewhere.
3. Start the app and click **OPEN WEB UI**.
4. Click the Sendspin button (the URL is pre-filled with `./sendspin-proxy/`) and connect.
