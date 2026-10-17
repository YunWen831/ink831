import { PARTY } from './world.js?v=0.11.0';

export function partyStatus(players,phase='forming') {
  const members=Array.from(players),count=members.length;
  const connected=members.filter(p=>p.connected).length;
  const ready=members.filter(p=>p.connected&&p.ready).length;
  return {count,connected,ready,minPlayers:PARTY.min,capacity:PARTY.max,
    canStart:phase==='forming'&&count>=PARTY.min&&count<=PARTY.max&&connected===count&&ready===count};
}
