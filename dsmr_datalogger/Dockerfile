ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG=C.UTF-8
# Copy data for add-on
COPY config.json /app/ha_addon_version.json
COPY rootfs /
COPY dsmr_datalogger_api_client.py ./
COPY requirements.txt /
RUN mkdir -p /etc/dsmr_logs
RUN pip install --no-cache-dir -r requirements.txt

# Labels
LABEL \
  io.hass.version=$HA_RELEASE \
  io.hass.type="addon" \
  io.hass.arch=$BUILD_ARCH \
  org.opencontainers.image.title="Home Assistant Add-on: DSMR Datalogger"  \
  org.opencontainers.image.description="The datalogger only option of DSMR (https://dsmr-reader.readthedocs.io)"  \
  org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
  org.opencontainers.image.licenses="Apache License 2.0"