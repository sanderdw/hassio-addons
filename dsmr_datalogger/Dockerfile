ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8
# Copy data for add-on
COPY run.sh /
COPY dsmr_datalogger_api_client.py ./
COPY requirements.txt /

RUN mkdir -p /etc/dsmr_logs
RUN pip install --no-cache-dir -r requirements.txt

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]