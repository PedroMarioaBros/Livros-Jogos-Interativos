export const SAVE_VERSION = 1;

export function createSaveSnapshot(state) {
  if (!state?.hero || !state.character || !state.mode) {
    throw new Error("Não há partida ativa para salvar.");
  }

  return {
    version: SAVE_VERSION,
    gameId: state.config?.id || null,
    mode: state.mode,
    character: state.character,
    hero: JSON.parse(JSON.stringify(state.hero)),
    shared: { ...state.shared },
    reference: Number(state.ref),
    partnerActive: Boolean(state.partnerActive),
    completedEncounters: Array.from(state.completedEncounters || []),
    encounter: state.encounter
      ? JSON.parse(JSON.stringify(state.encounter))
      : null,
    history: Array.isArray(state.history)
      ? JSON.parse(JSON.stringify(state.history))
      : [],
    duo: state.duo
      ? JSON.parse(JSON.stringify(state.duo))
      : null
  };
}

export function serializeSave(state) {
  return JSON.stringify(createSaveSnapshot(state));
}

export function parseSave(serialized) {
  const snapshot = JSON.parse(serialized);

  if (!snapshot || snapshot.version !== SAVE_VERSION) {
    throw new Error("Versão de salvamento incompatível.");
  }

  if (
    !snapshot.character ||
    !snapshot.mode ||
    !snapshot.hero ||
    !Number.isInteger(snapshot.reference)
  ) {
    throw new Error("Salvamento inválido ou incompleto.");
  }

  return snapshot;
}
