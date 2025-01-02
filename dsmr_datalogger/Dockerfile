ARG BUILD_FROM
FROM $BUILD_FROM
ARG BUILD_ARCH
ARG HA_RELEASE

ENV LANG=C.UTF-8
# Copy data for add-on
COPY config.json /app/ha_addon_version.json
COPY run.sh /
COPY dsmr_datalogger_api_client.py ./
COPY requirements.txt /

RUN mkdir -p /etc/dsmr_logs
RUN pip install --no-cache-dir -r requirements.txt

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

# Labels
LABEL \
  io.hass.version=$HA_RELEASE \
  io.hass.type="addon" \
  io.hass.arch=$BUILD_ARCH
