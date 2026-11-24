#!/usr/bin/env bash
# Nasadí landing page na ideas.laferrari.eu (Caddy v ~/projects/basic-web servíruje html/ideas).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p ~/projects/basic-web/html/ideas
cp site/index.html ~/projects/basic-web/html/ideas/index.html
echo "Nasazeno: https://ideas.laferrari.eu"
