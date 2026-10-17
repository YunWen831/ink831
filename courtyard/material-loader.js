// Four requests at a time; immutable URLs also persist in the browser HTTP cache.
export function createMaterialLoader({materials,base=()=>location.origin,loaded=()=>{}}){
  const waiting=new Set(),queue=[],retry=new Map();let active=0;
  function pump(){while(active<4&&queue.length){const id=queue.shift(),m=materials.get(id);if(!m||m.pixels){waiting.delete(id);continue;}active++;
    fetch(`${base()}/api/materials/${encodeURIComponent(id)}?v=${encodeURIComponent(m.rev)}`,{signal:AbortSignal.timeout(12000)}).then(async r=>{if(!r.ok)throw Error('texture unavailable');const data=await r.json();if(data.rev===m.rev&&materials.get(id)?.rev===m.rev){Object.assign(materials.get(id),{pixels:data.pixels});loaded(id);}}).catch(()=>retry.set(id,Date.now()+10000)).finally(()=>{active--;waiting.delete(id);pump();});
  }}
  return function ensure(id){const m=materials.get(id);if(!m||m.pixels||!m.rev||waiting.has(id)||(retry.get(id)||0)>Date.now())return;waiting.add(id);queue.push(id);pump();};
}
