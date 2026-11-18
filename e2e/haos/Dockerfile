FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        dosfstools \
        mtools \
        openssh-client \
        ovmf \
        python3 \
        qemu-system-x86 \
        qemu-utils \
        socat \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh haos-ssh p1-cable.py qemu-monitor /usr/local/bin/
RUN chmod a+x /usr/local/bin/entrypoint.sh /usr/local/bin/haos-ssh /usr/local/bin/p1-cable.py /usr/local/bin/qemu-monitor

VOLUME ["/cache", "/state"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
