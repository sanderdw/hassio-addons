---
name: voltviz-release-update
description: Update the VoltViz add-on to the latest upstream release, including version bumps, changelog, workflow config, and PR creation. Use when releasing new VoltViz versions.
argument-hint: 'Optional: specific target version. If omitted, fetches latest from upstream.'
user-invocable: true
disable-model-invocation: false
---

# VoltViz Release Update

## What This Skill Produces
A complete VoltViz add-on release across all configuration and workflow files, including:
- Updated app version in `voltviz/config.json`
- New release entry in `voltviz/CHANGELOG.md` with upstream changes
- Updated base image tag in `.github/workflows/voltviz.yml`
- New git branch `voltviz-{version}`
- Committed changes with descriptive message
- Pull request to `main` with changelog summary

## When to Use
Use this skill when:
- A new upstream VoltViz version is released
- You want to bring the add-on in sync with upstream
- You need consistent version tracking across config, changelog, and CI/CD

## Inputs
Provide:
- Optional: Target upstream version (example: `0.18.0`). If omitted, fetches the latest from https://github.com/sanderdw/voltviz

## Procedure

### 1. Discover Current and Target Versions
   - Read `voltviz/config.json` to find current add-on version.
   - Visit https://github.com/sanderdw/voltviz/blob/main/CHANGELOG.md and identify the latest upstream version (or use user-provided version).
   - Compare to confirm a version bump is needed.

### 2. Fetch Upstream Changelog
   - Read the upstream CHANGELOG.md at https://github.com/sanderdw/voltviz
   - Extract the changelog entry for the target version.
   - Note: The upstream repo does not use GitHub Releases, so CHANGELOG.md is the source of truth.

### 3. Update Configuration Files
   - Update `voltviz/config.json`: set `version` to the target version.
   - Update `voltviz/CHANGELOG.md`: prepend a new entry at the top with:
     - Version heading: `## [VERSION] - YYYY-MM-DD` (use today's date — the date the add-on is released — not the upstream release date)
     - `### Added` section with new features from upstream
     - `### Changed` section with improvements/refactors from upstream
     - Keep existing format and style
   - Update `.github/workflows/voltviz.yml`:
     - For both `DOCKER_TAG_SUFFIX: amd64` and `DOCKER_TAG_SUFFIX: aarch64` matrix entries
     - Update `BASE_IMAGE` from `ghcr.io/sanderdw/voltviz:OLD_VERSION` to `ghcr.io/sanderdw/voltviz:NEW_VERSION`

### 4. Commit and Create Branch
   - Create new branch: `git checkout -b voltviz-{NEW_VERSION}`
   - Stage changes: `git add voltviz/config.json voltviz/CHANGELOG.md .github/workflows/voltviz.yml`
   - Commit with message:
     ```
     chore: update voltviz to {VERSION}
     
     - Update add-on version from {OLD} to {NEW}
     - Add CHANGELOG entry for {VERSION} release
     - Update workflow BASE_IMAGE to {VERSION}
     - [List key upstream features]
     
     Upstream changelog: https://github.com/sanderdw/voltviz/blob/main/CHANGELOG.md
     ```
   - Push to remote: `git push -u origin voltviz-{VERSION}`

### 5. Create Pull Request
   - Create PR to `main` with title: `chore: update voltviz to {VERSION}`
   - PR body should include:
     - Summary of upstream changes
     - List of new visualizers or features
     - List of improvements/refactors
     - Link to upstream changelog

## Decision Points
- If upstream CHANGELOG contains duplicates or formatting issues: clean and consolidate.
- If upstream version includes only patch/minor changes: update workflow and config without feature highlights.
- If no new commits since last release: confirm with user before proceeding.

## Completion Criteria
- `voltviz/config.json` version matches target version.
- `voltviz/CHANGELOG.md` has new top entry with upstream version, date, and changes.
- `.github/workflows/voltviz.yml` BASE_IMAGE tags match target version for both architectures.
- Branch named `voltviz-{VERSION}` created and pushed.
- PR opened to `main` with descriptive body linking upstream changes.
- All three files (config, changelog, workflow) committed together in one atomic commit.

## Example Prompt
```
Update voltviz to 0.18.0 using the latest from https://github.com/sanderdw/voltviz. 
Use its CHANGELOG as the base and create a PR.
```
