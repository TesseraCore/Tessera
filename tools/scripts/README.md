# Utility Scripts

Utility scripts for development and maintenance tasks.

## Dependency Version Management

This project uses **pnpm catalogs** for centralized dependency version management. All dependency versions are defined in `pnpm-workspace.yaml` under the `catalog` section, and packages reference them using the `catalog:` protocol.

**Benefits:**
- **Single source of truth**: Update dependency versions in one place (`pnpm-workspace.yaml`)
- **Consistent versions**: All packages automatically use the same versions
- **Simplified upgrades**: Change a version once, and it updates everywhere
- **Reduced merge conflicts**: Less version conflicts in `package.json` files

**How it works:**
1. Dependencies are defined in `pnpm-workspace.yaml` under the `catalog` section
2. Packages reference catalog entries using `"dependency-name": "catalog:"`
3. When you run `pnpm install`, pnpm resolves `catalog:` references to the versions defined in the catalog

**To update a dependency version:**
1. Update the version in `pnpm-workspace.yaml` under the `catalog` section
2. Run `pnpm install` to apply the changes

**Example:**
```yaml
# pnpm-workspace.yaml
catalog:
  typescript: ^5.0.0
  vitest: ^1.0.0
```

```json
// package.json
{
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```
