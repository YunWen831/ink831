// Sparse cooldowns keep four-player snapshots small even on elaborate courses.
const fields={crystals:'crystalCharges',crumbles:'crumbleCharges',doors:'doorCharges'};
export function packState(state){
  const packed={};for(const [key,value] of Object.entries(state))if(!(key in fields))packed[key]=typeof value==='number'?Math.round(value*10000)/10000:value;
  for(const [key,wire] of Object.entries(fields)){
    const charges=(state[key]||[]).flatMap((time,index)=>time>0?[[index,Math.round(time*10000)/10000]]:[]);
    if(charges.length||key==='crystals')packed[wire]=charges;
  }return packed;
}
export function unpackState(packed){
  const state={...packed};for(const [key,wire] of Object.entries(fields)){
    state[key]=[...(packed[key]||[])];for(const [index,time] of packed[wire]||[])state[key][index]=time;delete state[wire];
  }state.switchContacts=[...(packed.switchContacts||[])];return state;
}
