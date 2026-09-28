---
name: metabase-release-update
description: 'Update the Metabase app release files consistently. Use when bumping Metabase version, refreshing workflow actions, aligning workflow triggers, and updating changelog/config metadata.'
argument-hint: 'Target Metabase version, add-on version, and release scope (for example: 0.61.3 + 1.4.0 + workflow action upgrades)'
user-invocable: true
disable-model-invocation: false
---

# Metabase Release Update

## What This Skill Produces
A consistent Metabase release update across workflow automation, app metadata, and release publishing, including:
- Updated GitHub Actions versions in `.github/workflows/metabase.yml`
- Updated Metabase base image tag in `.github/workflows/metabase.yml` when required
- Updated app version in `metabase/config.json` when required
- New release entry at the top of `metabase/CHANGELOG.md`
- Updated `metabase-shield` badge in `metabase/README.md` to reflect the new Metabase version
- Release branch `metabase-{addon_version}` based on `origin/main`
- Commit, push, and pull request creation when requested

## When to Use
Use this skill when:
- Releasing a new Metabase app version
- Updating CI action versions for Metabase builds
- Synchronizing workflow, config, and changelog changes

## Inputs
Provide:
- Target Metabase upstream version (example: 0.60.3.6)
- Target app version (example: 1.3.0)
- Whether prerelease tags are allowed (default: no)
- Whether to update workflow action versions to latest known stable majors in this repository
- Any trigger/path updates needed in `.github/workflows/metabase.yml`
- Whether to create a release branch and PR after the files are updated

## Procedure
1. Gather current state.
   - Read `.github/workflows/metabase.yml`.
   - Read `metabase/config.json`, `metabase/CHANGELOG.md`, and the `[metabase-shield]:` line in `metabase/README.md`.
   - Compare action versions against other workflow files in `.github/workflows/`.
   - Find the latest usable upstream tag on Docker Hub (https://hub.docker.com/r/metabase/metabase/tags):
     ```bash
     curl -s "https://hub.docker.com/v2/repositories/metabase/metabase/tags?page_size=100&ordering=last_updated" \
       | jq -r '.results[].name' | grep -E '^v0\.[0-9]+(\.[0-9]+){1,2}$' | sort -V | tail -1
     ```
   - Prefer pinned full version tags (for example `v0.60.3.6`) over floating aliases (for example `latest`, `v0.60.x`, `v0.60.3.x`). The filter above already drops aliases.
   - Exclude prerelease tags such as `-beta` unless prerelease is explicitly requested.
   - Verify the target tag is published for `linux/amd64` and `linux/arm64` (ignore `unknown/unknown` attestation entries):
     ```bash
     curl -s "https://hub.docker.com/v2/repositories/metabase/metabase/tags/${TAG}" | jq -r '.images[] | "\(.os)/\(.architecture)"'
     ```
   - If the target add-on version is not provided, derive it from the upstream bump:
     - Upstream `0.X` changes (e.g. `0.60.3.6 → 0.61.3`) → minor add-on bump (`1.3.0 → 1.4.0`)
     - Same upstream `0.X`, newer patch (e.g. `0.53.5.5 → 0.53.9`) → patch add-on bump (`1.1.0 → 1.1.1`)
     - Major add-on bumps only for breaking packaging changes; confirm with the user first.

2. Create the release branch.
   - Branch from the latest `main` **before** editing anything, so the release never picks up unrelated local work:
     ```
     git status --porcelain   # must be empty; if not, stop and ask the user
     git fetch origin
     git checkout -b metabase-{addon_version} origin/main
     ```
   - The branch name must match the `metabase-*.*.*` trigger in `.github/workflows/metabase.yml`, otherwise the workflow does not run on push.

3. Update workflow actions and build metadata.
   - In `.github/workflows/metabase.yml`, upgrade `uses:` versions to latest majors already adopted in the repository unless instructed otherwise.
   - If this release includes an upstream Metabase bump, update both matrix `BASE_IMAGE` tags (`amd64`, `aarch64`), keeping the `v` prefix (e.g. `metabase/metabase:v0.61.3`).
   - Apply branch/path trigger updates only when they are part of the requested release scope.

4. Update app metadata and docs.
   - Set `version` in `metabase/config.json` to the target app version.
   - Keep existing JSON style and schema untouched unless explicitly requested.
   - In `metabase/README.md`, update the `[metabase-shield]:` URL `Metabase%20Version-%20{OLD}-purple` to the new upstream version **without** the `v` prefix (e.g. `0.61.3`). Keep the existing URL-encoded space (`%20`) before the version.

5. Update changelog.
   - Add a new top section in `metabase/CHANGELOG.md` matching the app version (`## {addon_version}`).
   - Include concise bullets for:
     - Metabase upstream version bump (`- Update to Metabase {version}`, no `v` prefix)
     - CI/workflow dependency updates
     - Any functional packaging/runtime changes

6. Validate consistency.
   - Verify these align:
     - `metabase/config.json` version
     - New changelog section heading
     - Workflow build source version (`BASE_IMAGE`) when changed
     - `metabase-shield` badge version and the changelog's upstream version
   - Ensure only intended files changed (`git status --short`).

7. Publish the release when requested.
   - Only publish when the user asked for a release or PR in this request (invoking this skill by name counts). Otherwise stop after step 6 and summarize the diff.
   - Commit the release update as a single atomic commit, e.g. `Metabase {addon_version} (upstream {metabase_version})`.
   - Push the branch (`git push -u origin metabase-{addon_version}`) and open a pull request against `main` titled `Metabase {addon_version}`.

## Decision Points
- If only CI updates are requested: update workflow actions only. Do not bump `metabase/config.json` and do not add a new changelog heading; list the CI changes in the next release's changelog entry instead.
- If release version is bumped: update workflow (if relevant), `metabase/config.json`, `metabase/README.md` badge, and changelog together.
- If repository workflows differ on action majors: prefer the newest version already used by a maintained workflow in this repository.
- If Docker Hub newest tags are floating aliases, pick the newest pinned stable tag for reproducible builds.
- If only prerelease tags exist for a newer line, keep the latest stable pinned tag unless prerelease is requested.
- If the target tag is not published for `linux/amd64` or `linux/arm64`, stop and tell the user; do not bump to it.
- If the current `BASE_IMAGE` already equals the latest pinned tag and no CI updates are requested, stop and confirm with the user before proceeding.
- If release publishing is requested, keep the branch name, commit message, and PR title aligned with the new add-on version.

## Completion Criteria
- `metabase/config.json` version is correct for release updates.
- `metabase/CHANGELOG.md` has a new top entry with accurate bullets.
- `metabase/README.md` `metabase-shield` badge shows the new Metabase version.
- `.github/workflows/metabase.yml` action versions and build inputs match requested scope.
- Selected Metabase image tag is pinned, published for `linux/amd64` and `linux/arm64`, and matches Docker Hub latest stable policy.
- No unrelated files or formatting-only churn.
- If publish mode was requested, the release branch `metabase-{addon_version}` (based on `origin/main`) exists on the remote and a PR against `main` is open.

## Example Prompt
```
Update Metabase to the latest stable Docker Hub tag, derive the add-on version,
update the badge and changelog, and open a PR.
```
