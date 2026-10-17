// Offline operator tool. Stop courtyard.service and back up data before use.
// node assign-legacy.js ACCOUNT material MATERIAL_ID
// node assign-legacy.js ACCOUNT tile COL,ROW
// Ownership must be independently confirmed by the site owner, never by nickname.
import { resolve } from 'node:path';
import { AccountStore } from './accounts.js';
import { WorldStore } from './world-store.js';
const [name,type,id]=process.argv.slice(2);
if(!name||!['material','tile'].includes(type)||!id)throw new Error('Usage: node assign-legacy.js ACCOUNT material|tile ID');
const directory=resolve(process.env.DATA_DIR||'data'),accounts=await new AccountStore(directory).load(),user=accounts.find(name);
if(!user)throw new Error('Account not found');
const store=await new WorldStore(directory).load();
await store.transact(data=>{
  const item=type==='material'?data.materials.find(m=>m.id===id):data.tiles.find(t=>`${t.col},${t.row}`===id);
  if(!item||item.ownerId)throw new Error('Only unassigned legacy content can be assigned');
  item.ownerId=user.id;
});
console.log('Confirmed legacy ownership assigned.');
