# Sourced by the other tools: toolchain paths for Supernote plugin builds.
# Node 22 is keg-only in Homebrew, so it is put first on PATH here.
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="/opt/homebrew/opt/node@22/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export WORKSPACE

# plugin_dir <Name>: absolute path of a plugin folder, or exit with an error.
plugin_dir() {
    local name="${1:-}"
    if [[ -z "$name" ]]; then
        echo "usage: $(basename "$0") <PluginName>" >&2
        exit 2
    fi
    local dir="$WORKSPACE/$name"
    if [[ ! -f "$dir/PluginConfig.json" && ! -f "$dir/package.json" ]]; then
        echo "no plugin at $dir" >&2
        exit 1
    fi
    echo "$dir"
}

# json_get <file> <key>: print a top-level string value from a JSON file.
json_get() {
    node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))[process.argv[2]];process.stdout.write(v===undefined?"":String(v))' "$1" "$2"
}
