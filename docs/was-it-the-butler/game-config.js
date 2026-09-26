export const NS='https://w3id.org/ontoeagle/games/was-it-the-butler/';
export const GAME_ID='https://w3id.org/ontoeagle/games/was-it-the-butler';
export const VERSION='0.1.0';
export const SUSPECTS=[
  ['eggshell','Mrs. Eggshell','white','person-mrs-eggshell.png'],['marinara','Lt. Marinara','red','person-lt-marinara.png'],['peach','Ms. Peach','orange','person-ms-peach.png'],
  ['mint','Mrs. Mint','green','person-mrs-mint.png'],['mulberry','Prof. Mulberry','purple','person-professor-mulberry.png'],['brown','Mr. Brown','brown','person-mr-brown.png']
].map(([id,label,color,image])=>({id,label,color,category:'suspect',image}));
export const WEAPONS=[['shovel','Shovel','weapon-shovel.png'],['bat','Baseball Bat','weapon-baseball-bat.png'],['pistol','Pistol','weapon-pistol.png'],['rope','Rope','weapon-rope.png'],['knife','Knife','weapon-knife.png'],['guitar','Guitar','weapon-guitar-01.png']].map(([id,label,image])=>({id,label,category:'weapon',image}));
export const ROOMS=[['hall','Hall','room-hallway.png'],['living-room','Living Room','room-livingroom.png'],['dining-room','Dining Room','room-diningroom.png'],['kitchen','Kitchen','room-kitchen.png'],['library','Library','room-library.png'],['game-room','Game Room','room-gameroom.png'],['screened-porch','Screened-in Porch','room-screened-in-porch.png'],['greenhouse','Greenhouse','room-greenhouse.png'],['pool-room','Pool Room','room-pool-room.png']].map(([id,label,image])=>({id,label,category:'room',image}));
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
export const cardImageUrl=(card)=>new URL(`./assets/art/${card.image}`,import.meta.url).href;
