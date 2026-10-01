function removeOneItem(character, item) {
  const index = character.items.indexOf(item);
  if (index >= 0) character.items.splice(index, 1);
}

function livingEnemyIndexes(encounter) {
  return (encounter?.enemies || [])
    .map((enemy, index) => enemy.energia > 0 ? index : -1)
    .filter(index => index >= 0);
}

export function useInstantKillItem(
  character,
  encounter,
  item,
  options = {}
) {
  if (!character?.items?.includes(item)) {
    return { ok: false, reason: "missing-item" };
  }

  if (!encounter || encounter.finished) {
    return { ok: false, reason: "no-active-combat" };
  }

  const living = livingEnemyIndexes(encounter);
  if (!living.length) {
    return { ok: false, reason: "no-living-enemy" };
  }

  let enemyIndex = Number(options.enemyIndex);

  if (!Number.isInteger(enemyIndex) || !living.includes(enemyIndex)) {
    if (
      Number.isInteger(encounter.currentEnemyIndex) &&
      living.includes(encounter.currentEnemyIndex)
    ) {
      enemyIndex = encounter.currentEnemyIndex;
    } else {
      enemyIndex = living[0];
    }
  }

  const enemy = encounter.enemies[enemyIndex];
  const energyBefore = enemy.energia;
  enemy.energia = 0;
  removeOneItem(character, item);

  if (Number.isInteger(encounter.currentEnemyIndex)) {
    while (
      encounter.currentEnemyIndex < encounter.enemies.length &&
      encounter.enemies[encounter.currentEnemyIndex].energia <= 0
    ) {
      encounter.currentEnemyIndex += 1;
    }

    const finished =
      encounter.enemies.every(entry => entry.energia <= 0);
    if (finished) {
      encounter.finished = true;
      encounter.victory = true;
      encounter.defeat = false;
    }
  } else {
    const finished =
      encounter.enemies.every(entry => entry.energia <= 0);
    if (finished) {
      encounter.finished = true;
      encounter.winner = "heroes";
    }
  }

  return {
    ok: true,
    item,
    enemyIndex,
    enemyName: enemy.name,
    energyBefore,
    energyAfter: enemy.energia,
    finished: Boolean(encounter.finished),
    victory:
      encounter.victory === true ||
      encounter.winner === "heroes"
  };
}
