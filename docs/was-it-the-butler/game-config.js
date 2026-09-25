export const NS='https://w3id.org/ontoeagle/games/was-it-the-butler/';
export const GAME_ID='https://w3id.org/ontoeagle/games/was-it-the-butler';
export const VERSION='0.1.0';
export const SUSPECTS=[
  ['eggshell','Mrs. Eggshell','white',0],['marinara','Lt. Marinara','red',1],['peach','Ms. Peach','orange',2],
  ['mint','Mrs. Mint','green',3],['mulberry','Prof. Mulberry','purple',4],['brown','Mr. Brown','brown',5]
].map(([id,label,color,atlas])=>({id,label,color,category:'suspect',atlas}));
export const WEAPONS=[['shovel','Shovel'],['bat','Baseball Bat'],['pistol','Pistol'],['rope','Rope'],['knife','Knife'],['guitar','Guitar']].map(([id,label],index)=>({id,label,category:'weapon',atlas:index+6}));
export const ROOMS=[['hall','Hall'],['living-room','Living Room'],['dining-room','Dining Room'],['kitchen','Kitchen'],['library','Library'],['game-room','Game Room'],['screened-porch','Screened-in Porch'],['greenhouse','Greenhouse'],['pool-room','Pool Room']].map(([id,label],index)=>({id,label,category:'room',atlas:index+12}));
export const CARDS=[...SUSPECTS,...WEAPONS,...ROOMS];
export const ROOM_GRID=[['screened-porch','living-room','dining-room'],['kitchen','hall','library'],['game-room','greenhouse','pool-room']];
export const ADJACENCY=Object.freeze({
  'screened-porch':['living-room','kitchen'], 'living-room':['screened-porch','dining-room','hall'], 'dining-room':['living-room','library'],
  kitchen:['screened-porch','hall'], hall:['living-room','kitchen','library','greenhouse'], library:['dining-room','hall'],
  'game-room':['greenhouse'], greenhouse:['game-room','hall','pool-room'], 'pool-room':['greenhouse']
});
export const SECRET_PASSAGES=Object.freeze({'screened-porch':'pool-room','pool-room':'screened-porch',kitchen:'library',library:'kitchen'});
export const START_ROOMS=['hall','living-room','dining-room','kitchen','library','greenhouse'];
export const cardById=(id)=>CARDS.find(card=>card.id===id);
export const roomById=(id)=>ROOMS.find(room=>room.id===id);
