ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*

RUN \
    mkdir -p /usr/src/bashio \
    && curl -L -f -s "https://github.com/hassio-addons/bashio/archive/refs/tags/v0.17.5.tar.gz" \
        | tar -xzf - --strip 1 -C /usr/src/bashio \
    && mv /usr/src/bashio/lib /usr/lib/bashio \
    && ln -s /usr/lib/bashio/bashio /usr/bin/bashio \
    \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/src/*

# HOMEASSISTANT app OVERRIDES
COPY rootfs /
RUN chmod a+x /etc/s6-overlay/s6-rc.d/set-hassio-vars/run /etc/s6-overlay/s6-rc.d/init-mqtt-home-assistant/run

# The backend publishes to MQTT, so it starts after init-mqtt-home-assistant has set MQTT up.
# The base image's file has no newline at its end.
RUN dependencies=/etc/s6-overlay/s6-rc.d/svc-dsmr-backend/dependencies \
    && test -f "${dependencies}" \
    && printf '\n%s\n' init-mqtt-home-assistant >> "${dependencies}"

ENV DUID=0
ENV DGID=0

# The base image's log services ignore the stop signal (s6-log -p), so the container never
# stopped by itself: the Supervisor killed it after its stop timeout and reported an error.
# Their services have stopped writing by then; end them one second after they are told to stop.
RUN set -e; for service in /etc/s6-overlay/s6-rc.d/svc-*-log; do echo 1000 > "${service}/timeout-kill"; done

# The base image checks every 5 seconds during the first minute and every 2 minutes after that,
# so a start that takes longer than a minute (a migration, a slow machine) showed as "starting"
# for up to 2 more minutes. Keep checking every 5 seconds for the first 15 minutes. Failed checks
# do not count in that time, so a long migration is not restarted by the watchdog either.
HEALTHCHECK --interval=120s --timeout=5s --start-period=900s --start-interval=5s --retries=3 \
    CMD /app/healthcheck.sh || exit 1

# Labels
LABEL \
  io.hass.version=$HA_RELEASE \
  io.hass.type="addon" \
  io.hass.arch=$BUILD_ARCH
