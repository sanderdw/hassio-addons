---
name: dsmr-reader-release-update
description: Update the DSMR Reader add-on to a new upstream release, including base image bump, add-on version bump, README badge, changelog, branch, and PR. Use when releasing new DSMR Reader versions.
argument-hint: 'Optional: specific target xirixiz/dsmr-reader-docker version. If omitted, fetches the latest pinned Major.Minor.Patch tag from upstream.'
user-invocable: true
disable-model-invocation: false
---

# DSMR Reader Release Update

## What This Skill Produces
A complete DSMR Reader add-on release across config, docs and CI, including:
- Updated base image tag in `.github/workflows/dsmr-reader.yml` for all three arch matrix entries
- Updated app version in `dsmr_reader/config.json`
- New release entry at the top of `dsmr_reader/CHANGELOG.md`
- Updated `dsmr-shield` badge in `dsmr_reader/README.md` to reflect the upstream DSMR Reader Major.Minor version
- New git branch `reader-{addon_version}`
- One atomic commit and a PR to `main`

## When to Use
Use this skill when:
- xirixiz publishes a new `ghcr.io/xirixiz/dsmr-reader-docker` tag
- A new upstream DSMR Reader version is released at https://github.com/dsmrreader/dsmr-reader/releases
- You want to bring the add-on, badge, and CI in sync with upstream in one atomic change

## Inputs
Provide:
- Optional: target xirixiz docker image version in `Major.Minor.Patch` form (example: `6.1.0`). If omitted, discover the latest from upstream.
- Optional: explicit add-on version. If omitted, derive it by mirroring the upstream bump tier (see Decision Points).

## Procedure

### 1. Discover Current and Target Versions
- Read `.github/workflows/dsmr-reader.yml` to find the current `BASE_IMAGE: ghcr.io/xirixiz/dsmr-reader-docker:X.Y.Z` (all three matrix entries should share the same tag).
- Read `dsmr_reader/config.json` to find current add-on `version`.
- Read the `dsmr-shield` line in `dsmr_reader/README.md` to find the current badge version.
- Visit https://github.com/xirixiz/dsmr-reader-docker/pkgs/container/dsmr-reader-docker and pick the latest **pinned `Major.Minor.Patch`** tag. Ignore floating aliases (`latest`, `Major`, `Major.Minor`) and any prerelease tags (e.g. `-beta`, `development`) unless explicitly requested.
- Visit https://github.com/dsmrreader/dsmr-reader/releases and identify the latest upstream `vMajor.Minor.Patch` release. The xirixiz image normally matches it.

### 2. Derive the Add-on Version Bump
- Compare current xirixiz tag → target xirixiz tag and classify the bump tier:
  - Major change (e.g. `5.x.x → 6.x.x`) → major add-on bump
  - Minor change (e.g. `6.0.2 → 6.1.0`) → minor add-on bump
  - Patch change (e.g. `6.1.0 → 6.1.1`) → patch add-on bump
- Apply the same tier to the current add-on version. Example: addon `2.0.0` + upstream minor bump → `2.1.0`.

### 3. Audit Configuration (three-way reconciliation)
Reconcile **upstream docs ↔ `dsmr_reader/config.json` ↔ `dsmr_reader/rootfs/etc/s6-overlay/s6-rc.d/set-hassio-vars/run`** for the **target** release. All three must agree on variable names, applicable run modes, and allowed values.

**3a. Build the upstream reference set**
- Fetch https://www.yunta.nl/dsmr-reader-docker-docs/general/configuration/ (the canonical xirixiz/dsmr-reader-docker config reference). If unreachable, fall back to the xirixiz repo's `README` / `docker-compose.yml` for the target tag.
- Record, for every upstream var: name, default, allowed values (if enum), and which `CONTAINER_RUN_MODE` modes it applies to.
- Also note rename/removal items from the release changelogs (https://github.com/xirixiz/dsmr-reader-docker/releases and https://github.com/dsmrreader/dsmr-reader/releases) since the docs page only shows the current state.

**3b. Diff against `dsmr_reader/config.json`**
For each key in `options`/`schema`:
- **Spelling**: name must match upstream exactly (case-sensitive). A near-match like `_SERIAL_PORT` vs upstream `_SERIAL_DEVICE` is a bug — rename in both files.
- **Type / enum**: `schema` enum values (e.g. `list(ERROR|WARNING|DEBUG)`) must contain **every** value upstream accepts. Missing values (e.g. `INFO` absent from a loglevel list) is a bug.
- **Default**: should match upstream unless intentionally diverged for the Home Assistant context — if diverged, note why in the changelog.
- **Added upstream, missing here** → add to both `options` (sensible default) and `schema` (correct type: `str`, `str?`, `int`, `bool`, `password`, `list(...)`).
- **Removed/renamed upstream, still here** → remove (or rename) in both `options` and `schema`. Flag as `**Breaking:**` in the changelog.

For each upstream var **not** in `config.json`: decide whether to expose it. Skip add-on-managed vars (webserver/ingress wiring, things hard-set by the Dockerfile or run script). Optional `CONTAINER_ENABLE_*` toggles can stay unexposed unless the user requests them — note their absence in the audit report regardless.

**3c. Diff against the s6 init script**
Open `dsmr_reader/rootfs/etc/s6-overlay/s6-rc.d/set-hassio-vars/run` and enumerate every `_set_env '...'` and `_set_env_optional '...'` call inside `_set_env_vars`.
- **In `config.json` but missing from the script** → the option is collected from the user but never reaches the container. Add a `_set_env` call (or `_set_env_optional` if the schema type is `str?`).
- **In the script but missing from `config.json`** → the script will fail or export an empty string. Either add the option or remove the call.
- **Spelling mismatch between script and config.json** → fix both to match upstream.
- **Mode-gated vars**: `DSMRREADER_REMOTE_DATALOGGER_API_HOSTS` / `_API_KEYS` must remain inside the `if [[ "$(bashio::config 'CONTAINER_RUN_MODE')" == 'remote_datalogger' ]]` guard. If upstream adds another mode-gated var, add a similar guard.

**3d. Report findings before editing**
Produce a short audit report with sections:
- ❌ Bugs (must fix): name mismatches, missing enum values, script/config drift.
- ⚠️ Behaviour changes (default/type changed upstream).
- ℹ️ Unsurfaced upstream vars (informational, opt-in).

Apply the fixes, then mention each ❌/⚠️ change in the changelog entry under a dedicated bullet (e.g. `- Config: rename \`DSMRREADER_REMOTE_DATALOGGER_SERIAL_PORT\` → \`_SERIAL_DEVICE\` to match upstream`).

### 4. Update Files
- `.github/workflows/dsmr-reader.yml`: replace `BASE_IMAGE: ghcr.io/xirixiz/dsmr-reader-docker:{OLD}` with the new tag for **all three** matrix entries (`amd64`, `armv7`, `aarch64`). Use a multi-replace to do them in one pass.
- `dsmr_reader/config.json`: set `"version"` to the new add-on version. Touch nothing else.
- `dsmr_reader/README.md`: in the `[dsmr-shield]:` URL, replace `DSMR%20Reader%20Version-%20{OLD_MAJOR.MINOR}-purple` with the upstream DSMR Reader **Major.Minor** (e.g. `6.1`, not `6.1.0`). Keep the existing URL-encoded space (`%20`) before the version.
- `dsmr_reader/CHANGELOG.md`: prepend a new section at the top:
  ```
  ## {NEW_ADDON_VERSION}

  - As always, backup database first!
  - Update to [DSMR Reader v{MAJOR.MINOR}](https://dsmr-reader.readthedocs.io/en/v{MAJOR}/reference/changelog/)
    - Image `xirixiz/dsmr-reader-docker:{NEW_IMAGE_VERSION}`
  ```
  Add additional bullets for breaking changes / new config options when the upstream changelog warrants it.

### 5. Branch, Commit, Push
- Create branch from latest `main`:
  ```
  git fetch origin
  git checkout -b reader-{NEW_ADDON_VERSION} origin/main
  ```
  The name matches the `reader-*.*.*` trigger in `.github/workflows/dsmr-reader.yml` so the workflow runs on push.
- Stage and commit:
  ```
  git add .github/workflows/dsmr-reader.yml dsmr_reader/config.json dsmr_reader/README.md dsmr_reader/CHANGELOG.md
  git commit -m "DSMR Reader {NEW_ADDON_VERSION} (upstream {NEW_IMAGE_VERSION})"
  ```
- Push: `git push -u origin reader-{NEW_ADDON_VERSION}`

### 6. Open Pull Request
- Use `gh pr create --base main --head reader-{NEW_ADDON_VERSION}` with title `DSMR Reader {NEW_ADDON_VERSION}` and a body that includes:
  - Base image bump: `OLD → NEW`
  - Add-on version bump: `OLD → NEW`
  - README badge bump: `OLD_MAJOR.MINOR → NEW_MAJOR.MINOR`
  - Links: upstream release tag, xirixiz package page, upstream changelog

## Decision Points
- **Bump tier mismatch**: if the user passes an explicit add-on version that doesn't match the derived tier, use the user's version but call it out.
- **Badge style**: keep the badge as `Major.Minor` to match prior style unless the user requests `Major.Minor.Patch`.
- **Image vs. upstream divergence**: if xirixiz's latest pinned tag does not match the latest upstream DSMR Reader release, prefer the xirixiz tag for the image, and base the README badge on the xirixiz tag's actual upstream (usually the same `Major.Minor`).
- **Breaking changes upstream**: when upstream notes config changes (renamed env vars, schema changes, etc.), reflect them in `dsmr_reader/config.json` `options`/`schema` and call them out in the changelog as `**Breaking:**`.
- **Env-var audit unreachable**: if https://www.yunta.nl/dsmr-reader-docker-docs/general/configuration/ cannot be fetched, fall back to the xirixiz repo at the target tag; if neither is available, stop and ask the user to confirm whether to skip the audit.
- **Env-var rename ambiguity**: if it's unclear whether an upstream env var is renamed vs. removed-and-added, stop and ask the user before changing `config.json`.
- **Config ↔ run-script disagreement**: if `config.json` and the s6 run script disagree on a variable name and upstream docs are unambiguous, fix both to match upstream and call it out as `**Breaking:**` in the changelog (users who set the broken key will lose their value on upgrade).
- **Already on latest**: if current image tag already equals the latest pinned tag, stop and confirm with the user before proceeding.

## Completion Criteria
- All three `BASE_IMAGE` entries in `.github/workflows/dsmr-reader.yml` point to the new pinned `Major.Minor.Patch` tag.
- `dsmr_reader/config.json` `version` equals the new add-on version.
- `dsmr_reader/config.json` `options` and `schema` reflect the upstream env-var set for the target release (added, removed, renamed, or retyped keys have been reconciled), and every change is mentioned in the changelog entry.
- Every user-facing key in `dsmr_reader/config.json` `options`/`schema` matches an upstream env var name exactly (case-sensitive).
- Every key in `options`/`schema` has a matching `_set_env` or `_set_env_optional` call in `dsmr_reader/rootfs/etc/s6-overlay/s6-rc.d/set-hassio-vars/run`, except for add-on-managed keys (`WEBSERVER`, `DJANGO_FORCE_SCRIPT_NAME`, `DJANGO_STATIC_URL` when handled by the Ingress branch).
- Every `_set_env*` call in the run script either matches a key in `config.json` `options` or is documented as a derived/add-on-managed value.
- Every `list(...)` schema enum contains all values accepted by upstream for that variable.
- `dsmr_reader/README.md` `dsmr-shield` badge shows the upstream `Major.Minor`.
- `dsmr_reader/CHANGELOG.md` has a new top entry naming the new add-on version, the new image tag, the upstream changelog link, and any env-var changes.
- A single atomic commit covers all changed files.
- Branch `reader-{NEW_ADDON_VERSION}` exists on `origin` and a PR is open against `main`.
- `git grep "{OLD_IMAGE_VERSION}" dsmr_reader/ .github/workflows/dsmr-reader.yml` returns only historical CHANGELOG hits.

## Example Prompt
```
Prepare a dsmr-reader app update. Check the latest xirixiz/dsmr-reader-docker Major.Minor.Patch tag,
derive the add-on version bump, update the README badge from the upstream dsmrreader/dsmr-reader release,
create a branch reader-{addon_version}, commit, push, and open a PR.
```
