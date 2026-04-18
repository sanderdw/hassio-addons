# VoltViz Home Assistant Add-on: Technical Documentation

## Overview

This document describes how the VoltViz Home Assistant add-on was built, how the
Sendspin proxy works, and how the sendspin-js runtime patch can be reverted once
the upstream fix is released.

---

## Architecture

The add-on supports two access modes:

### Mode 1: Via HA Ingress (recommended, works over HTTPS)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (HTTPS)                                                     │
│                                                                     │
│  VoltViz UI ──▶ Sendspin URL pre-filled to ./sendspin-proxy/        │
│       │                                                             │
│       ├─ HTTP requests ──▶ https://ha.example.com/local_voltviz/    │
│       │                    (served by HA Ingress → nginx:8099)       │
│       │                                                             │
│       └─ WebSocket ──────▶ wss://ha.example.com/local_voltviz/      │
│                            sendspin-proxy/sendspin                   │
│                            (HA Ingress → nginx:8099 → proxy)        │
└─────────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌──────────────────────┐          ┌────────────────────────────────┐
│ Home Assistant        │          │ VoltViz Add-on Container       │
│ Ingress Proxy         │ ──────▶ │                                │
│ (172.30.32.2)         │  :8099  │  nginx (ingress.conf)          │
│                       │         │  ├── / → static files (SPA)    │
│                       │         │  └── /sendspin-proxy/ → proxy  │
│                       │         │       to Music Assistant        │
└──────────────────────┘          └───────────┬────────────────────┘
                                              │
                                              ▼ HTTP/WS
                                  ┌──────────────────────────┐
                                  │ Music Assistant           │
                                  │ d5369777-music-assistant  │
                                  │ :8927                     │
                                  └──────────────────────────┘
```

### Mode 2: Direct access (non-ingress, port 80 → host 8099)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (HTTP)                                                      │
│                                                                     │
│  VoltViz UI ──▶ http://192.168.100.60:8099                          │
│       │                                                             │
│       ├─ HTTP requests ──▶ direct to container port 80              │
│       │                    (served by nginx default.conf)            │
│       │                                                             │
│       └─ WebSocket ──────▶ ws://192.168.100.60:8099/                │
│                            sendspin-proxy/sendspin                   │
│                            (nginx default.conf → proxy)             │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────┐
│ VoltViz Add-on Container       │
│                                │
│  nginx (default.conf :80)      │
│  ├── / → static files (SPA)    │
│  └── /sendspin-proxy/ → proxy  │ ← injected by run.sh at startup
│       to Music Assistant       │
└───────────┬────────────────────┘
            │
            ▼ HTTP/WS
┌──────────────────────────┐
│ Music Assistant           │
│ d5369777-music-assistant  │
│ :8927                     │
└──────────────────────────┘
```

---

## File Structure

```
voltviz/
├── config.json                          # HA add-on configuration
├── Dockerfile                           # Layers HA config on top of published VoltViz image
├── run.sh                               # Entrypoint: patches JS + generates nginx proxy config
├── CHANGELOG.md
├── README.md
└── rootfs/
    └── etc/nginx/conf.d/
        └── ingress.conf                 # Nginx config for HA Ingress (port 8099)
```

---

## How Dual Access Works

### Ingress (port 8099 inside container)

Home Assistant Ingress proxies browser requests to the add-on container.

1. `config.json` sets `"ingress": true` and `"ingress_stream": true` (for WebSocket support)
2. HA Ingress connects to the container on port **8099** (the default `ingress_port`)
3. Only requests from `172.30.32.2` (the HA Ingress proxy) are accepted
4. The nginx `sub_filter` directives rewrite absolute paths (`href="/..."`) to
   relative paths (`href="./..."`) so the SPA works behind the ingress path prefix

### Direct access (port 80 inside container → host port 8099)

The original VoltViz `default.conf` already serves the SPA on port 80. The
add-on exposes this as host port 8099 by default (`"80/tcp": 8099` in config.json).

- `"webui": "http://[HOST]:[PORT:80]"` enables the "OPEN WEB UI" button for direct access
- At startup, `run.sh` injects `include /etc/nginx/addon.d/*.conf;` into `default.conf`
  so the `/sendspin-proxy/` location is available on both ports
- Users can change or disable the port mapping in the add-on Network settings

### ingress.conf

```nginx
server {
    listen 8099;
    allow  172.30.32.2;   # Only HA Ingress
    deny   all;

    root /usr/share/nginx/html;
    index index.html;

    # Rewrite absolute paths to relative for Ingress support
    sub_filter_types text/html;
    sub_filter_once off;
    sub_filter 'href="/' 'href="./';
    sub_filter 'src="/' 'src="./';

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Optional Sendspin proxy config (generated by run.sh at startup)
    include /etc/nginx/addon.d/*.conf;
}
```

---

## Sendspin Proxy

### The Problem

VoltViz connects to a Sendspin server (e.g. Music Assistant) for synchronized
audio streaming. The sendspin-js library uses WebSockets for this connection.

When accessing VoltViz over **HTTPS** (e.g. `https://ha.sanwil.net`), the browser
blocks WebSocket connections to plain **HTTP** servers on the local network due to
**mixed content restrictions**. The user cannot connect to
`http://192.168.100.60:8927` from an HTTPS page.

### The Solution

The add-on proxies Sendspin traffic server-side through nginx:

1. `SENDSPIN_URL` defaults to `http://d5369777-music-assistant:8927` in the add-on config
   (works out of the box for most Music Assistant setups)
2. At startup, `run.sh` generates an nginx `location /sendspin-proxy/` block that
   proxies all requests (including WebSocket upgrades) to that URL
3. The proxy config is shared between both nginx configs (ingress and direct)
   via the `/etc/nginx/addon.d/` include directory
4. The Sendspin URL input in VoltViz is pre-filled with `./sendspin-proxy/` — the
   user just clicks Connect

### Generated nginx proxy config

When `SENDSPIN_URL` is set, `run.sh` writes this to `/etc/nginx/addon.d/sendspin-proxy.conf`:

```nginx
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

Key details:
- `proxy_http_version 1.1` + `Upgrade`/`Connection` headers enable WebSocket proxying
- `proxy_read_timeout 86400` keeps long-lived WebSocket connections alive (24h)
- The trailing `/` on `proxy_pass` strips the `/sendspin-proxy/` prefix before forwarding

### Proxy shared between ingress and direct access

The proxy config is written to `/etc/nginx/addon.d/sendspin-proxy.conf` and
included by both nginx server blocks:

- **ingress.conf** (port 8099) — has `include /etc/nginx/addon.d/*.conf;` built-in
- **default.conf** (port 80) — `run.sh` injects the include at startup via:
  ```bash
  sed -i '/^}/i\    include /etc/nginx/addon.d/*.conf;' /etc/nginx/conf.d/default.conf
  ```

This ensures `/sendspin-proxy/` works regardless of how the user accesses VoltViz.

---

## sendspin-js Runtime Patch

### Why the Patch is Needed

The sendspin-js library (v3.0.3) has two issues that prevent it from working
behind a reverse proxy:

**Issue 1: No relative URL support**

```ts
// src/index.ts line 220
const url = new URL(this.config.baseUrl);
```

`new URL("./sendspin-proxy/")` throws a `TypeError` because relative URLs require
a base argument.

**Issue 2: Path is discarded in WebSocket URL**

```ts
// src/index.ts line 222
this.wsUrl = `${wsProtocol}//${url.host}/sendspin`;
```

This uses only `url.host`, so `https://ha.example.com/local_voltviz/sendspin-proxy/`
becomes `wss://ha.example.com/sendspin` — the proxy path is lost entirely.

### How the Patch Works

At container startup, `run.sh` uses `sed` to patch the minified JavaScript
bundles in `/usr/share/nginx/html/assets/`:

#### Patch 1: Support relative URLs

```bash
sed -i 's|new URL(this\.config\.baseUrl)|new URL(this.config.baseUrl,window.location.href)|g' "$ASSETS"/*.js
```

**Before (minified):** `new URL(this.config.baseUrl)`
**After (minified):**  `new URL(this.config.baseUrl,window.location.href)`

This makes `./sendspin-proxy/` resolve against the current page URL.

#### Patch 2: Preserve path in WebSocket URL

```bash
sed -i 's|\([a-zA-Z_$][a-zA-Z0-9_$]*\)\.host}/sendspin|\1.host}${\1.pathname.replace(/\\/$/,"")}/sendspin|g' "$ASSETS"/*.js
```

**Before (minified):** `${e.host}/sendspin`
**After (minified):**  `${e.host}${e.pathname.replace(/\/$/,"")}/sendspin`

This preserves the full path from the URL, stripping only the trailing slash.

#### Patch 3: Pre-fill Sendspin URL default

```bash
sed -i 's|useState("")|useState("./sendspin-proxy/")|g' "$ASSETS"/*.js
```

**Before:** `useState("")` (empty Sendspin URL field)
**After:**  `useState("./sendspin-proxy/")` (pre-filled with proxy path)

In VoltViz, `useState("")` is only used for the `sendspinUrl` state variable.
This makes the Sendspin dialog open with the proxy URL already filled in.

#### Patch 4: Update placeholder text

```bash
sed -i 's|http://homeassistant\.local:8927|./sendspin-proxy/|g' "$ASSETS"/*.js
```

**Before:** placeholder shows `http://homeassistant.local:8927`
**After:**  placeholder shows `./sendspin-proxy/`

#### Backward Compatibility

All patches are backward-compatible with absolute URLs:
- `new URL("http://192.168.1.100:8927", window.location.href)` → works fine
  (base is ignored for absolute URLs)
- `pathname` for `http://192.168.1.100:8927` is `/`, which after
  `replace(/\/$/, "")` becomes `""`, producing the same result as before
- Patches 3 and 4 only change defaults — users can still type any URL

### Upstream Fix

A PR has been submitted to fix this properly in sendspin-js:

- **Issue:** https://github.com/Sendspin/sendspin-js/issues/91
- **PR:** https://github.com/Sendspin/sendspin-js/pull/92

The PR makes the same two changes in the TypeScript source.

---

## How to Revert the Patch

Once the upstream sendspin-js fix is released and VoltViz updates its dependency
to the fixed version, the runtime patch in `run.sh` is no longer needed.

### Steps to revert

1. **Update the base image** in `Dockerfile` and the workflow to the new VoltViz
   version that includes the fixed sendspin-js:

   ```dockerfile
   ARG BUILD_FROM=ghcr.io/sanderdw/voltviz:<NEW_VERSION>
   ```

2. **Remove the patch block** from `run.sh`. Delete everything from the
   `# ---------------------------------------------------------------------------` comment down to and including the Patch 4 line.
   Keep the `#!/bin/sh`, `CONFIG_PATH=...`, and everything from
   `# Create addon.d directory` onward.

   The resulting `run.sh` should look like:

   ```sh
   #!/bin/sh
   CONFIG_PATH=/data/options.json

   # Create addon.d directory for optional nginx includes
   mkdir -p /etc/nginx/addon.d

   # Inject addon.d include into default.conf (port 80) for non-ingress access
   if ! grep -q 'addon.d' /etc/nginx/conf.d/default.conf 2>/dev/null; then
       sed -i '/^}/i\    include /etc/nginx/addon.d/*.conf;' /etc/nginx/conf.d/default.conf
       echo "VoltViz: Added sendspin proxy include to default.conf (port 80)"
   fi

   # Generate Sendspin proxy config if SENDSPIN_URL is configured
   if [ -f "$CONFIG_PATH" ]; then
       SENDSPIN_URL=$(jq --raw-output '.SENDSPIN_URL // empty' "$CONFIG_PATH")

       if [ -n "$SENDSPIN_URL" ]; then
           SENDSPIN_URL=$(echo "$SENDSPIN_URL" | sed 's|/$||')
           echo "VoltViz: Sendspin proxy enabled -> ${SENDSPIN_URL}"

           cat > /etc/nginx/addon.d/sendspin-proxy.conf << PROXYEOF
   location /sendspin-proxy/ {
       proxy_pass ${SENDSPIN_URL}/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade \$http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host \$host;
       proxy_set_header X-Real-IP \$remote_addr;
       proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
       proxy_read_timeout 86400;
       proxy_send_timeout 86400;
   }
   PROXYEOF
       fi
   fi

   exec nginx -g "daemon off;"
   ```

3. **Bump the version** in `config.json`

4. **Update CHANGELOG.md** noting the patch removal

> **Note:** The nginx proxy (`/sendspin-proxy/`) is still needed even after the
> upstream fix. The patch only affects how sendspin-js constructs its WebSocket
> URL. The actual proxying from the container to Music Assistant remains necessary
> to avoid mixed content issues.

---

## Configuration Reference

### config.json options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `SENDSPIN_URL` | `str?` | `http://d5369777-music-assistant:8927` | Internal URL of the Sendspin server |

### config.json key settings

| Setting | Value | Purpose |
|---------|-------|----------|
| `ingress` | `true` | Enable HA Ingress |
| `ingress_stream` | `true` | Enable WebSocket streaming through Ingress |
| `webui` | `http://[HOST]:[PORT:80]` | Direct access "OPEN WEB UI" button |
| `ports` | `{"80/tcp": 8099}` | Container port 80 mapped to host port 8099 |
| `init` | `false` | VoltViz image has its own CMD (nginx) |

### User setup

1. Install the add-on from the repository
2. `SENDSPIN_URL` defaults to Music Assistant — change if needed
3. Start the add-on
4. Click **OPEN WEB UI** (via Ingress or direct access)
5. Click the Sendspin button — the URL is pre-filled with `./sendspin-proxy/`
6. Click Connect

### Access modes

| Mode | URL | Sendspin proxy |
|------|-----|----------------|
| Ingress (HTTPS) | `https://ha.example.com/local_voltviz/` | `./sendspin-proxy/` ✅ |
| Direct (HTTP) | `http://192.168.100.60:8099/` | `./sendspin-proxy/` ✅ |
