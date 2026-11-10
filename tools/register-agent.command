#!/bin/sh
set -eu
studio_tools=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -x "$studio_tools/../../MacOS/AgentOfficeStudio" ]; then
  ELECTRON_RUN_AS_NODE=1 "$studio_tools/../../MacOS/AgentOfficeStudio" "$studio_tools/register-agent.mjs" "$@"
else
  node "$studio_tools/register-agent.mjs" "$@"
fi
