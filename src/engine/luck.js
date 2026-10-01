import { rollDice } from "./dice.js";

export function testLuck(character, rng = Math.random) {
  if (!character?.stats || !("sorte" in character.stats)) {
    throw new Error("O personagem não possui o atributo SORTE.");
  }

  const luckBefore = character.stats.sorte;
  const dice = rollDice(2, 6, rng);
  const success = dice.total <= luckBefore;

  character.stats.sorte = Math.max(0, luckBefore - 1);

  return {
    success,
    total: dice.total,
    rolls: dice.rolls,
    luckBefore,
    luckAfter: character.stats.sorte
  };
}
