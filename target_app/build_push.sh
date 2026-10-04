#!/usr/bin/env bash
# build_push.sh – build and push all shop images to localhost:5000
set -e

REGISTRY="localhost:5000"
VERSIONS=("1.3.0" "1.4.0" "1.5.0")

echo "==> Building and pushing shop images..."
for VER in "${VERSIONS[@]}"; do
    TAG="${REGISTRY}/shop:${VER}"
    echo "--- Building ${TAG} ---"
    docker build -t "${TAG}" "target_app/v${VER}/"
    echo "--- Pushing ${TAG} ---"
    docker push "${TAG}"
done
echo "==> Done. Images in registry:"
curl -sf http://localhost:5000/v2/shop/tags/list
echo ""
