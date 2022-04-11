ARG version=1.14.5

FROM --platform=${BUILDPLATFORM} debian:stable as stage1
ARG version
ARG TARGETPLATFORM
WORKDIR /the/workdir
RUN \ 
  case ${TARGETPLATFORM} in \
    "linux/amd64")  DOWNLOAD_ARCH="x86_64-linux-gnu"  ;; \
    "linux/arm/v7") DOWNLOAD_ARCH="arm-linux-gnueabihf"  ;; \
  esac && \
  apt update && \
  apt install -y wget && \
  wget https://github.com/dogecoin/dogecoin/releases/download/v${version}/dogecoin-${version}-${DOWNLOAD_ARCH}.tar.gz && \
  tar -vxf dogecoin-${version}-${DOWNLOAD_ARCH}.tar.gz && \
  chmod +x /the/workdir/dogecoin-${version}/bin/dogecoind

FROM debian:stable
ARG version
COPY --from=stage1 /the/workdir/dogecoin-${version}/bin/dogecoind /app/dogecoind
VOLUME /data
EXPOSE 22555
ENTRYPOINT [ "/app/dogecoind", "-printtoconsole", "-datadir=/data", "-server", "-rpcport=22555" ]