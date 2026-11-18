#!/usr/bin/env bash
# Boots Home Assistant OS in QEMU with an emulated FTDI USB serial cable (the P1 cable).
#
#   /cache  downloaded HAOS images (survives a reset)
#   /state  the VM disk, UEFI variables and the SSH key for port 22222
set -euo pipefail

: "${HAOS_VERSION:?set HAOS_VERSION}"
: "${HAOS_CPUS:=2}"
: "${HAOS_MEMORY:=4096}"
: "${HAOS_DISK_SIZE:=32G}"
: "${HAOS_HA_PORT:=80}"
# Ports of this container that reach the VM: "port" or "port:vm-port".
: "${HAOS_FORWARD_PORTS:=8123:${HAOS_HA_PORT} 4357}"
: "${P1_HOST:=p1}"
: "${P1_PORT:=2001}"

readonly CACHE=/cache
readonly STATE=/state
readonly MONITOR=/run/qemu-monitor.sock
readonly P1_CABLE=/run/p1-cable.sock
readonly IMAGE="${CACHE}/haos_ova-${HAOS_VERSION}.qcow2"
readonly DISK="${STATE}/disk.qcow2"
readonly SSH_KEY="${STATE}/ssh/id_ed25519"
readonly CONFIG_IMAGE=/run/config.img

log() { echo "[haos-e2e] $*"; }

download_image() {
  [[ -f "${IMAGE}" ]] && return
  local url="https://github.com/home-assistant/operating-system/releases/download/${HAOS_VERSION}/haos_ova-${HAOS_VERSION}.qcow2.xz"
  log "Downloading ${url}"
  curl -fL --retry 3 --no-progress-meter -o "${IMAGE}.xz.part" "${url}"
  log "Unpacking the image"
  xz -dc "${IMAGE}.xz.part" > "${IMAGE}.part"
  mv "${IMAGE}.part" "${IMAGE}"
  rm -f "${IMAGE}.xz.part"
}

create_disk() {
  if [[ -f "${DISK}" ]]; then
    local installed
    installed="$(cat "${STATE}/haos-version" 2>/dev/null || echo unknown)"
    if [[ "${installed}" != "${HAOS_VERSION}" ]]; then
      log "The existing disk was created from HAOS ${installed}; HAOS_VERSION=${HAOS_VERSION} only applies after a reset"
    fi
    return
  fi
  download_image
  log "Creating a ${HAOS_DISK_SIZE} disk from HAOS ${HAOS_VERSION}"
  cp "${IMAGE}" "${DISK}.part"
  # HAOS grows its data partition to the disk size on first boot. Never shrink the image.
  qemu-img resize "${DISK}.part" "${HAOS_DISK_SIZE}" 2>/dev/null \
    || log "Keeping the image's own disk size"
  mv "${DISK}.part" "${DISK}"
  cp /usr/share/OVMF/OVMF_VARS_4M.fd "${STATE}/OVMF_VARS.fd"
  echo "${HAOS_VERSION}" > "${STATE}/haos-version"
}

# HAOS imports authorized_keys from a drive labelled CONFIG and then starts SSH on port 22222.
create_config_drive() {
  if [[ ! -f "${SSH_KEY}" ]]; then
    mkdir -p "$(dirname "${SSH_KEY}")"
    ssh-keygen -q -t ed25519 -N '' -C haos-e2e -f "${SSH_KEY}"
  fi
  rm -f "${CONFIG_IMAGE}"
  truncate -s 16M "${CONFIG_IMAGE}"
  mkfs.vfat -n CONFIG "${CONFIG_IMAGE}" > /dev/null
  mcopy -i "${CONFIG_IMAGE}" "${SSH_KEY}.pub" ::authorized_keys
}

# Home Assistant OS does not react to the ACPI power button, so ask it over SSH.
shutdown_vm() {
  log "Shutting down Home Assistant OS"
  haos-ssh poweroff > /dev/null 2>&1 || qemu-monitor system_powerdown > /dev/null 2>&1 || true
  for _ in $(seq 1 90); do
    kill -0 "${qemu_pid}" 2>/dev/null || return 0
    sleep 1
  done
  log "The VM did not power off in time, stopping QEMU"
  qemu-monitor quit > /dev/null 2>&1 || kill "${qemu_pid}" 2>/dev/null || true
}

create_disk
create_config_drive

accel=kvm
cpu=host
if [[ ! -w /dev/kvm ]]; then
  log "WARNING: /dev/kvm is not available, falling back to software emulation (very slow)"
  accel=tcg
  cpu=max
fi

netdev="user,id=net0,hostname=haos-e2e,hostfwd=tcp:127.0.0.1:22222-:22222"
for forward in ${HAOS_FORWARD_PORTS}; do
  netdev+=",hostfwd=tcp:0.0.0.0:${forward%%:*}-:${forward##*:}"
done

# The cable between the meter emulator and QEMU; see p1-cable.py for why it is not a plain socket.
P1_HOST="${P1_HOST}" P1_PORT="${P1_PORT}" p1-cable.py "${P1_CABLE}" &
for _ in $(seq 1 50); do
  [[ -S "${P1_CABLE}" ]] && break
  sleep 0.1
done

rm -f "${MONITOR}"
log "Starting HAOS (${HAOS_CPUS} CPUs, ${HAOS_MEMORY} MB, ${accel}); the P1 meter is ${P1_HOST}:${P1_PORT}"

# The usb-serial device is QEMU's FTDI FT232 emulation. HAOS loads ftdi_sio for it and creates
# /dev/ttyUSB0, the same as a real P1 cable. Every byte of the chardev arrives on that port.
# It sits on a USB 1.1 controller: on xHCI the kernel logs a warning each time the port closes.
#
# The PCI addresses are fixed because the firmware stores the boot entry by device path: a
# device that takes the disk's address would leave an existing VM unbootable.
qemu-system-x86_64 \
  -name haos-e2e \
  -machine "q35,accel=${accel}" \
  -cpu "${cpu}" \
  -smp "${HAOS_CPUS}" \
  -m "${HAOS_MEMORY}" \
  -nodefaults \
  -display none \
  -drive "if=pflash,format=raw,unit=0,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd" \
  -drive "if=pflash,format=raw,unit=1,file=${STATE}/OVMF_VARS.fd" \
  -drive "if=none,id=disk,format=qcow2,file=${DISK},discard=unmap" \
  -netdev "${netdev}" \
  -device virtio-net-pci,netdev=net0,addr=0x1 \
  -device virtio-rng-pci,addr=0x2 \
  -device qemu-xhci,id=xhci,addr=0x3 \
  -device virtio-blk-pci,drive=disk,bootindex=0,addr=0x4 \
  -device ich9-usb-uhci1,id=uhci,addr=0x5 \
  -chardev "socket,id=p1,path=${P1_CABLE},reconnect-ms=2000" \
  -device usb-serial,chardev=p1,id=p1cable,bus=uhci.0 \
  -drive "if=none,id=config,format=raw,readonly=on,file=${CONFIG_IMAGE}" \
  -device usb-storage,drive=config,bus=xhci.0 \
  -chardev "file,id=console,path=/dev/stdout" \
  -serial chardev:console \
  -monitor "unix:${MONITOR},server=on,wait=off" &
qemu_pid=$!

trap shutdown_vm TERM INT
# `wait` returns early when a signal arrives; wait again for QEMU to really exit.
wait "${qemu_pid}" || true
wait "${qemu_pid}" 2>/dev/null || true
log "QEMU exited"
