#!/bin/sh
CONFIG_PATH=/data/options.json

# ---------------------------------------------------------------------------
# Patch sendspin-js in the bundled JS so it works behind HA Ingress proxy.
#
# 1. Allow relative URLs (e.g. ./sendspin-proxy/) by adding a base to new URL()
#    Original:  new URL(this.config.baseUrl)
#    Patched:   new URL(this.config.baseUrl,window.location.href)
#
# 2. Preserve the URL path when constructing the WebSocket URL.
#    Original:  VARNAME.host}/sendspin          (discards path)
#    Patched:   VARNAME.host}${VARNAME.pathname.replace(/\/$/,"")}/sendspin
#
# Both patches are backward-compatible with absolute URLs.
# ---------------------------------------------------------------------------
ASSETS=/usr/share/nginx/html/assets

# Patch 1: support relative baseUrl
sed -i 's|new URL(this\.config\.baseUrl)|new URL(this.config.baseUrl,window.location.href)|g' "$ASSETS"/*.js 2>/dev/null \
    && echo "VoltViz: Patched sendspin-js to support relative URLs"

# Patch 2: preserve path in WebSocket URL
if grep -rq '\.host}/sendspin' "$ASSETS"/ 2>/dev/null; then
    sed -i 's|\([a-zA-Z_$][a-zA-Z0-9_$]*\)\.host}/sendspin|\1.host}${\1.pathname.replace(/\\/$/,"")}/sendspin|g' "$ASSETS"/*.js
    echo "VoltViz: Patched sendspin-js to preserve URL path for WebSocket"
else
    echo "VoltViz: Warning - sendspin-js WebSocket pattern not found, proxy may not work"
fi

# Create addon.d directory for optional nginx includes
mkdir -p /etc/nginx/addon.d

# Generate Sendspin proxy config if SENDSPIN_URL is configured
if [ -f "$CONFIG_PATH" ]; then
    SENDSPIN_URL=$(jq --raw-output '.SENDSPIN_URL // empty' "$CONFIG_PATH")

    if [ -n "$SENDSPIN_URL" ]; then
        # Strip trailing slash for consistent proxy_pass behavior
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
