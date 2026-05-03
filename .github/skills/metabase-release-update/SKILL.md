---
name: metabase-release-update
description: 'Update the Metabase app release files consistently. Use when bumping Metabase version, refreshing workflow actions, aligning workflow triggers, and updating changelog/config metadata.'
argument-hint: 'Target Metabase version and summary of changes (for example: 0.60.3.6 + workflow action upgrades)'
user-invocable: true
disable-model-invocation: false
---

# Metabase Release Update

## What This Skill Produces
A consistent Metabase release update across workflow automation and app metadata, including:
- Updated GitHub Actions versions in `.github/workflows/metabase.yml`
- Updated Metabase base image tag in `.github/workflows/metabase.yml` when required
- Updated app version in `metabase/config.json` when required
- New release entry at the top of `metabase/CHANGELOG.md`
- Updated metabase-shield in `README.md` to reflect the new Metabase version

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

## Procedure
1. Gather current state.
   - Read `.github/workflows/metabase.yml`.
   - Read `metabase/config.json` and `metabase/CHANGELOG.md`.
   - Compare action versions against other workflow files in `.github/workflows/`.
   - Check https://hub.docker.com/r/metabase/metabase/tags and identify the latest usable upstream tag.
   - Prefer pinned full version tags (for example `v0.60.3.6`) over floating aliases (for example `latest`, `v0.60.x`, `v0.60.3.x`).
   - Exclude prerelease tags such as `-beta` unless prerelease is explicitly requested.

2. Update workflow actions and build metadata.
   - In `.github/workflows/metabase.yml`, upgrade `uses:` versions to latest majors already adopted in the repository unless instructed otherwise.
   - If this release includes an upstream Metabase bump, update matrix `BASE_IMAGE` tags.
   - Apply branch/path trigger updates only when they are part of the requested release scope.

3. Update app metadata.
   - Set `version` in `metabase/config.json` to the target app version.
   - Keep existing JSON style and schema untouched unless explicitly requested.

4. Update changelog.
   - Add a new top section in `metabase/CHANGELOG.md` matching the app version.
   - Include concise bullets for:
     - Metabase upstream version bump
     - CI/workflow dependency updates
     - Any functional packaging/runtime changes

5. Validate consistency.
   - Verify these align:
     - `metabase/config.json` version
     - New changelog section heading
     - Workflow build source version (`BASE_IMAGE`) when changed
   - Ensure only intended files changed.

## Decision Points
- If only CI updates are requested: update workflow actions and changelog only; do not bump `metabase/config.json`.
- If release version is bumped: update workflow (if relevant), `metabase/config.json`, and changelog together.
- If repository workflows differ on action majors: prefer the newest version already used by a maintained workflow in this repository.
- If Docker Hub newest tags are floating aliases, pick the newest pinned stable tag for reproducible builds.
- If only prerelease tags exist for a newer line, keep the latest stable pinned tag unless prerelease is requested.

## Completion Criteria
- `metabase/config.json` version is correct for release updates.
- `metabase/CHANGELOG.md` has a new top entry with accurate bullets.
- `.github/workflows/metabase.yml` action versions and build inputs match requested scope.
- Selected Metabase image tag is pinned and matches Docker Hub latest stable policy.
- No unrelated files or formatting-only churn.
