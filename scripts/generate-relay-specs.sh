#!/bin/bash
set -e
source scripts/_init_var.sh

if [ -z "$AXIAAXC_VERSION" ]; then
  AXIAAXC_VERSION="sha-`egrep -o '/axiaaxc.*#([^\"]*)' Cargo.lock | \
    head -1 | sed 's/.*#//' |  cut -c1-8`"
fi

echo "Using Axiaaxc revision #${AXIAAXC_VERSION}"

echo "=================== Betanet-Local ==================="
docker run -it -v $(pwd)/build:/build purestake/moonbase-relay-testnet:$AXIAAXC_VERSION \
  /usr/local/bin/axiaaxc \
    build-spec \
      --chain betanet-local \
      -lerror \
      --disable-default-bootnode \
      --raw \
    > $BETANET_LOCAL_RAW_SPEC
echo $BETANET_LOCAL_RAW_SPEC generated