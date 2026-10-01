export const DUO_CHARACTERS = ["colthar", "lothar"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDuoSession(players, startingCharacter = "colthar") {
  for (const id of DUO_CHARACTERS) {
    if (!players?.[id]?.hero) {
      throw new Error(`Jogador ausente na sessão em dupla: ${id}`);
    }
  }

  if (!DUO_CHARACTERS.includes(startingCharacter)) {
    throw new Error("Personagem inicial inválido.");
  }

  return {
    activeCharacter: startingCharacter,
    handoffPending: false,
    players: {
      colthar: {
        hero: clone(players.colthar.hero),
        reference: Number(players.colthar.reference || 1),
        history: clone(players.colthar.history || []),
        encounter: players.colthar.encounter
          ? clone(players.colthar.encounter)
          : null,
        completedEncounters: [
          ...(players.colthar.completedEncounters || [])
        ],
        removed: Boolean(players.colthar.removed)
      },
      lothar: {
        hero: clone(players.lothar.hero),
        reference: Number(players.lothar.reference || 1),
        history: clone(players.lothar.history || []),
        encounter: players.lothar.encounter
          ? clone(players.lothar.encounter)
          : null,
        completedEncounters: [
          ...(players.lothar.completedEncounters || [])
        ],
        removed: Boolean(players.lothar.removed)
      }
    }
  };
}

export function getActiveDuoPlayer(session) {
  return session.players[session.activeCharacter];
}

export function getOtherDuoCharacter(session) {
  return session.activeCharacter === "colthar" ? "lothar" : "colthar";
}

export function beginHandoff(session) {
  if (!session) throw new Error("Sessão em dupla inexistente.");

  const targetCharacter = getOtherDuoCharacter(session);
  if (session.players[targetCharacter].removed) {
    return {
      ok: false,
      reason: "partner-removed",
      targetCharacter
    };
  }

  session.handoffPending = true;
  return {
    ok: true,
    targetCharacter
  };
}

export function completeHandoff(session) {
  if (!session?.handoffPending) {
    return {
      ok: false,
      reason: "handoff-not-pending",
      activeCharacter: session?.activeCharacter || null
    };
  }

  const targetCharacter = getOtherDuoCharacter(session);
  session.activeCharacter = targetCharacter;
  session.handoffPending = false;

  return {
    ok: true,
    activeCharacter: session.activeCharacter,
    player: getActiveDuoPlayer(session)
  };
}

export function updateDuoPlayer(session, character, patch) {
  const player = session?.players?.[character];
  if (!player) throw new Error("Jogador inválido.");

  if ("hero" in patch) player.hero = clone(patch.hero);
  if ("reference" in patch) player.reference = Number(patch.reference);
  if ("history" in patch) player.history = clone(patch.history || []);
  if ("encounter" in patch) {
    player.encounter = patch.encounter ? clone(patch.encounter) : null;
  }
  if ("completedEncounters" in patch) {
    player.completedEncounters = Array.from(patch.completedEncounters || []);
  }
  if ("removed" in patch) player.removed = Boolean(patch.removed);

  return player;
}

export function markDuoPlayerRemoved(session, character) {
  const player = session?.players?.[character];
  if (!player) throw new Error("Jogador inválido.");

  player.removed = true;
  session.handoffPending = false;

  if (session.activeCharacter === character) {
    const other = character === "colthar" ? "lothar" : "colthar";
    if (!session.players[other].removed) {
      session.activeCharacter = other;
    }
  }

  return {
    activeCharacter: session.activeCharacter,
    bothRemoved:
      session.players.colthar.removed &&
      session.players.lothar.removed
  };
}

export function serializeDuoSession(session) {
  return clone(session);
}

export function restoreDuoSession(snapshot) {
  if (
    !snapshot ||
    !DUO_CHARACTERS.includes(snapshot.activeCharacter) ||
    !snapshot.players?.colthar?.hero ||
    !snapshot.players?.lothar?.hero
  ) {
    throw new Error("Sessão em dupla inválida.");
  }

  return createDuoSession(
    {
      colthar: snapshot.players.colthar,
      lothar: snapshot.players.lothar
    },
    snapshot.activeCharacter
  );
}
