#!/bin/bash
# Talk to the Nomad over USB (MTP) from the command line, via libmtp.
# OpenMTP / Android File Transfer must be QUIT first: only one app can hold the device.
#
# usage:
#   tools/mtp.sh detect                  is the device reachable?
#   tools/mtp.sh push <Plugin>           copy build/outputs/<Plugin>.snplg to MyStyle/
#   tools/mtp.sh log <Plugin>            pull EXPORT/<Plugin>/log.txt (+ log.prev.txt) to <Plugin>/device-logs/
set -euo pipefail
source "$(dirname "$0")/env.sh"
export LANG="${LANG:-en_US.UTF-8}" LC_ALL="${LC_ALL:-en_US.UTF-8}"

command -v mtp-connect >/dev/null || { echo "libmtp missing: brew install libmtp" >&2; exit 1; }

mtp() {
    # The first session after idle often fails with PTP_ERROR_IO + USB reset; retry once.
    local out attempt
    for attempt in 1 2; do
        out="$(mtp-connect "$@" 2>&1 | tr '\r' '\n' | grep -v -E '^Progress:|UTF-8|locale|diacritics')" || true
        if grep -q -E "claim_interface|Unable to initialize device|No devices" <<<"$out"; then
            echo "Can't open the Nomad over MTP. Is it plugged in, unlocked, and is OpenMTP quit?" >&2
            return 1
        fi
        if ! grep -q -E "Error sending file|could not|Invalid|PTP Layer error" <<<"$out"; then
            echo "$out"
            return 0
        fi
        [[ $attempt == 1 ]] && sleep 2
    done
    echo "$out" >&2
    return 1
}

cmd="${1:-}"
case "$cmd" in
    detect)
        out="$(mtp-detect 2>&1 || true)"
        if grep -q -E "claim_interface|Unable to initialize" <<<"$out"; then
            echo "Nomad found but busy: quit OpenMTP / Android File Transfer and retry." >&2; exit 1
        fi
        grep -E "Model:|Serial number:|Friendly name:" <<<"$out" || { echo "No MTP device found." >&2; exit 1; }
        ;;
    push)
        DIR="$(plugin_dir "${2:-}")"
        name="$(json_get "$DIR/package.json" name)"
        out="$DIR/build/outputs/$name.snplg"
        [[ -f "$out" ]] || { echo "No build at $out" >&2; exit 1; }
        code="$(unzip -p "$out" PluginConfig.json | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0)).versionCode))')"
        # Versioned file name: MTP happily keeps two files with the same name, and
        # the device picker can't tell builds apart. Old builds can be removed on the device.
        staged="$(mktemp -d)/$name-b$code.snplg"
        cp "$out" "$staged"
        # mtp-connect takes "source,destination" as ONE argument; the destination is the folder.
        mtp --sendfile "$staged,/MyStyle" | grep -q "New file ID" || { echo "Upload failed." >&2; exit 1; }
        echo "Pushed $name-b$code.snplg to MyStyle/."
        echo "On the Nomad: Settings → Apps → Plugins → Add Plugin → MyStyle → $name-b$code.snplg"
        ;;
    log)
        DIR="$(plugin_dir "${2:-}")"
        name="$(json_get "$DIR/package.json" name)"
        dest="$DIR/device-logs"
        mkdir -p "$dest"
        # The plugin writes one EXPORT/<Plugin>/log-YYYYMMDD-HHMMSS.txt per session.
        # MTP object ids change every session, so match by name and fetch by path.
        file_name="$(mtp-files 2>&1 | grep -o -E 'Filename: log-[0-9]{8}-[0-9]{6}\.txt' | sed 's/Filename: //' | sort | tail -1)"
        [[ -n "$file_name" ]] || { echo "No log-*.txt found yet (or MTP busy; retry)." >&2; exit 1; }
        mtp --getfile "/EXPORT/$name/$file_name,$dest/$file_name" >/dev/null
        [[ -s "$dest/$file_name" ]] || { echo "Pull of $file_name failed; retry." >&2; exit 1; }
        echo "$dest/$file_name"
        tail -60 "$dest/$file_name"
        ;;
    *)
        sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
        exit 2
        ;;
esac
