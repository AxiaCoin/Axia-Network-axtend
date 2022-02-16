#!/bin/bash
# Loading binary/specs variables

if [ -z "$AXIAAXC_COMMIT" ]; then
  AXIAAXC_COMMIT=`egrep -o '/axiaaxc.*#([^\"]*)' Cargo.lock | \
    head -1 | sed 's/.*#//' |  cut -c1-8`
fi

if [ -z "$AXIAAXC_REPO" ]; then
  AXIAAXC_REPO=`egrep -o 'https://github.com/[^\/]*/axiaaxc\\?branch=' Cargo.lock | \
    head -1 | sed 's/?branch=//'`
fi

echo "Using Axiaaxc from $AXIAAXC_REPO revision #${AXIAAXC_COMMIT}"

docker build . -f docker/axiaaxc-relay.Dockerfile \
  --build-arg AXIAAXC_COMMIT="$AXIAAXC_COMMIT" \
  --build-arg AXIAAXC_REPO="$AXIAAXC_REPO" \
  -t purestake/moonbase-relay-testnet:sha-$AXIAAXC_COMMIT
