# https://developers.home-assistant.io/docs/add-ons/configuration#add-on-dockerfile
ARG BUILD_FROM
FROM $BUILD_FROM

# Execute during the build of the image
ARG TEMPIO_VERSION BUILD_ARCH
ENV LANG C.UTF-8

RUN apt-get update \
    && apt-get install -y openjdk-11-jdk openjdk-11-jre
ADD https://downloads.metabase.com/v0.40.0/metabase.jar /home

ENV MB_DB_TYPE=postgres
COPY run.sh /
RUN chmod a+x /run.sh

EXPOSE 3000
CMD [ "/run.sh" ]