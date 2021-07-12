ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

RUN apt-get update \
    && apt-get install -y openjdk-11-jdk openjdk-11-jre
ADD https://downloads.metabase.com/v0.40.0/metabase.jar /home

ENV MB_DB_TYPE=postgres
COPY run.sh /
RUN chmod a+x /run.sh

EXPOSE 3000
CMD [ "/run.sh" ]

# Labels
LABEL \
    io.hass.name="Metabase" \
    io.hass.description="Home Assistant Add-on: Metabase" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=0.3.0 \
    maintainer="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.title="Metabase" \
    org.opencontainers.image.description="Home Assistant Add-on: Metabase" \
    org.opencontainers.image.vendor="Sanderdw's add-on repository" \
    org.opencontainers.image.authors="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.licenses="GNU Affero General Public License (AGPL)" \
    org.opencontainers.image.url="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.documentation="https://raw.githubusercontent.com/sanderdw/hassio-addons/master/README.md" \
    org.opencontainers.image.version=0.3.0