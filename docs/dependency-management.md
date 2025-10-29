# Dependency Management

## What is Dependabot?

Dependabot automatically monitors dependencies in the public repository and creates pull requests for security updates and version upgrades. This keeps GAIA's Python and JavaScript dependencies current and secure.

## When to Add Your App

Add your app to `.github/dependabot.yml` if:

- ✅ It has a `package.json` file (JavaScript/npm dependencies)
- ✅ It's located in `src/gaia/apps/`

**Rule:** All apps with dependencies must be configured for automated monitoring.

**Note:** Apps are configured with `open-pull-requests-limit: 0` which means Dependabot will monitor for security vulnerabilities but will NOT create pull requests automatically. This prevents PR noise while maintaining security visibility in GitHub's Security tab.

## How to Add Your App

### 1. Edit `.github/dependabot.yml`

Add this configuration for your app:

```yaml
  # JavaScript - [Your App Name] (monitor only, no PRs)
  - package-ecosystem: "npm"
    directory: "/src/gaia/apps/[your-app-name]/webui"
    schedule:
      interval: "monthly"
    labels:
      - "dependencies"
      - "javascript"
      - "[your-app-name]-app"
    open-pull-requests-limit: 0
    groups:
      [your-app-name]-app-dependencies:
        patterns:
          - "*"
```

### 2. Real Example

Here's how the Jira app is configured:

```yaml
  # JavaScript - Jira app (monitor only, no PRs)
  - package-ecosystem: "npm"
    directory: "/src/gaia/apps/jira/webui"
    schedule:
      interval: "monthly"
    labels:
      - "dependencies"
      - "javascript"
      - "jira-app"
    open-pull-requests-limit: 0
    groups:
      jira-app-dependencies:
        patterns:
          - "*"
```

### 3. Important Notes

- **Directory path**: Must exactly match your app's webui folder (e.g., `/src/gaia/apps/example/webui`)
- **App name**: Use consistent naming in labels and group name
- **Schedule**: Use `monthly` for most apps
- **PR Limit**: Apps use `open-pull-requests-limit: 0` (monitoring only). Root Python dependencies use `open-pull-requests-limit: 1` (one PR at a time for core updates)

## Configuration Reference

### Update Schedules

- `weekly` - Python core, GitHub Actions (with `open-pull-requests-limit: 1`)
- `monthly` - Apps and POC examples (with `open-pull-requests-limit: 0`)

### PR Limits Strategy

| Component | Limit | Behavior |
|-----------|-------|----------|
| Python core dependencies | 1 | One PR at a time for critical updates |
| GitHub Actions | 1 | One PR at a time |
| Root NPM (if exists) | 1 | One PR at a time |
| Apps (example, jira, eval) | 0 | Monitor only - alerts without PRs |

**Monitoring without PRs:** Setting `open-pull-requests-limit: 0` means Dependabot scans for vulnerabilities and reports them in GitHub's Security tab, but doesn't create automatic pull requests. This is ideal for apps where updates can be managed manually.

### Dependency Grouping

The `groups` section combines all dependency updates into a single PR instead of creating dozens of separate PRs. This reduces noise and makes reviews easier.

### Configuration Fields

- `package-ecosystem`: Package manager type (`npm`, `pip`, `github-actions`)
- `directory`: Path to folder containing `package.json`
- `schedule.interval`: How often to check (`weekly` or `monthly`)
- `labels`: Tags added to PRs for filtering
- `open-pull-requests-limit`: Max concurrent PRs (`0` = monitor only, `1+` = create PRs)
- `groups`: Combine related updates into single PR

## See Also

- [App Development Guide](apps/dev.md) - Building GAIA applications
- [Development Setup](dev.md) - Getting started with development
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot) - Official GitHub docs

## License

Copyright(C) 2024-2025 Advanced Micro Devices, Inc. All rights reserved.
SPDX-License-Identifier: MIT
