#!/bin/bash

if [[ -z "${DISPLAY}" ]]; then
    sudo apt-get install -y xvfb
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
    export DISPLAY=:99
fi
npm test
