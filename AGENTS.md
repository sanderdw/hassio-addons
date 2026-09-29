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

## VoltViz: where things live

- The app (React, Vite, Tailwind, Sendspin, Music Assistant controls) lives upstream in
  `~/git_personal/voltviz` (github.com/sanderdw/voltviz). Make feature and UI changes there.
- `voltviz/` here only wraps `ghcr.io/sanderdw/voltviz:<version>`. `run.sh` sets up the Sendspin
  proxy (`./sendspin-proxy/`) and writes `ma-config.json` (Music Assistant's ingress entry).
- Version branches: upstream `X.Y.Z` publishes `ghcr.io/sanderdw/voltviz:X.Y.Z` (workflows "CI" and
  "Build and Publish Docker Image"). Here `voltviz-X.Y.Z` publishes
  `ghcr.io/sanderdw/hassio-addons/ha-voltviz-{arch}:X.Y.Z` (workflow "VoltViz").

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
