// Deterministic mechanism clock: restarted at spawn and at each map's checkpoint.
export const CRUMBLE_LIFETIME=3,CRUMBLE_DELAY=.4,DOOR_DURATION=4;
export function platformAt(platform,time=0){
  const offset=Math.sin(time*Math.PI/2)*(platform.range??48);
  return {...platform,x:platform.x+(platform.axis==='x'?offset:0),y:platform.y+(platform.axis==='y'?offset:0)};
}
// Snapshot rounding must not move a collapse across a simulation frame.
export const crumbleSolid=timer=>!timer||timer>CRUMBLE_LIFETIME-CRUMBLE_DELAY+.0001;
export function mechanismState(state){
  return {mechanismTime:state.mechanismTime||0,crumbles:[...(state.crumbles||[])],doors:[...(state.doors||[])],crystals:[...(state.crystals||[])]};
}
