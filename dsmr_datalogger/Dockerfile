# https://contributors.home-assistant.io/apps/guides/dockerfile/
ARG BUILD_FROM=ghcr.io/home-assistant/base-python:3.14-alpine3.24
FROM ${BUILD_FROM}
ARG BUILD_ARCH
ARG BUILD_VERSION

ENV LANG=C.UTF-8

COPY requirements.txt /
RUN pip install --no-cache-dir -r /requirements.txt

COPY rootfs /
RUN mkdir -p /etc/dsmr_logs

# Labels
LABEL \
  io.hass.version=${BUILD_VERSION} \
  io.hass.type="app" \
  io.hass.arch=${BUILD_ARCH} \
  org.opencontainers.image.title="Home Assistant App: DSMR Datalogger" \
  org.opencontainers.image.description="The datalogger only option of DSMR (https://dsmr-reader.readthedocs.io)" \
  org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
  org.opencontainers.image.licenses="Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)"
