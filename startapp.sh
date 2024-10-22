#!/bin/sh

# Start Chromium and open Google
#/usr/bin/chromium-browser --no-sandbox --disable-dev-shm-usage https://www.google.com &

cd /src
pm2 start index.js

exec /usr/bin/xterm
