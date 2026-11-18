# End-to-end tests

A complete Home Assistant installation on your own machine, for testing the add-ons in this
repository the way a user runs them: Home Assistant OS, the Supervisor, Home Assistant Core,
ingress, a database add-on and a smart meter on a USB P1 cable.

You need Docker with KVM (`/dev/kvm`) and Node 22 or newer. Nothing else is installed on your
machine.

## Quick start

```sh
./e2e/haos.mjs up      # first run: about 10 minutes, it downloads Home Assistant OS and Core
./e2e/haos.mjs test    # all tests
./e2e/haos.mjs down    # the VM keeps its disk; the next "up" takes about half a minute
```

`up` prints the address of Home Assistant (http://127.0.0.1:18123) and the login. Open it in a
browser to look at an add-on yourself.

## What runs

| Part | What it is |
| --- | --- |
| `haos` container | Home Assistant OS (the official `ova` image) in QEMU. |
| `p1` container | The smart meter. It sends one DSMR 5 telegram per second ([p1/](p1)). |
| P1 cable | QEMU's emulated FTDI USB serial adapter. Home Assistant OS loads the `ftdi_sio` driver and creates `/dev/ttyUSB0`, as it does for a real P1 cable. |
| Database | The [TimescaleDB add-on](https://github.com/expaso/hassos-addons), installed from its repository by the tests that need it. |
| Music Assistant | The [Music Assistant add-on](https://github.com/music-assistant/home-assistant-addon), installed from its repository by the VoltViz tests. Its image is 3 GB. |

The add-on under test is built inside the VM by the Supervisor, from your working tree. The copy
that goes into the VM differs from the repository in two ways, because the published image must
not be used:

- `image` is removed from `config.json`, so the Supervisor builds the Dockerfile.
- `ARG BUILD_FROM` gets the base image that the add-on's GitHub workflow builds with (the
  `BASE_IMAGE` of its amd64 matrix entry).

The add-on's slug in the VM is `local_<slug>`, for example `local_dsmr_reader`.

## Commands

```
./e2e/haos.mjs up                     Start the VM and wait until Home Assistant is ready
./e2e/haos.mjs down                   Shut the VM down; its disk is kept
./e2e/haos.mjs reset                  Delete the VM's disk; the next "up" starts from scratch
./e2e/haos.mjs status                 Versions, add-ons and the P1 cable
./e2e/haos.mjs test [files...]        Run the tests (default: all of e2e/tests)
./e2e/haos.mjs install <add-on dir>   Build and install an add-on from the working tree
./e2e/haos.mjs ssh [command]          Root shell on the Home Assistant OS host
./e2e/haos.mjs ha <args...>           The Home Assistant CLI
./e2e/haos.mjs logs [slug]            Follow the log of an add-on, or of the VM
./e2e/haos.mjs usb unplug|plug        Pull out or plug in the P1 cable
./e2e/haos.mjs monitor <command>      The QEMU monitor, for example: monitor info usb
```

## Ports on your machine

| Address | Reaches |
| --- | --- |
| http://127.0.0.1:18123 | Home Assistant |
| http://127.0.0.1:14357 | The Supervisor's observer |
| http://127.0.0.1:17777 to 17779 | Host ports 7777 to 7779 of add-ons. Give an add-on host port 7777 in its Network settings and it answers on 17777. |

Everything listens on 127.0.0.1 only.

## The smart meter

[p1/telegram.mjs](p1/telegram.mjs) defines the meter. Every value in a telegram is a function of
its timestamp: power climbs from 200 W to 790 W each minute, and the counters are the sum of that
power. A test takes a reading that an add-on stored, calls `readingAt(timestamp)` and compares
the numbers exactly.

Bytes that nobody reads are lost, as on a real serial line: an add-on that opens the port gets
the telegram the meter sends at that moment, not a backlog ([haos/p1-cable.py](haos/p1-cable.py)).

The meter also serves its telegrams on TCP port 2001, for add-ons that read a network socket
(ser2net) instead of a serial port. Add-ons cannot resolve the name `p1`: give them the address
from `p1Address()` in [lib/vm.mjs](lib/vm.mjs).

## The tests

| File | What it covers |
| --- | --- |
| [tests/dsmr-reader.test.mjs](tests/dsmr-reader.test.mjs) | The P1 cable on the host, the start, readings in TimescaleDB that equal what the meter sent, pulling the cable out and plugging it back in, and the dashboard through ingress. |
| [tests/dsmr-reader-mqtt.test.mjs](tests/dsmr-reader-mqtt.test.mjs) | DSMR Reader's `MQTT_HOME_ASSISTANT` option: nothing changes with it off; without Mosquitto only the data sources are switched on; with Mosquitto the broker is set, Home Assistant discovers DSMR Reader and its sensors show what the meter sent; a broker entered by hand is kept. |
| [tests/dsmr-datalogger.test.mjs](tests/dsmr-datalogger.test.mjs) | Telegrams from the P1 cable and from a network socket, sent to the API of DSMR Reader and stored value for value; pulling the cable out and plugging it back in. |
| [tests/metabase.test.mjs](tests/metabase.test.mjs) | The start with H2 and with PostgreSQL as the application database, the first-time setup, a question answered from a database in TimescaleDB, the H2 file surviving a restart, and the app through ingress: its links, Home Assistant's frame, a login with a session cookie for the ingress path, and its own port left as it was. Fonts and pin-map tiles in a browser are not covered. |
| [tests/voltviz.test.mjs](tests/voltviz.test.mjs) | The page on its own port and through ingress, the Sendspin proxy to Music Assistant, and an empty Sendspin URL. The visualizer itself runs in a browser and is not covered. |
| [tests/p1-telegram.test.mjs](tests/p1-telegram.test.mjs) | The smart meter emulator on its own. Needs no VM. |

Every add-on test also builds and installs the add-on from the working tree, and starts it while
its update server is unreachable.

A test file reinstalls its add-on, empties the add-on's data and stops the add-ons it does not
need. It leaves its own add-on running, so after `./e2e/haos.mjs test e2e/tests/dsmr-reader.test.mjs`
DSMR Reader is on http://127.0.0.1:17777 and in Home Assistant through ingress.

## Writing a test for another add-on

Tests use Node's built-in test runner and need no packages. [tests/voltviz.test.mjs](tests/voltviz.test.mjs)
is the shortest example to copy. The helpers:

| Module | For |
| --- | --- |
| [lib/vm.mjs](lib/vm.mjs) | `ssh()` on the host, `supervisor()` for the Supervisor API, `waitFor()`, `addonUrl()`, `withServerUnreachable()`, the P1 cable |
| [lib/addons.mjs](lib/addons.mjs) | `installLocalAddon()`, `installStoreAddon()`, `configureAddon()`, `secondsToStart()`, `stopOtherAddons()`, `addonExec()`, `addonLogs()` |
| [lib/timescaledb.mjs](lib/timescaledb.mjs) | `ensureTimescaleDb()`, `psql()`, `recreateDatabase()` |
| [lib/dsmr-reader.mjs](lib/dsmr-reader.mjs) | DSMR Reader as a server for a datalogger, and comparing its stored readings with the meter |
| [lib/music-assistant.mjs](lib/music-assistant.mjs) | `ensureMusicAssistant()` |
| [lib/homeassistant.mjs](lib/homeassistant.mjs) | `openIngress()` to fetch an add-on's pages through ingress, `callWS()` for the WebSocket API, `haApi()` for the REST API, `addDiscoveredIntegration()` and `removeIntegration()` |
| [lib/mosquitto.mjs](lib/mosquitto.mjs) | `ensureMosquitto()` with Home Assistant's MQTT integration, `removeMosquitto()` |

Test files run one after another, because they share the VM.

## Settings

Environment variables for `up`:

| Variable | Default | |
| --- | --- | --- |
| `HAOS_VERSION` | `18.4` | The Home Assistant OS version for a new disk. Take it from `hassos.ova` in https://version.home-assistant.io/stable.json: the newest GitHub release can be a Raspberry Pi only release that has no `ova` image. |
| `HAOS_CPUS` | `2` | |
| `HAOS_MEMORY` | `4096` | In MB. |
| `HAOS_DISK_SIZE` | `32G` | |
| `HAOS_HA_PORT` | `80` | The port Home Assistant Core listens on in the VM. New installations use 80 and only redirect from 8123. |
| `E2E_HA_PORT` | `18123` | The port for Home Assistant on your machine. Set it for `test` too. |
| `P1_INTERVAL_MS` | `1000` | Time between telegrams. |

The VM's disk and the downloaded image are in the Docker volumes `haos-e2e_state` and
`haos-e2e_cache`.

## Good to know

- Home Assistant OS updates the Supervisor by itself, so a new disk gets the current Supervisor
  and Core, whatever `HAOS_VERSION` is.
- The Supervisor's names changed with the rename from add-ons to apps: containers are
  `app_<slug>` and the local add-on folder is `/mnt/data/supervisor/apps/local`. The helpers
  handle both the new and the old names.
- `down` shuts Home Assistant OS down with `poweroff` over SSH. The VM ignores the ACPI power
  button.
