import type { Player, PlayerColor, TokenState, AIDifficulty, GameState, GameLogEntry } from '../types/game';

// Board constants
export const TOTAL_TRACK_TILES = 52;
export const HOME_STRETCH_LENGTH = 5;
export const HOME_STEP = 56; // 0..50 common track (51 steps), 51..55 home runway, 56 Home

// Start offset tile indices on the 52-tile common perimeter track
export const START_OFFSETS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// 8 Safe tiles on the common track (cannot be captured here)
export const SAFE_TILES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

// Convert a token's color and step into global common board tile index, or null if in base/home runway
export function getGlobalTrackIndex(color: PlayerColor, step: number): number | null {
  if (step < 0 || step > 50) return null;
  return (START_OFFSETS[color] + step) % TOTAL_TRACK_TILES;
}

// Check if a token can move with the current dice value
export function canTokenMove(token: TokenState, diceValue: number): boolean {
  if (token.step === HOME_STEP) return false; // already in home
  if (token.step === -1) {
    // In base: only a 6 can release it
    return diceValue === 6;
  }
  // On track or home runway
  return token.step + diceValue <= HOME_STEP;
}

// Get all movable token indices for a player with the given roll
export function getValidMoves(tokens: TokenState[], diceValue: number): number[] {
  const valid: number[] = [];
  tokens.forEach((token, index) => {
    if (canTokenMove(token, diceValue)) {
      valid.push(index);
    }
  });
  return valid;
}

// Calculate the next active player index (skipping players who have finished all 4 tokens)
export function getNextPlayerIndex(players: Player[], currentIndex: number): number {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const candidateIdx = (currentIndex + i) % total;
    const p = players[candidateIdx];
    if (!p.hasFinished) {
      return candidateIdx;
    }
  }
  return currentIndex; // everyone finished
}

export interface MoveResult {
  updatedPlayers: Player[];
  capturedOpponent: { color: PlayerColor; tokenId: number } | null;
  reachedHome: boolean;
  bonusTurn: boolean;
  forfeited: boolean;
  logText: string;
}

// Execute a move for a player's token
export function executeMove(
  players: Player[],
  playerIndex: number,
  tokenId: number,
  diceValue: number
): MoveResult {
  const newPlayers = JSON.parse(JSON.stringify(players)) as Player[];
  const player = newPlayers[playerIndex];
  const token = player.tokens[tokenId];

  let capturedOpponent: { color: PlayerColor; tokenId: number } | null = null;
  let reachedHome = false;
  let bonusTurn = false;
  let logText = '';

  if (token.step === -1 && diceValue === 6) {
    // Release from base onto start tile (step 0)
    token.step = 0;
    logText = `${player.name} moved a token out of the yard!`;
    bonusTurn = true; // Rolling 6 gives another turn
  } else {
    token.step += diceValue;
    if (token.step === HOME_STEP) {
      reachedHome = true;
      bonusTurn = true; // Landing home awards bonus roll!
      logText = `${player.name}'s token reached HOME! 🎯 (Bonus turn awarded)`;
    } else {
      logText = `${player.name} moved token ${diceValue} steps.`;
      if (diceValue === 6) {
        bonusTurn = true; // Rolled 6
      }
    }
  }

  // Check for capturing an opponent
  if (token.step >= 0 && token.step <= 50) {
    const landingGlobal = getGlobalTrackIndex(player.color, token.step);
    if (landingGlobal !== null && !SAFE_TILES.has(landingGlobal)) {
      // Check other players' tokens on this tile
      for (let pIdx = 0; pIdx < newPlayers.length; pIdx++) {
        if (pIdx === playerIndex) continue;
        const opponent = newPlayers[pIdx];
        for (const oppToken of opponent.tokens) {
          if (oppToken.step >= 0 && oppToken.step <= 50) {
            const oppGlobal = getGlobalTrackIndex(opponent.color, oppToken.step);
            if (oppGlobal === landingGlobal) {
              // Captured!
              oppToken.step = -1; // Send back to base
              capturedOpponent = { color: opponent.color, tokenId: oppToken.id };
              bonusTurn = true; // Capturing awards bonus turn!
              logText = `💥 ${player.name} knocked out ${opponent.name}'s token! (Bonus turn awarded)`;
              break;
            }
          }
        }
        if (capturedOpponent) break;
      }
    }
  }

  // Check if this player has finished all 4 tokens
  const allHome = player.tokens.every((t) => t.step === HOME_STEP);
  if (allHome && !player.hasFinished) {
    player.hasFinished = true;
    const currentFinishedCount = newPlayers.filter((p) => p.hasFinished).length;
    player.finishRank = currentFinishedCount;
    logText = `🏆 ${player.name} has finished all 4 tokens! (Rank: ${currentFinishedCount})`;
  }

  return {
    updatedPlayers: newPlayers,
    capturedOpponent,
    reachedHome,
    bonusTurn,
    forfeited: false,
    logText,
  };
}

// AI Move Selector
export function selectAIMove(
  players: Player[],
  aiPlayerIndex: number,
  validTokenIndices: number[],
  diceValue: number,
  difficulty: AIDifficulty = 'medium'
): number {
  if (validTokenIndices.length === 0) return -1;
  if (validTokenIndices.length === 1) return validTokenIndices[0];

  const aiPlayer = players[aiPlayerIndex];

  // Easy: random move
  if (difficulty === 'easy') {
    const rand = Math.floor(Math.random() * validTokenIndices.length);
    return validTokenIndices[rand];
  }

  // Medium / Hard: smart evaluation
  let bestScore = -9999;
  let bestTokenId = validTokenIndices[0];

  for (const tokenId of validTokenIndices) {
    const token = aiPlayer.tokens[tokenId];
    let score = 0;

    // Moving out of base
    if (token.step === -1 && diceValue === 6) {
      score += 60;
    }

    const nextStep = token.step + diceValue;

    // Reaching home
    if (nextStep === HOME_STEP) {
      score += 150;
    } else if (nextStep > 50) {
      // Safely advancing inside home runway
      score += 40 + nextStep;
    } else {
      const nextGlobal = getGlobalTrackIndex(aiPlayer.color, nextStep);

      if (nextGlobal !== null) {
        // Safe spot
        if (SAFE_TILES.has(nextGlobal)) {
          score += 45;
        }

        // Check capture potential
        for (let pIdx = 0; pIdx < players.length; pIdx++) {
          if (pIdx === aiPlayerIndex) continue;
          const opp = players[pIdx];
          for (const oppToken of opp.tokens) {
            if (oppToken.step >= 0 && oppToken.step <= 50) {
              const oppGlobal = getGlobalTrackIndex(opp.color, oppToken.step);
              if (oppGlobal === nextGlobal && !SAFE_TILES.has(nextGlobal)) {
                score += 120; // High priority: capture!
              }
            }
          }
        }

        // In Hard mode: avoid landing right in front of an opponent (danger zone within 1-6 steps)
        if (difficulty === 'hard' && !SAFE_TILES.has(nextGlobal)) {
          for (let pIdx = 0; pIdx < players.length; pIdx++) {
            if (pIdx === aiPlayerIndex) continue;
            const opp = players[pIdx];
            for (const oppToken of opp.tokens) {
              if (oppToken.step >= 0 && oppToken.step <= 50) {
                const oppGlobal = getGlobalTrackIndex(opp.color, oppToken.step);
                if (oppGlobal !== null) {
                  const dist = (nextGlobal - oppGlobal + TOTAL_TRACK_TILES) % TOTAL_TRACK_TILES;
                  if (dist >= 1 && dist <= 6) {
                    score -= 30; // Danger of being captured next turn
                  }
                }
              }
            }
          }
        }
      }

      // General preference to advance tokens
      score += nextStep * 0.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestTokenId = tokenId;
    }
  }

  return bestTokenId;
}

// Generate unique short room code (6 uppercase letters/digits)
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Initial board tokens
export function createInitialTokens(): TokenState[] {
  return [
    { id: 0, step: -1 },
    { id: 1, step: -1 },
    { id: 2, step: -1 },
    { id: 3, step: -1 },
  ];
}
