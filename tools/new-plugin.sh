#!/bin/bash
# Scaffold a new Supernote plugin with the workspace conventions applied.
# usage: tools/new-plugin.sh <Name> ["Display Name"]
set -euo pipefail
source "$(dirname "$0")/env.sh"

NAME="${1:-}"
DISPLAY="${2:-$NAME}"
if [[ ! "$NAME" =~ ^[A-Z][A-Za-z0-9]+$ ]]; then
    echo "usage: $(basename "$0") <PascalCaseName> [\"Display Name\"]" >&2
    exit 2
fi
DIR="$WORKSPACE/$NAME"
if [[ -e "$DIR" ]]; then
    echo "$DIR already exists" >&2
    exit 1
fi

SN_PLUGIN_LIB_VERSION="${SN_PLUGIN_LIB_VERSION:-$(npm view sn-plugin-lib version)}"
echo "==> Scaffolding $NAME (sn-plugin-lib $SN_PLUGIN_LIB_VERSION)"
cd "$WORKSPACE"
npx --yes @react-native-community/cli init "$NAME" \
    --template @supernote-plugin/sn-plugin-template --version 0.79.2 \
    --skip-git-init --install-pods false

cd "$DIR"
chmod +x buildPlugin.sh

echo "==> Patching buildPlugin.sh so @react-native-community native modules get built"
perl -0pi -e 's/    \[\[ "\$lower" == \@react-native\* \]\] && return 0\n/    # Workspace patch: community native modules are not provided by PluginHost and\n    # must trigger the native build; only CLI\/tooling packages are ignored.\n    [[ "\$lower" == \@react-native-community\/cli* ]] && return 0\n    [[ "\$lower" == \@react-native\/* ]] && return 0\n    [[ "\$lower" == \@react-native* && "\$lower" != \@react-native-community\/* ]] && return 0\n/' buildPlugin.sh
grep -q 'Workspace patch' buildPlugin.sh || { echo "buildPlugin.sh patch did not apply; check upstream changes" >&2; exit 1; }

echo "==> Pinning dependencies"
npm install --save-exact "sn-plugin-lib@$SN_PLUGIN_LIB_VERSION"
npm install --save-dev --save-exact @types/react@19.0.0

echo "==> Copying template files"
cp -R "$WORKSPACE/_template/." "$DIR/"
for f in index.js App.tsx README.md src/log.ts; do
    perl -pi -e "s/__NAME__/$NAME/g; s/__DISPLAY__/$DISPLAY/g" "$f"
done
YEAR="$(date +%Y)"
sed "s/__YEAR__/$YEAR/" "$WORKSPACE/tools/LICENSE.tmpl" > LICENSE
printf '\n# build logs + logs pulled from the device (tools/mtp.sh log)\nbuild*.log\ndevice-logs/\n' >> .gitignore

echo "==> First build (generates PluginConfig.json and pluginID)"
./buildPlugin.sh > build.log 2>&1 || { tail -30 build.log; exit 1; }

node - "$DISPLAY" <<'EOF'
const fs = require('fs');
const display = process.argv[2];
const cfg = JSON.parse(fs.readFileSync('PluginConfig.json', 'utf8'));
Object.assign(cfg, {
  name: display,
  desc: 'TODO: describe what this plugin does.',
  author: '82deg',
  iconPath: 'assets/icon.png',
  versionName: '0.1.0',
  versionCode: '1',
  'uses-permissions': [],
});
fs.writeFileSync('PluginConfig.json', JSON.stringify(cfg, null, 2) + '\n');
EOF

echo "==> Verifying"
npx tsc --noEmit
npx jest --silent

git init -q -b main
git add -A
git commit -q -m "Scaffold $NAME from workspace template

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

echo
echo "Created $DIR"
echo "pluginID: $(json_get "$DIR/PluginConfig.json" pluginID)  (never change it)"
echo "Next: edit PluginConfig.json desc/permissions, then: tools/build.sh $NAME"
