ARG version=0.4.0
FROM --platform=${BUILDPLATFORM} debian:stable
ARG version

ENV LANG C.UTF-8

RUN apt-get update \
    && apt-get install -y openjdk-11-jdk openjdk-11-jre
ADD https://downloads.metabase.com/v0.42.4/metabase.jar /home

ENV MB_DB_TYPE=postgres
COPY run.sh /
RUN chmod a+x /run.sh

EXPOSE 3000
CMD [ "/run.sh" ]

# Labels
LABEL \
    io.hass.name="Metabase" \
    io.hass.description="Home Assistant Add-on: Metabase" \
    io.hass.arch="aarch64|amd64|armv7" \
#    io.hass.arch="aarch64|amd64" \
#    io.hass.arch="aarch64" \
    io.hass.type="addon" \
    io.hass.version=${version} \
    maintainer="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.title="Metabase" \
    org.opencontainers.image.description="Home Assistant Add-on: Metabase" \
    org.opencontainers.image.vendor="Sanderdw's add-on repository" \
    org.opencontainers.image.authors="Sander de Wildt <sanderdw@gmail.com>" \
    org.opencontainers.image.licenses="GNU Affero General Public License (AGPL)" \
    org.opencontainers.image.url="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.source="https://github.com/sanderdw/hassio-addons" \
    org.opencontainers.image.documentation="https://raw.githubusercontent.com/sanderdw/hassio-addons/master/README.md" \
    org.opencontainers.image.version=${version}