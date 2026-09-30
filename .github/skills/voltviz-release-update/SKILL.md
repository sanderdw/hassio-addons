---
name: voltviz-release-update
description: Update the VoltViz add-on to the latest upstream release, including version bump, changelog, and PR creation. Use when releasing new VoltViz versions.
argument-hint: 'Optional: specific target version. If omitted, uses the latest pinned tag on ghcr.io/sanderdw/voltviz.'
user-invocable: true
disable-model-invocation: false
---

# VoltViz Release Update

## What This Skill Produces
A complete VoltViz add-on release, including:
- Updated app version in `voltviz/config.json`
- New release entry in `voltviz/CHANGELOG.md` with upstream changes
- New git branch `voltviz-{version}` based on `origin/main`
- When publishing (see step 6): committed changes and a pull request to `main` with changelog summary

## When to Use
Use this skill when:
- A new upstream VoltViz image is published to `ghcr.io/sanderdw/voltviz`
- You want to bring the add-on in sync with upstream
- You need consistent version tracking across config, changelog, and CI/CD

## Inputs
Provide:
- Optional: Target upstream version (example: `0.18.0`). If omitted, uses the latest pinned tag on `ghcr.io/sanderdw/voltviz`.

## Procedure

### 1. Discover Current and Target Versions
   - Read `voltviz/config.json` to find current add-on version (it mirrors the upstream version).
   - The target version is the latest pinned `Major.Minor.Patch` tag on GHCR (or the user-provided version). GHCR is the source of truth because the workflow builds `FROM` that image; the upstream CHANGELOG can list a version before its image is published.
     ```bash
     IMAGE=sanderdw/voltviz
     TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:${IMAGE}:pull" | jq -r .token)
     curl -s -H "Authorization: Bearer ${TOKEN}" "https://ghcr.io/v2/${IMAGE}/tags/list?n=1000" \
       | jq -r '.tags[]' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1
     ```
   - Verify the target tag is published for `linux/amd64` and `linux/arm64` (ignore `unknown/unknown` attestation entries):
     ```bash
     curl -s -H "Authorization: Bearer ${TOKEN}" \
       -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' \
       "https://ghcr.io/v2/${IMAGE}/manifests/${TAG}" | jq -r '.manifests[].platform | "\(.os)/\(.architecture)"'
     ```
   - Compare to confirm a version bump is needed.

### 2. Fetch Upstream Changelog
   - Read the upstream CHANGELOG.md at https://github.com/sanderdw/voltviz/blob/main/CHANGELOG.md
   - Extract the entries for **every** upstream version after the current add-on version up to and including the target. GHCR may hold versions the add-on skipped (e.g. `0.21.2` and `0.21.3` were folded into add-on `0.22.0`); their changes belong in this release's entry.
   - Note: The upstream repo does not use GitHub Releases, so CHANGELOG.md is the source of truth for release notes.

### 3. Create the Release Branch
   - Branch from the latest `main` **before** editing anything, so the release never picks up unrelated local work:
     ```
     git status --porcelain   # must be empty; if not, stop and ask the user
     git fetch origin
     git checkout -b voltviz-{VERSION} origin/main
     ```
   - The name matches the `voltviz-*.*.*` trigger in `.github/workflows/voltviz.yml` so the workflow runs on push.

### 4. Update Configuration Files
   - Update `voltviz/config.json`: set `version` to the target version.
   - Update `voltviz/CHANGELOG.md`: prepend a new entry at the top with:
     - Version heading: `## [VERSION] - YYYY-MM-DD` (use today's date — the date the add-on is released — not the upstream release date)
     - The same section headings upstream uses for those versions (`### Added`, `### Changed`, `### Fixed`, `### Known limitations`, …), in upstream order, omitting empty sections
     - When consolidating several upstream versions, merge their bullets under a single set of headings
     - Keep existing format and style
   - Leave `.github/workflows/voltviz.yml` alone: it builds `FROM ghcr.io/sanderdw/voltviz:<config.json version>`, so the GHCR tag check in step 1 is what keeps the build working.

### 5. Validate
   - `voltviz/config.json` version and the changelog heading both show the target version.
   - `git status --short` lists only the two files above.

### 6. Commit, Push and Open Pull Request
Only publish when the user asked for a release or PR in this request (invoking this skill by name counts). If they only asked to check or prepare the update, stop after step 5 and summarize the diff.
   - Stage changes: `git add voltviz/config.json voltviz/CHANGELOG.md`
   - Commit with message (subject example: `chore: update voltviz to 0.22.2`):
     ```
     chore: update voltviz to {VERSION}

     - Update add-on version from {OLD} to {NEW}
     - Add CHANGELOG entry for {VERSION} release
     - [List key upstream changes]

     Upstream changelog: https://github.com/sanderdw/voltviz/blob/main/CHANGELOG.md
     ```
   - Push to remote: `git push -u origin voltviz-{VERSION}`
   - Create PR to `main` with title: `chore: update voltviz to {VERSION}`
   - PR body should include:
     - Summary of upstream changes
     - Added features / visualizers, changes, and fixes (matching the changelog sections)
     - Link to upstream changelog

## Decision Points
- If upstream CHANGELOG contains duplicates or formatting issues: clean and consolidate.
- If the upstream CHANGELOG has no entry for the target version: stop and ask the user for release notes rather than inventing them.
- If the target tag is not published for `linux/amd64` or `linux/arm64`: stop and tell the user; do not bump to it.
- If the latest GHCR tag equals the current add-on version: stop and tell the user there is nothing to release.

## Completion Criteria
- `voltviz/config.json` version matches target version.
- `voltviz/CHANGELOG.md` has new top entry with the target version, today's date, and the upstream changes for every version since the last add-on release.
- The target version exists as a tag on GHCR for `linux/amd64` and `linux/arm64`.
- Branch `voltviz-{VERSION}` created from `origin/main`.
- If published: both files (config, changelog) committed together in one atomic commit with subject `chore: update voltviz to {VERSION}`, branch pushed, and PR opened to `main` with descriptive body linking upstream changes.

## Example Prompt
```
Update voltviz to the latest image on ghcr.io/sanderdw/voltviz.
Use the upstream CHANGELOG as the base and create a PR.
```
