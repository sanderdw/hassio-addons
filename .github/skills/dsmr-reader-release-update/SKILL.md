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

### 3. Audit Environment Variables
Reconcile `dsmr_reader/config.json` against the upstream env-var reference for the **target** release.

- Fetch https://www.yunta.nl/dsmr-reader-docker-docs/general/configuration/ (the canonical xirixiz/dsmr-reader-docker config reference). If the URL is unreachable, fall back to the xirixiz repo's `README` / `docker-compose.yml` for the target tag.
- Build the set of upstream env vars relevant to the add-on's `CONTAINER_RUN_MODE` modes that are supported here (`standalone`, `server_remote_datalogger`, `remote_datalogger`).
- Diff against the keys in `options` and `schema` of `dsmr_reader/config.json`:
  - **Added upstream, missing here** → add to both `options` (with a sensible default that matches upstream) and `schema` (correct type: `str`, `str?`, `int`, `bool`, `password`, `list(...)`).
  - **Removed/renamed upstream, still here** → remove from both `options` and `schema`. If renamed, add the new key and remove the old one; flag this as `**Breaking:**` in the changelog.
  - **Default value changed upstream** → update `options` default unless the current value is intentionally different for the add-on; note the change in the changelog.
  - **Type/allowed-values changed upstream** → update the `schema` entry (e.g. enum list values).
- Skip env vars that are managed by the add-on itself (e.g. webserver/ingress wiring) or that are not user-configurable.
- If any change is made, mention it in the changelog entry under a dedicated bullet (e.g. `- Config: added \`NEW_VAR\`, removed \`OLD_VAR\``).

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
- **Already on latest**: if current image tag already equals the latest pinned tag, stop and confirm with the user before proceeding.

## Completion Criteria
- All three `BASE_IMAGE` entries in `.github/workflows/dsmr-reader.yml` point to the new pinned `Major.Minor.Patch` tag.
- `dsmr_reader/config.json` `version` equals the new add-on version.
- `dsmr_reader/config.json` `options` and `schema` reflect the upstream env-var set for the target release (added, removed, renamed, or retyped keys have been reconciled), and every change is mentioned in the changelog entry.
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
