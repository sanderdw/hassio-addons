ARG BUILD_FROM=busybox:dummy
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG=C.UTF-8
# Copy data for add-on
COPY config.json /app/ha_addon_version.json
COPY rootfs /
RUN mkdir -p /etc/dsmr_logs
COPY requirements.txt /
RUN pip install --no-cache-dir -r requirements.txt

# Labels
LABEL \
  io.hass.version=$HA_RELEASE \
  io.hass.type="addon" \
  io.hass.arch=$BUILD_ARCH \
  org.opencontainers.image.title="Home Assistant Add-on: DSMR Datalogger"  \
  org.opencontainers.image.description="The datalogger only option of DSMR (https://dsmr-reader.readthedocs.io)"  \
  org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
  org.opencontainers.image.licenses="Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)"