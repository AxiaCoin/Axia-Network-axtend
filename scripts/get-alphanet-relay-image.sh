#/bin/sh

AXIAAXC_COMMIT=$(egrep -o '/axiaaxc.*#([^\"]*)' Cargo.lock | head -1 | sed 's/.*#//' |  cut -c1-8)
DOCKER_TAG="purestake/moonbase-relay-testnet:sha-$AXIAAXC_COMMIT"

# Build relay binary if needed
AXIAAXC_EXISTS=docker manifest inspect $DOCKER_TAG > /dev/null && "true" || "false"
if [[ "$AXIAAXC_EXISTS" == "false" ]]; then
  # $AXIAAXC_COMMIT is used to build the relay image
  ./scripts/build-alphanet-relay-image.sh
fi

# Get relay binary
docker create -ti --name dummy $DOCKER_TAG bash
docker cp dummy:/usr/local/bin/axiaaxc target/release/axiaaxc
docker rm -f dummy
