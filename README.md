# Supernote plugin workspace

Shared tools, template and conventions for Supernote plugins. Each plugin lives in its own subfolder with its own git repo.

```bash
tools/new-plugin.sh MyPlugin "My Plugin"   # scaffold
tools/bump.sh MyPlugin                     # versionCode +1 (do this before every device install)
tools/build.sh MyPlugin                    # tsc + jest + package → MyPlugin/build/outputs/MyPlugin.snplg
tools/deploy.sh MyPlugin                   # adb push, or OpenMTP instructions
tools/logs.sh                              # filtered logcat
```

See [CLAUDE.md](CLAUDE.md) for the rules and gotchas.
