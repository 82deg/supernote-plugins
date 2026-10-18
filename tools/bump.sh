#!/bin/bash
# Increment versionCode (and optionally set versionName) in PluginConfig.json and src/version.ts.
# usage: tools/bump.sh <PluginName> [newVersionName]
set -euo pipefail
source "$(dirname "$0")/env.sh"
DIR="$(plugin_dir "${1:-}")"
cd "$DIR"

node - "${2:-}" <<'EOF'
const fs = require('fs');
const newName = process.argv[2];
const cfg = JSON.parse(fs.readFileSync('PluginConfig.json', 'utf8'));
cfg.versionCode = String(Number(cfg.versionCode) + 1);
if (newName) cfg.versionName = newName;
fs.writeFileSync('PluginConfig.json', JSON.stringify(cfg, null, 2) + '\n');
let ts = fs.readFileSync('src/version.ts', 'utf8');
ts = ts.replace(/VERSION_CODE = \d+/, `VERSION_CODE = ${cfg.versionCode}`)
       .replace(/VERSION_NAME = '[^']*'/, `VERSION_NAME = '${cfg.versionName}'`);
fs.writeFileSync('src/version.ts', ts);
console.log(`v${cfg.versionName} (${cfg.versionCode})`);
EOF
