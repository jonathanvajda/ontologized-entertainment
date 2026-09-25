# Was It the Butler? — Game Rules

**Rules status:** Initial implementation draft  
**Players:** 3–6  
**Mode:** Pass-and-play or local multi-device  
**Objective:** Identify the concealed suspect, weapon, and room.

## 1. The mystery

A crime has been committed somewhere on the estate. One suspect, one weapon, and one room are sealed as the solution. The remaining cards are dealt among the detectives.

Win by making the first correct accusation naming all three solution cards.

## 2. Contents

### Suspects

- Mrs. Eggshell — white
- Lt. Marinara — red
- Ms. Peach — orange
- Mrs. Mint — green
- Prof. Mulberry — purple
- Mr. Brown — brown

### Weapons

- Shovel
- Baseball bat
- Pistol
- Rope
- Knife
- Guitar

### Rooms

- Hall
- Living Room
- Dining Room
- Kitchen
- Library
- Game Room
- Screened-in Porch
- Greenhouse
- Pool Room

The deck contains 21 unique cards: six suspects, six weapons, and nine rooms. The board contains the nine rooms, connecting passages, six starting spaces, and any secret passages shown on the board.

## 3. Choose how to play

### Pass-and-play

Use one device for the board and every private hand. Before private information appears, the screen names the intended player. That player confirms, reviews their cards or notebook, and conceals the screen before passing it on.

This prevents accidental viewing during ordinary play, but everyone’s information still exists on the same device.

### Local multi-device

Use one host device for setup, the board, turns, dice, suggestions, and accusations. Each player opens the player page on a personal device and imports their private invitation by QR code, link, copy/paste token, or file.

The player page contains that player’s starting hand and private detective notebook. It does not automatically receive later board changes; players follow the host screen and update their notebooks themselves.

The short table code identifies the game but does not download private information. Keep the complete invitation private—it is the key to that player’s hand.

## 4. Setup

1. Choose pass-and-play or local multi-device.
2. Enter three to six player names and assign each player an available suspect token.
3. The game randomly selects one suspect, one weapon, and one room for the sealed solution.
4. The remaining 18 cards are shuffled and dealt one at a time. Some players may receive one more card than others.
5. In pass-and-play, each player privately reviews their hand in turn.
6. In multi-device play, the host presents a separate invitation to each player. Each player imports only their own invitation.
7. Place every suspect token on its marked starting space, including tokens not assigned to a player.
8. The host selects the first player. Play then proceeds clockwise.

The host publishes a cryptographic commitment to the sealed solution during setup. When the game ends, the revealed solution can be checked against that original commitment.

## 5. Turn cycle

```mermaid
flowchart TD
  A[Turn begins] --> B{Make an accusation now?}
  B -- Yes --> H[Submit suspect, weapon, and room]
  B -- No --> C[Roll two dice]
  C --> D[Move through passages]
  D --> E{Entered a room?}
  E -- No --> G[End turn]
  E -- Yes --> F[Make one suggestion]
  F --> I[Move named suspect and weapon into room]
  I --> J[Ask players clockwise for a refutation]
  J --> K{A player can refute?}
  K -- Yes --> L[Privately show one matching card]
  K -- No --> G
  L --> G
  H --> M{Accusation correct?}
  M -- Yes --> N[Reveal and verify solution; accuser wins]
  M -- No --> O[Accuser may no longer move, suggest, or accuse]
  O --> G
  G --> P[Next eligible player's turn]
```

## 6. Roll and move

Roll two six-sided dice on the host or shared page. Move up to the rolled total through connected passage spaces.

- Movement is orthogonal unless the board explicitly shows another connection.
- You may not enter the same passage space twice during one move.
- You may not pass through or finish on a passage occupied by another active token.
- Entering a room ends movement immediately.
- Exact count is not required to enter a room.
- A player who begins a turn in a room may leave through a doorway, use a shown secret passage instead of rolling, or remain to make a suggestion and end the turn.

Room interiors do not use movement squares. Multiple suspect and weapon tokens may occupy one room.

## 7. Suggestions

After entering or beginning the turn in a room, you may make one suggestion consisting of:

- any suspect;
- any weapon; and
- the room your token currently occupies.

Move the named suspect token and weapon token into that room. The moved suspect remains there until moved normally or named by another suggestion.

Beginning with the next player clockwise, each player checks whether their hand contains at least one suggested card.

- A player with no matching card declares that they cannot refute, and the request passes clockwise.
- The first player with one or more matching cards must privately show exactly one of their choice to the suggester.
- Refutation stops after one card is shown.
- Nobody else may see which card was shown.

In pass-and-play, use the private reveal screen. In multi-device play, the refuting player selects the card on their own device and physically shows that device only to the suggester. The suggester records the information in their notebook.

## 8. Detective notebook

Your notebook is private. It may track:

- cards in your hand;
- cards shown to you;
- deductions about other players;
- freeform notes.

Notebook marks are aids, not authoritative game state. The game does not make deductions or correct mistaken notes.

## 9. Accusations

At the beginning of your turn, before rolling, you may make one accusation naming any suspect, weapon, and room. Your token does not need to be in the accused room.

The host compares the accusation with the sealed solution without first displaying the solution.

- If all three cards match, the solution is revealed, its setup commitment is verified, and the accuser wins.
- If any card differs, the accusation fails. The accuser is eliminated from taking turns, moving, suggesting, and accusing.
- An eliminated player keeps their cards and must continue refuting suggestions when able.

If every player but one is eliminated, the remaining eligible player does not automatically win; they must still make a correct accusation. If every player becomes eliminated, reveal and verify the solution and record that the mystery defeated the table.

## 10. Information and fairness

- Do not inspect another player’s device, invitation, or saved data.
- Keep private invitations and exported player files secret.
- The host device contains the full solution and every hand; the host operator is trusted not to inspect developer tools or storage.
- Pass-and-play concealment is a social privacy aid, not protection against deliberate device inspection.
- A player invitation cannot be revoked after it has been copied in the zero-server version.

## 11. Saving

The host may save the complete game locally. Player devices save only their own hand, notebook, and public game identification. Restoring the host does not automatically update player devices; starting hands remain valid because cards do not transfer during play.
