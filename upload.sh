#!/bin/bash
set -euo pipefail

curl --netrc-optional ftp://192.168.1.249/switch:/ --upload-file forwardz.nro
