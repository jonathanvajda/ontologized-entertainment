export const NS='https://w3id.org/ontoeagle/games/everything-is-sus/';
export const GAME_ID='https://w3id.org/ontoeagle/games/everything-is-sus';
export const VERSION='0.2.0';

export const SUSPECTS=[
  ['eggshell','Mrs. Eggshell','white','person-mrs-eggshell.png'],['marinara','Lt. Marinara','red','person-lt-marinara.png'],['peach','Ms. Peach','orange','person-ms-peach.png'],
  ['mint','Mrs. Mint','green','person-mrs-mint-02.png'],['mulberry','Prof. Mulberry','purple','person-professor-mulberry.png'],['brown','Mr. Brown','brown','person-mr-brown-02.png']
].map(([id,label,color,image])=>({id,label,color,category:'suspect',image}));
export const WEAPONS=[['shovel','Shovel','weapon-shovel.png'],['bat','Baseball Bat','weapon-baseball-bat.png'],['pistol','Pistol','weapon-pistol.png'],['rope','Rope','weapon-rope.png'],['knife','Knife','weapon-knife.png'],['guitar','Electric Guitar','weapon-guitar-02.png']].map(([id,label,image])=>({id,label,category:'weapon',image}));
export const ROOMS=[
  ['ballroom','Ballroom','room-ballroom-topdown-03.png','room-ballroom-board-02.png'],
  ['living-room','Living Room','room-livingroom-topdown-02.png','room-livingroom-board-02.png'],
  ['dining-room','Dining Room','room-diningroom-topdown-02.png','room-diningroom-board-01.png'],
  ['kitchen','Kitchen','room-kitchen-topdown-02.png','room-kitchen-board-03.png'],
  ['study','Study','room-study-topdown-02.png','room-study-board-02.png'],
  ['game-room','Game Room','room-gameroom-topdown-04.png','room-gameroom-board-02.png'],
  ['screened-porch','Screened-in Porch','room-screened-in-porch-topdown-02.png','room-screened-in-porch-board-02.png'],
  ['greenhouse','Greenhouse','room-greenhouse-topdown-02.png','room-greenhouse-board-02.png'],
  ['pool-room','Swimming Pool Room','room-pool-room-topdown-02.png','room-pool-room-board-01.png']
].map(([id,label,image,boardImage])=>({id,label,category:'room',image,boardImage}));
export const CARDS=[...SUSPECTS,...WEAPONS,...ROOMS];
export const ROOM_GRID=[['pool-room','screened-porch','greenhouse'],['study','game-room','ballroom','kitchen'],['living-room','dining-room']];
export const BOARD_COLUMNS=26;
export const BOARD_ROWS=18;

export const BOARD_REGIONS=Object.freeze({
  'pool-room':{column:1,row:1,width:10,height:5,clip:'polygon(0 0,100% 0,100% 60%,90% 60%,90% 100%,0 100%)'},
  'screened-porch':{column:11,row:1,width:8,height:3},greenhouse:{column:19,row:1,width:8,height:3},
  study:{column:1,row:6,width:4,height:7},'game-room':{column:5,row:6,width:5,height:7},
  'living-room':{column:1,row:13,width:9,height:6},ballroom:{column:11,row:5,width:8,height:9},
  kitchen:{column:20,row:4,width:7,height:6},'dining-room':{column:20,row:10,width:7,height:9},
  foyer:{column:11,row:15,width:8,height:4,clip:'polygon(0 0,100% 0,100% 50%,75% 50%,75% 100%,25% 100%,25% 50%,0 50%)'}
});

const range=(fromColumn,fromRow,toColumn,toRow)=>{const cells=[];for(let row=fromRow;row<=toRow;row+=1)for(let column=fromColumn;column<=toColumn;column+=1)cells.push(cellId(column,row));return cells};
export const ROOM_CELLS=Object.freeze({
  'pool-room':Object.freeze([...range(1,1,10,3),...range(1,4,9,5)]),
  'screened-porch':Object.freeze(range(11,1,18,3)),greenhouse:Object.freeze(range(19,1,26,3)),
  study:Object.freeze(range(1,6,4,12)),'game-room':Object.freeze(range(5,6,9,12)),
  'living-room':Object.freeze(range(1,13,9,18)),ballroom:Object.freeze(range(11,5,18,13)),
  kitchen:Object.freeze(range(20,4,26,9)),'dining-room':Object.freeze(range(20,10,26,18))
});
export const FOYER_SITES=Object.freeze([...range(11,15,18,16),...range(13,17,16,18)]);
export const STAIR_SITES=Object.freeze([...range(10,17,12,18),...range(17,17,19,18)]);
const occupiedGeometry=new Set([...Object.values(ROOM_CELLS).flat(),...STAIR_SITES]);
export const WALKABLE_SITES=Object.freeze(Array.from({length:BOARD_ROWS},(_,row)=>Array.from({length:BOARD_COLUMNS},(_,column)=>cellId(column+1,row+1))).flat().filter(id=>!occupiedGeometry.has(id)));
export const START_SITES=Object.freeze(['L15','N15','P15','M16','O16','Q16']);

export const ENTRANCES=Object.freeze([
  {id:'pool-porch-door',kind:'door',cost:3,fromRoom:'pool-room',toRoom:'screened-porch'},
  {id:'porch-south-door',kind:'door',cost:3,room:'screened-porch',sites:['N4','O4']},
  {id:'ballroom-north-entry',kind:'entryway',cost:2,room:'ballroom',sites:['N4','O4']},
  {id:'greenhouse-hall-door',kind:'door',cost:3,room:'greenhouse',sites:['S4']},
  {id:'greenhouse-kitchen-door',kind:'door',cost:3,fromRoom:'greenhouse',toRoom:'kitchen'},
  {id:'study-game-door',kind:'door',cost:3,fromRoom:'study',toRoom:'game-room'},
  {id:'study-living-door',kind:'door',cost:3,fromRoom:'study',toRoom:'living-room'},
  {id:'game-hall-door',kind:'door',cost:3,room:'game-room',sites:['J11']},
  {id:'ballroom-west-entry',kind:'entryway',cost:2,room:'ballroom',sites:['J8','J9']},
  {id:'ballroom-east-entry',kind:'entryway',cost:2,room:'ballroom',sites:['S8','S9']},
  {id:'ballroom-south-entry',kind:'entryway',cost:2,room:'ballroom',sites:['N14','O14']},
  {id:'kitchen-dining-door',kind:'door',cost:3,fromRoom:'kitchen',toRoom:'dining-room'},
  {id:'living-hall-entry',kind:'entryway',cost:2,room:'living-room',sites:['J15','J16']},
  {id:'dining-hall-entry',kind:'entryway',cost:2,room:'dining-room',sites:['S15','S16']}
]);

export const ENTRANCE_MARKERS=Object.freeze([
  {id:'pool-porch-door',kind:'door',x:10,y:.55,width:.16,height:1.45},
  {id:'porch-south-door',kind:'door',x:13.25,y:3,width:1.5,height:.16},
  {id:'ballroom-north-entry',kind:'entryway',x:13.15,y:4,width:1.7,height:.16},
  {id:'greenhouse-hall-door',kind:'door',x:18.35,y:3,width:.65,height:.16},
  {id:'greenhouse-kitchen-door',kind:'door',x:23.7,y:3,width:1.3,height:.16},
  {id:'study-game-door',kind:'door',x:4,y:6.45,width:.16,height:1.4},
  {id:'study-living-door',kind:'door',x:1.8,y:12,width:1.4,height:.16},
  {id:'game-hall-door',kind:'door',x:9,y:9.9,width:.16,height:1.15},
  {id:'ballroom-west-entry',kind:'entryway',x:10,y:7.15,width:.16,height:1.7},
  {id:'ballroom-east-entry',kind:'entryway',x:18,y:7.15,width:.16,height:1.7},
  {id:'ballroom-south-entry',kind:'entryway',x:13.15,y:13,width:1.7,height:.16},
  {id:'kitchen-dining-door',kind:'door',x:22.25,y:9,width:1.5,height:.16},
  {id:'living-hall-entry',kind:'entryway',x:9,y:14.1,width:.16,height:1.75},
  {id:'dining-hall-entry',kind:'entryway',x:19,y:14.1,width:.16,height:1.75}
]);

export const SECRET_PASSAGES=Object.freeze({'pool-room':'dining-room','dining-room':'pool-room',greenhouse:'living-room','living-room':'greenhouse'});
export const SECRET_PASSAGE_CORNERS=Object.freeze({
  'pool-room':{corner:'top-left',symbol:'↖'},greenhouse:{corner:'top-right',symbol:'↗'},
  'living-room':{corner:'bottom-left',symbol:'↙'},'dining-room':{corner:'bottom-right',symbol:'↘'}
});
export const cardById=(id)=>CARDS.find(card=>card.id===id);
export const roomById=(id)=>ROOMS.find(room=>room.id===id);
export const isRoom=(id)=>ROOMS.some(room=>room.id===id);
export const isWalkableSite=(id)=>WALKABLE_SITES.includes(id);
export const cardImageUrl=(card)=>new URL(`./assets/art/${card.image}`,import.meta.url).href;
export const boardImageUrl=(room)=>new URL(`./assets/art/${room.boardImage}`,import.meta.url).href;
export const boardRegionStyle=(id)=>{const region=BOARD_REGIONS[id];if(!region)return'';return`--board-x:${(region.column-1)/BOARD_COLUMNS*100}%;--board-y:${(region.row-1)/BOARD_ROWS*100}%;--board-w:${region.width/BOARD_COLUMNS*100}%;--board-h:${region.height/BOARD_ROWS*100}%;--board-clip:${region.clip||'inset(0)'}`};
export const boardCellStyle=(id)=>{const {column,row}=parseCell(id);return`--cell-x:${(column-1)/BOARD_COLUMNS*100}%;--cell-y:${(row-1)/BOARD_ROWS*100}%;--cell-w:${100/BOARD_COLUMNS}%;--cell-h:${100/BOARD_ROWS}%`};
export const entranceMarkerStyle=({x,y,width,height})=>`--marker-x:${x/BOARD_COLUMNS*100}%;--marker-y:${y/BOARD_ROWS*100}%;--marker-w:${width/BOARD_COLUMNS*100}%;--marker-h:${height/BOARD_ROWS*100}%`;
export function parseCell(id){const match=/^([A-Z])(\d{1,2})$/.exec(id);if(!match)return{};return{column:match[1].charCodeAt(0)-64,row:Number(match[2])}}
export function cellId(column,row){return`${String.fromCharCode(64+column)}${row}`}
export function adjacentSites(id){const {column,row}=parseCell(id);if(!column)return[];return[[column,row-1],[column+1,row],[column,row+1],[column-1,row]].filter(([c,r])=>c>=1&&c<=BOARD_COLUMNS&&r>=1&&r<=BOARD_ROWS).map(([c,r])=>cellId(c,r)).filter(isWalkableSite)}
export function directionBetween(from,to){const a=parseCell(from),b=parseCell(to);if(!a.column||!b.column)return'';if(b.row<a.row)return'Up';if(b.row>a.row)return'Down';if(b.column<a.column)return'Left';if(b.column>a.column)return'Right';return''}
