ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG=C.UTF-8
# Copy data for add-on
COPY config.json /app/ha_addon_version.json

ADD https://binaries.twingate.com/client/linux/install.sh /app/install.sh
RUN chmod a+x /app/install.sh
RUN /app/install.sh

# HOMEASSISTANT Add-On OVERRIDES
COPY rootfs /

RUN chmod a+x /etc/s6-overlay/s6-rc.d/init-docker-entrypoint/run

# Labels
LABEL \
  io.hass.version=$HA_RELEASE \
  io.hass.type="addon" \
  io.hass.arch=$BUILD_ARCH
