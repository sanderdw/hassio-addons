# Agent guide

Home Assistant add-ons (apps). Most add-ons wrap an upstream Docker image; release updates have
skills in `.claude/skills/` (for example `voltviz-release-update`).

## Ground rules

- Never commit, push or open a PR unless the user asks for it in that turn. In the VoltViz loop
  below, ask once per round ("push and redeploy?") and then run the whole deploy.
- Create branches with `git switch --no-track -c <branch> origin/main`. A branch created from
  `origin/main` with tracking pushes to `main` on a plain `git push`.
- Instance details (Home Assistant URL, add-on slugs) are in `CLAUDE.local.md`, which is not in
  git. Never write a Home Assistant token to a file.

## End-to-end tests (local Home Assistant OS)

`e2e/` runs Home Assistant OS in a VM (Docker with KVM) with an emulated smart meter on a USB P1
cable (`/dev/ttyUSB0`) and builds add-ons from the working tree. Read `e2e/README.md` first.

The VM is separate from the user's real instance in `CLAUDE.local.md`; use it freely. It needs
Docker with `/dev/kvm` and Node 22 or newer, and nothing else.

### Test an add-on

1. `./e2e/haos.mjs up` starts the VM (about half a minute; about 10 minutes on a new disk).
   `./e2e/haos.mjs status` shows whether it runs and which add-ons are installed.
2. Run the add-on's test file: `./e2e/haos.mjs test e2e/tests/dsmr-reader.test.mjs`. Without a
   file, `test` runs everything in `e2e/tests`.
3. For an add-on without a test file, or to look at it yourself: `./e2e/haos.mjs install <add-on dir>`
   builds it from the working tree and installs it as `local_<slug>`. Then configure and start it
   through the Supervisor API (helpers below) or in Home Assistant at http://127.0.0.1:18123
   (user `e2e`, password `e2e-password`).
4. Leave the VM running between runs. `./e2e/haos.mjs down` stops it and keeps its disk; `reset`
   deletes the disk.

Every add-on has a test file in `e2e/tests/`. A file reinstalls its add-on, stops the add-ons it
does not need and leaves its own running.

| Add-on | Test file | What it needs in the VM |
| --- | --- | --- |
| `dsmr_reader` | `dsmr-reader.test.mjs` | TimescaleDB. |
| `dsmr_datalogger` | `dsmr-datalogger.test.mjs` | DSMR Reader as its API server (`startDsmrReaderAsServer()` in `e2e/lib/dsmr-reader.mjs`). |
| `metabase` | `metabase.test.mjs` | TimescaleDB. Its default host port 7778 answers on http://127.0.0.1:17778. It uses 1.3 GB of the VM's 4 GB. |
| `voltviz` | `voltviz.test.mjs` | Music Assistant (`ensureMusicAssistant()`). The tests give it host port 7777, because its default 8099 is not forwarded. The visualizer in the browser is not covered. |

### Write a test file

Add `e2e/tests/<add-on>.test.mjs`. Tests use Node's test runner (`node:test`, `node:assert/strict`)
and no packages. The order that works:

1. In `before`: `requireVm()`, `waitForSupervisor()`, `stopOtherAddons([<slugs to keep>])`,
   install what the add-on depends on (`ensureTimescaleDb(['<database>'])`,
   `installStoreAddon(slug, repositoryUrl)`), then `uninstallAddon('local_<slug>')` and empty its
   data, so every run starts the same.
2. `installLocalAddon('<add-on dir>')`, then `configureAddon(slug, { boot: 'manual', options: {…},
   network: { '<port>/tcp': 7777 } })`. Options replace the stored ones.
3. Start it with `secondsToStart(slug, ready)`: it restarts the add-on, waits until `ready()` is
   true and returns the seconds that took. It fails at once when the add-on stops with an error.
4. Assert on what a user would see: the add-on's HTTP API on `addonUrl(7777)`, its pages through
   ingress with `openIngress(info.ingress_url)`, rows in the database with `psql()`, files with
   `addonExec()`. On a failure, add `addonLogs(slug)` to the error message.

5. Start it once more inside `withServerUnreachable(UPDATE_SERVER, …)`: every add-on here asks
   `api-check.duckdns.org` for a newer version at its start, and must start without an answer.
6. Assert `stateAfterStop(slug)` is `stopped`. Home Assistant shows "Error" after a stop when the
   container exits with another code than 0 (Java: 143) or is killed after the stop timeout (137).

The helpers are in `e2e/lib/`: `vm.mjs` (`ssh`, `supervisor`, `waitFor`, `addonUrl`, the P1 cable),
`addons.mjs`, `homeassistant.mjs` (`openIngress`, `callWS`), `timescaledb.mjs`, `dsmr-reader.mjs`
and `music-assistant.mjs`.

### The smart meter and faults

- The meter sends one DSMR 5 telegram per second on `/dev/ttyUSB0`. Each value is a function of
  the timestamp: `readingAt(unixSeconds)` in `e2e/p1/telegram.mjs` gives what the meter sent, so a
  test compares stored values exactly.
- Pull the cable out and plug it back in with `unplugP1Cable()` and `plugP1Cable()`, or
  `./e2e/haos.mjs usb unplug|plug`.
- The meter also sends its telegrams on TCP port 2001. Add-ons cannot resolve its name `p1`: use
  the address from `p1Address()`.
- Make a server on the internet unreachable for add-ons with `withServerUnreachable(hostname,
  action)`. By hand: `./e2e/haos.mjs ssh 'iptables -I FORWARD 1 -d <ip> -j DROP'`, and remove the
  rule with `-D FORWARD` afterwards.

### Pitfalls

- An add-on with a Docker health check stays in state `startup` until that check passes, which
  can be minutes after it answers. Wait for the add-on's own answer first, then for `started`.
- The Supervisor waits 120 seconds for a start. A slower start still succeeds but logs a timeout,
  so measure the start time in the test.
- Set `boot: 'manual'` on add-ons under test. An add-on with `boot: 'auto'` starts with the VM and
  can hold up `./e2e/haos.mjs up`.
- Only host ports 7777 to 7779 of add-ons are forwarded, to 17777 to 17779 on this machine.
  DSMR Reader and VoltViz both get 7777 from their tests: stop one before starting the other by
  hand, or the start fails with "port 7777 is already in use".
- To see what the user sees, open http://127.0.0.1:18123/config/app/local_<slug>/info in the
  chrome-devtools browser (user `e2e`, password `e2e-password`).
- For a start that takes longer than a minute, block the add-on's database for 70 seconds with
  `withServerUnreachable(<ip_address of the database add-on>, …)`. `docker pause` does not work
  for this: Docker marks a paused container unhealthy.
- Containers are named `app_<slug>` on the current Supervisor (`addon_<slug>` on older ones). Use
  `containerName(slug)`, `addonExec()` and `addonLogs()` instead of a fixed name.
- The staged copy differs from the repository in two ways: `image` is removed from `config.json`,
  and `ARG BUILD_FROM` gets the `BASE_IMAGE` of the amd64 entry in the add-on's GitHub workflow.
  An add-on whose workflow has no such entry needs `installLocalAddon(dir, { baseImage })`.
- Test files run one after another, because they share the VM. Two add-ons that read the P1
  cable at the same time each get parts of a telegram, so stop the other one first.
- An option that has a default cannot be removed: leaving it out of `options` brings the default
  back. Set it to an empty string instead (VoltViz's `SENDSPIN_URL`).
- `newestReadingAge()` and other database checks need the add-on's tables: wait for the add-on to
  be ready before the first query.

## VoltViz: where things live

- The app (React, Vite, Tailwind, Sendspin, Music Assistant controls) lives upstream in
  `~/git_personal/voltviz` (github.com/sanderdw/voltviz). Make feature and UI changes there.
- `voltviz/` here only wraps `ghcr.io/sanderdw/voltviz:<version>`. `run.sh` sets up the Sendspin
  proxy (`./sendspin-proxy/`) and writes `ma-config.json` (Music Assistant's ingress entry).
- Version branches: upstream `X.Y.Z` publishes `ghcr.io/sanderdw/voltviz:X.Y.Z` (workflows "CI" and
  "Build and Publish Docker Image"). Here `voltviz-X.Y.Z` publishes the Cosign-signed
  `ghcr.io/sanderdw/hassio-addons/ha-voltviz:X.Y.Z` (multi-arch; per-arch `{arch}-ha-voltviz`) with
  Home Assistant's builder actions (workflow "VoltViz"). The base image is
  `ghcr.io/sanderdw/voltviz:<config.json version>`. On `main` the workflow skips versions that already
  exist, so only version branches (re)publish.

## VoltViz fix-and-verify loop

1. **Reproduce**, live when possible (see Live checks). Otherwise read the source at the pinned
   versions: Music Assistant server, `aiosendspin`, `node_modules/@sendspin/sendspin-js`.
2. **Fix upstream.**
   - Every skin key must exist in all four skins in `src/skins.ts` (modern, win95, winamp, crt).
   - For on and off states, use complete alternative class strings, not a base class plus an
     override for the same property. Tailwind's CSS order decides, not the class order.
   - Keep logic in SDK-free modules with vitest tests (`tests/unit/`).
   - Test the UI with Playwright through the dev-only hook `window.__voltvizSendspin`
     (`src/app/sendspinDev.ts`), which fakes Sendspin and Music Assistant.
3. **Verify upstream.** Run `npm run lint`, `npm run test:unit`, `npx playwright test` and
   `npm run build`. Then run `grep -r __voltvizSendspin dist/`: it must find nothing. Check
   visually with the chrome-devtools browser against `npx vite --port 3200`, in all four skins
   (`?skin=`) and at phone width.
4. **Changelogs.** Add the change to the upstream `CHANGELOG.md` entry for the version in
   progress. Add it in user-facing words to `voltviz/CHANGELOG.md` here.
5. **Ask**, then commit and push the upstream version branch. Wait for both upstream workflows:
   `gh run list --branch X.Y.Z`, then `gh run watch <id> --exit-status`.
6. **Rebuild the add-on image.** Run `gh run rerun <id>` on the latest "VoltViz" run of
   `voltviz-X.Y.Z` here and watch it. An upstream push alone does not rebuild it, and the local
   add-on pulls that image (`build: false`).
7. **Reinstall the local add-on** through the Supervisor API (snippet below). Restore boot, sidebar
   and options; the ingress URL changes. Then check that the served `assets/index-*.js` changed.
8. **Live check** the fix on the real instance, then clean up: stop playback, close test pages.
9. **Report** what changed, what was verified live, and what was not. Tell the user to reload
   VoltViz, since the reinstall restarted it.

## Live checks (chrome-devtools MCP browser)

The user logs in to Home Assistant once in that browser. From a Home Assistant page:

```js
const hass = document.querySelector('home-assistant').hass;
const call = (endpoint, method = 'post', data) =>
  hass.callWS({ type: 'supervisor/api', endpoint, method, ...(data ? { data } : {}), timeout: null });
// Reinstall, then restore what the uninstall removed
await call('/addons/<slug>/uninstall');
await call('/store/addons/<slug>/install');
await call('/addons/<slug>/options', 'post', { boot: 'manual', ingress_panel: true, options: { SENDSPIN_URL: '…' } });
await call('/addons/<slug>/start');
const { ingress_url } = await call('/addons/<slug>/info', 'get');
```

- **Open VoltViz** at `<ingress_url>?sendspin=./sendspin-proxy/` and click Connect. This browser's
  VoltViz identity is a test player in Music Assistant. Reuse it (keep its localStorage) instead
  of creating new players.
- **Silent playback:** pass `initScript` to `navigate_page` so every media element plays muted:
  `const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { this.muted = true; return p.call(this); };`
- **Phones:** use `emulate` with a phone viewport and an Android user agent. The Sendspin SDK
  plays differently on Android and iOS user agents, and Chrome's device toolbar sends one.
- **Music Assistant's API:** open a WebSocket to `<ingress_entry>ws` (from `<ingress_url>ma-config.json`).
  The command reference is at `http://<music-assistant-host>:8095/api-docs/commands.json`.

## Known pitfalls

- Over `http://`, browsers have no `navigator.mediaDevices` (no microphone or screen capture) and
  no WebCodecs. Sendspin still works: it falls back to FLAC or PCM.
- On Android the Sendspin SDK plays straight to the AudioContext, not through VoltViz's audio
  element. VoltViz taps the SDK's output gain node instead (`src/audio/sources/sendspinOutput.ts`).
- Music Assistant links images on its own port (`http://<host>:8095/imageproxy/…`). Load them
  through ingress (`<ingress_entry>imageproxy/…`), or they fail on https pages and away from home.
- Music Assistant 2.10 sends shuffle and repeat over Sendspin only with the next track. Inside the
  add-on, its queue (`queue_updated` events) is the source.
