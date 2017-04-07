#!/bin/bash
# Copies files to build/ for archive and upload to server.
# Updates occurences of REPLACE_VERSION in files with a unique UUID for the version.

rm -rf build
mkdir build
cp -r images build/images
cp -r lib build/lib
cp -r scripts build/scripts
cp -r styles build/styles
cp -r config.js build/config.js
cp -r index.html build/index.html
cp -r service-worker.js build/service-worker.js
cp -r manifest.json build/manifest.json
cp -r favicon.ico build/favicon.ico

version=$(uuidgen)

sed -i.bak "s/REPLACE_VERSION/$version/g" build/index.html
rm build/index.html.bak
sed -i.bak "s/REPLACE_VERSION/$version/g" build/service-worker.js
rm build/service-worker.js.bak

echo "Now compress the contents of ./build/ and deploy to AWS"
