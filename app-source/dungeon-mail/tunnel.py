"""Keep the development tunnel running and record its current public endpoint.

A Quick Tunnel hostname changes after a connector process restart. After that,
copy run/endpoint.json into courtyard/config.json and publish the new config.
No GitHub credentials are stored on the VM.
"""
import datetime
import json
import os
import pathlib
import re
import signal
import subprocess
import sys

BASE = pathlib.Path(os.environ.get('DUNGEON_BASE', pathlib.Path.home() / 'dungeon-mail-test'))
RUN = BASE / 'run'
RUN.mkdir(mode=0o700, exist_ok=True)
process = subprocess.Popen([
    str(BASE / 'bin/cloudflared'), 'tunnel', '--no-autoupdate',
    '--protocol', 'http2', '--edge-ip-version', '6',
    '--metrics', '127.0.0.1:20242', '--url', 'http://127.0.0.1:2567',
], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)


def stop(signum, frame):
    if process.poll() is None:
        process.terminate()


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
for line in process.stdout:
    print(line.rstrip(), flush=True)
    match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
    if match:
        data = {
            'endpoint': match.group(0),
            'updatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'temporary': True,
        }
        temporary = RUN / 'endpoint.tmp'
        temporary.write_text(json.dumps(data, indent=2) + '\n')
        temporary.replace(RUN / 'endpoint.json')
sys.exit(process.wait())
