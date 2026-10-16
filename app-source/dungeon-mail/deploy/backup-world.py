"""Back up a complete atomic world.json; retain fourteen daily snapshots."""
import datetime
import gzip
import json
import pathlib

base = pathlib.Path('/home/ubuntu/dungeon-mail')
raw = (base / 'data/world.json').read_bytes()
world = json.loads(raw)
assert isinstance(world.get('materials'), list) and isinstance(world.get('tiles'), list)
folder = base / 'backups'
folder.mkdir(mode=0o700, exist_ok=True)
day = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
target = folder / ('world-' + day + '.json.gz')
temporary = target.with_suffix('.tmp')
temporary.write_bytes(gzip.compress(raw))
temporary.chmod(0o600)
temporary.replace(target)
for stale in sorted(folder.glob('world-????-??-??.json.gz'))[:-14]:
    stale.unlink()
print('World backup saved:', target.name)
