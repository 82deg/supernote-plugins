# Supernote plugin workspace

Supernote plugins by 82deg, plus the shared tools, template and conventions used to build them.

## Plugins

| Plugin | What it does | Latest |
|---|---|---|
| [Image Placer](ImagePlacer/) | Add pictures to your notes; crop and rotate them from the lasso menu | 1.0.0 |

Feedback and bugs: [open an issue](https://github.com/82deg/supernote-plugins/issues/new/choose) and pick the plugin.

## Developing

```bash
tools/new-plugin.sh MyPlugin "My Plugin"   # scaffold
tools/bump.sh MyPlugin                     # versionCode +1 (do this before every device install)
tools/build.sh MyPlugin                    # tsc + jest + package → MyPlugin/build/outputs/MyPlugin.snplg
tools/deploy.sh MyPlugin                   # adb push, or OpenMTP instructions
tools/logs.sh                              # filtered logcat
```

See [CLAUDE.md](CLAUDE.md) for the rules and gotchas.
