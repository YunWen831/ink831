// One assignment per player and book each step; no repeats within a full circuit.
export function relayOrder(count,steps,random=Math.random){
  function shuffle(list){for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
  const seats=Array.from({length:count},(_,i)=>i),rows=[];let used=seats.map(()=>new Set());
  for(let step=0;step<steps;step++){
    if(step%count===0)used=seats.map(()=>new Set());
    let row;
    if(step===0)row=seats.slice();
    else{
      const owner=Array(count).fill(-1),previous=rows[step-1];
      function assign(seat,seen){
        for(const book of shuffle(seats.slice())){
          if(used[seat].has(book)||previous[seat]===book||seen.has(book))continue;seen.add(book);
          if(owner[book]<0||assign(owner[book],seen)){owner[book]=seat;return true;}
        }
        return false;
      }
      for(const seat of shuffle(seats.slice()))if(!assign(seat,new Set()))throw Error('Relay assignment unavailable');
      row=Array(count);owner.forEach((seat,book)=>{row[seat]=book;});
    }
    row.forEach((book,seat)=>used[seat].add(book));rows.push(row);
  }
  return rows;
}
