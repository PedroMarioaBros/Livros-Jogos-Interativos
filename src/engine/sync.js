import { conditionMet } from "./story.js";

export function findSyncEntry(syncData, character, reference) {
  return (syncData?.entries || []).find(
    entry =>
      entry.character === character &&
      Number(entry.reference) === Number(reference)
  ) || null;
}

export function applySyncEffects(shared, entry, options = {}) {
  const next = { ...shared };

  if (!entry) return next;
  if (options.ignoreMutations) return next;

  for (const effect of entry.effects || []) {
    const conditions = effect.conditions || [];
    const matches =
      conditions.length === 0 ||
      conditions.every(condition =>
        conditionMet(condition, {
          character: options.character,
          partnerCharacter: options.partnerCharacter,
          shared: next,
          partnerActive: options.partnerActive
        })
      );

    if (!matches) continue;

    if (effect.type === "set_shared") {
      next[effect.key] = effect.value;
    }
  }

  return next;
}

export function resolveSyncTarget(entry, shared) {
  if (!entry || !Array.isArray(entry.routes) || entry.routes.length === 0) {
    return null;
  }

  for (const route of entry.routes) {
    if (Array.isArray(route.status) && route.status.includes(shared.status)) {
      return route.target;
    }

    if (Array.isArray(route.acao) && route.acao.includes(shared.acao)) {
      return route.target;
    }
  }

  return null;
}

export function processSyncPoint(syncData, state, options = {}) {
  const entry = findSyncEntry(syncData, state.character, state.reference);

  if (!entry) {
    return {
      entry: null,
      shared: { ...state.shared },
      target: null,
      waitingFor: null
    };
  }

  const shared = applySyncEffects(state.shared, entry, {
    ignoreMutations: Boolean(options.ignoreMutations),
    character: options.character,
    partnerCharacter: options.partnerCharacter,
    partnerActive: options.partnerActive
  });

  return {
    entry,
    shared,
    target: resolveSyncTarget(entry, shared),
    waitingFor: entry.waitFor || null
  };
}
