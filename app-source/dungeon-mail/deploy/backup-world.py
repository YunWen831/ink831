"""Back up a complete atomic world.json; retain fourteen daily snapshots."""
import datetime
import gzip
import json
import pathlib
import io
import tarfile

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
complete = folder / ('state-' + day + '.tar.gz')
staging = complete.with_suffix('.tmp')
with tarfile.open(staging,'w:gz') as archive:
    def add_bytes(name,content):
        entry=tarfile.TarInfo(name);entry.size=len(content);entry.mode=0o600
        archive.addfile(entry,io.BytesIO(content))
    add_bytes('world.json',raw)
    for avatar in sorted((base/'data/avatars').glob('*.json')):
        content=avatar.read_bytes();assert isinstance(json.loads(content)['frames'],list)
        add_bytes('avatars/'+avatar.name,content)
    for levels in sorted((base/'data/levels').glob('*.json')):
        content=levels.read_bytes();assert isinstance(json.loads(content)['maps'],list)
        add_bytes('levels/'+levels.name,content)
    # Read identities last so an account created during the backup is included
    # before any newly created avatar/level referencing that identity is restored.
    accounts=base/'data/accounts.json'
    if accounts.exists():
        content=accounts.read_bytes();assert json.loads(content)['version']==1
        add_bytes('accounts.json',content)
staging.chmod(0o600);staging.replace(complete)
for stale in sorted(folder.glob('state-????-??-??.tar.gz'))[:-14]:
    stale.unlink()
print('World and account backup saved:', target.name,complete.name)
