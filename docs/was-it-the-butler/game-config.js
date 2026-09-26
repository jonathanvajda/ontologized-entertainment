export const NS='https://w3id.org/ontoeagle/games/was-it-the-butler/';
export const GAME_ID='https://w3id.org/ontoeagle/games/was-it-the-butler';
export const VERSION='0.1.0';
export const SUSPECTS=[
  ['eggshell','Mrs. Eggshell','white','person-mrs-eggshell.png'],['marinara','Lt. Marinara','red','person-lt-marinara.png'],['peach','Ms. Peach','orange','person-ms-peach.png'],
  ['mint','Mrs. Mint','green','person-mrs-mint-02.png'],['mulberry','Prof. Mulberry','purple','person-professor-mulberry.png'],['brown','Mr. Brown','brown','person-mr-brown-02.png']
].map(([id,label,color,image])=>({id,label,color,category:'suspect',image}));
export const WEAPONS=[['shovel','Shovel','weapon-shovel.png'],['bat','Baseball Bat','weapon-baseball-bat.png'],['pistol','Pistol','weapon-pistol.png'],['rope','Rope','weapon-rope.png'],['knife','Knife','weapon-knife.png'],['guitar','Electric Guitar','weapon-guitar-02.png']].map(([id,label,image])=>({id,label,category:'weapon',image}));
export const ROOMS=[['ballroom','Ballroom','room-ballroom-02.png'],['living-room','Living Room','room-livingroom.png'],['dining-room','Dining Room','room-diningroom.png'],['kitchen','Kitchen','room-kitchen.png'],['library','Library','room-library.png'],['game-room','Game Room','room-gameroom-03.png'],['screened-porch','Screened-in Porch','room-screened-in-porch.png'],['greenhouse','Greenhouse','room-greenhouse.png'],['pool-room','Pool Room','room-pool-room.png']].map(([id,label,image])=>({id,label,category:'room',image}));
export const CARDS=[...SUSPECTS,...WEAPONS,...ROOMS];
export const ROOM_GRID=[['pool-room','screened-porch','greenhouse'],['library','game-room','ballroom','kitchen'],['living-room','dining-room']];
export const ADJACENCY=Object.freeze({
  foyer:['living-room','ballroom','dining-room'],
  'living-room':['foyer','library','game-room'], library:['living-room','game-room'],
  'game-room':['library','living-room','ballroom'], 'pool-room':['screened-porch'],
  'screened-porch':['pool-room','greenhouse','ballroom'], greenhouse:['screened-porch','kitchen'],
  kitchen:['greenhouse','ballroom','dining-room'], 'dining-room':['kitchen','ballroom','foyer'],
  ballroom:['game-room','screened-porch','kitchen','dining-room','foyer']
});
export const SECRET_PASSAGES=Object.freeze({kitchen:'library',library:'kitchen'});
export const START_LOCATION='foyer';
export const cardById=(id)=>CARDS.find(card=>card.id===id);
export const roomById=(id)=>ROOMS.find(room=>room.id===id);
export const cardImageUrl=(card)=>new URL(`./assets/art/${card.image}`,import.meta.url).href;
