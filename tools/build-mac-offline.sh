#!/bin/sh
set -eu
mkdir -p /work
cp -R /source/app /source/backend /source/tools /source/tests /source/docs /work/
cp /source/package.json /source/package-lock.json /work/
cp /source/LICENSE /source/THIRD_PARTY_NOTICES.md /work/
cp -R /runtime-cache /work/electron-cache
cd /work
node --test tests/*.test.mjs > /deliverables/linux-test-results.log 2>&1
ELECTRON_CACHE_ROOT=/work/electron-cache STUDIO_BUILD_OUT=/build node tools/build.mjs darwin arm64
ELECTRON_CACHE_ROOT=/work/electron-cache STUDIO_BUILD_OUT=/build node tools/build.mjs darwin x64
python3 tools/package-release.py mac /build /deliverables
