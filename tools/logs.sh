#!/bin/bash
# Stream plugin-relevant logcat lines. PluginSec DENY lines mean a missing permission.
# usage: tools/logs.sh [extra grep pattern]
set -euo pipefail
source "$(dirname "$0")/env.sh"
adb get-state >/dev/null 2>&1 || { echo "No ADB device connected." >&2; exit 1; }
adb logcat -c
if [[ -n "${1:-}" ]]; then
    adb logcat -v time -s ReactNativeJS:V PluginHost:V SNPlugin:V PluginSec:V | grep --line-buffered -E "$1"
else
    adb logcat -v time -s ReactNativeJS:V PluginHost:V SNPlugin:V PluginSec:V
fi
