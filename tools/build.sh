#!/bin/bash
# Type-check, test, verify version sync, then package the plugin.
# usage: tools/build.sh <PluginName>
set -euo pipefail
source "$(dirname "$0")/env.sh"
DIR="$(plugin_dir "${1:-}")"
cd "$DIR"

cfg_code="$(json_get PluginConfig.json versionCode)"
cfg_name="$(json_get PluginConfig.json versionName)"
ts_code="$(sed -n "s/.*VERSION_CODE = \([0-9]*\).*/\1/p" src/version.ts)"
ts_name="$(sed -n "s/.*VERSION_NAME = '\([^']*\)'.*/\1/p" src/version.ts)"
if [[ "$cfg_code" != "$ts_code" || "$cfg_name" != "$ts_name" ]]; then
    echo "Version mismatch: PluginConfig.json $cfg_name ($cfg_code) vs src/version.ts $ts_name ($ts_code)" >&2
    echo "Fix with tools/bump.sh, or edit both files." >&2
    exit 1
fi

echo "==> tsc"; npx tsc --noEmit
echo "==> jest"; npx jest --silent
echo "==> buildPlugin.sh (log: $DIR/build.log)"
if ! ./buildPlugin.sh > build.log 2>&1; then
    tail -40 build.log
    exit 1
fi
grep -q "APK build failed" build.log && { echo "Native build failed; see build.log" >&2; exit 1; }

name="$(json_get package.json name)"
out="$DIR/build/outputs/$name.snplg"
echo
echo "Built $out ($(du -h "$out" | cut -f1)) — v$cfg_name ($cfg_code)"
echo "Packaged config:"
unzip -p "$out" PluginConfig.json | node -e 'const c=JSON.parse(require("fs").readFileSync(0));console.log(JSON.stringify({name:c.name,versionName:c.versionName,versionCode:c.versionCode,permissions:c["uses-permissions"]||[],reactPackages:c.reactPackages||[],icon:c.iconPath},null,2))'
