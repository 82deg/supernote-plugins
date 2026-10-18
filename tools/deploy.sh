#!/bin/bash
# Copy the built .snplg to the device's MyStyle folder (ADB), or explain the manual route.
# usage: tools/deploy.sh <PluginName>
set -euo pipefail
source "$(dirname "$0")/env.sh"
DIR="$(plugin_dir "${1:-}")"
name="$(json_get "$DIR/package.json" name)"
out="$DIR/build/outputs/$name.snplg"
[[ -f "$out" ]] || { echo "No build at $out. Run tools/build.sh $1 first." >&2; exit 1; }
code="$(unzip -p "$out" PluginConfig.json | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0)).versionCode))')"

if command -v adb >/dev/null && adb get-state >/dev/null 2>&1; then
    adb push "$out" /storage/emulated/0/MyStyle/
    echo "Pushed build $code. On the device: Settings → Apps → Plugins → Add Plugin → MyStyle → $name.snplg"
    echo "(Use Add Plugin, not reinstall: reinstall reuses the old copy.)"
else
    echo "No ADB device. Copy manually with OpenMTP:"
    echo "  $out  →  Nomad: MyStyle/"
    echo "Then on the device: Settings → Apps → Plugins → Add Plugin → $name.snplg (build $code)"
    open -R "$out" 2>/dev/null || true
fi
