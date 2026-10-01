import { createCharacter, consumeProvision } from "./engine/character.js";
import { testLuck } from "./engine/luck.js";
import { processSyncPoint } from "./engine/sync.js";
import { applyEffects as applyStoryEffects, availableChoices } from "./engine/story.js";
import { createEncounter, playEncounterRound, currentOpponent } from "./engine/encounter.js";
import {
  createCooperativeCombatState,
  cooperativeCombatStep
} from "./engine/combat.js";
import { serializeSave, parseSave } from "./engine/save.js";
import { applyCombatSpell } from "./engine/spell-combat.js";
import {
  createDuoSession,
  beginHandoff,
  completeHandoff,
  updateDuoPlayer,
  restoreDuoSession
} from "./engine/duo.js";

const state = {
  config: null,
  rules: null,
  spells: null,
  syncData: null,
  characterData: null,
  characterDataCache: {},
  hero: null,
  mode: null,
  character: null,
  shared: { status: 0, acao: 0 },
  ref: 1,
  partnerActive: false,
  encounter: null,
  completedEncounters: new Set(),
  history: [],
  duo: null,
  cooperativeEncounter: null
};

const SAVE_KEY = "livros-jogos-interativos:furia-de-principes";

const $ = (id) => document.getElementById(id);

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return response.json();
}

async function loadCharacterData(characterId) {
  if (state.characterDataCache[characterId]) {
    return state.characterDataCache[characterId];
  }

  const base = "jogos/furia-de-principes/";
  const config = state.config.characters.find(
    character => character.id === characterId
  );

  if (!config) throw new Error("Personagem desconhecido.");

  const data = await loadJSON(base + config.data);
  state.characterDataCache[characterId] = data;
  return data;
}

async function init() {
  const catalog = await loadJSON("jogos/catalogo.json");
  const game = catalog.games[0];
  state.config = await loadJSON(game.config);

  const base = "jogos/furia-de-principes/";
  [state.rules, state.spells, state.syncData] = await Promise.all([
    loadJSON(base + state.config.rules.base),
    loadJSON(base + state.config.rules.spells),
    loadJSON(base + state.config.sync)
  ]);

  $("game-title").textContent = state.config.title;
  $("game-status").textContent =
    `Motor modular carregado • ${state.spells.spells.length} feitiços catalogados`;

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.shared = state.mode === "solo"
        ? { ...state.rules.modes.solo.sharedFixed }
        : { ...state.rules.modes.dupla.sharedInitial };
      state.partnerActive = state.mode === "dupla";
      selectGroup("[data-mode]", button);
      updateShared();
    });
  });

  document.querySelectorAll("[data-character]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.character = button.dataset.character;
      state.characterData = await loadCharacterData(state.character);
      selectGroup("[data-character]", button);
    });
  });

  $("start").addEventListener("click", startGame);
  $("use-provision").addEventListener("click", useProvision);
  $("test-luck").addEventListener("click", runLuckTest);
  $("apply-sync").addEventListener("click", applyManualSync);
  $("combat-round").addEventListener("click", playCombatRound);
  $("combat-continue").addEventListener("click", continueAfterCombat);
  $("dev-go").addEventListener("click", jumpToReference);
  $("save-game").addEventListener("click", saveGame);
  $("load-game").addEventListener("click", loadGame);
  $("restart-game").addEventListener("click", restartGame);
  $("cast-spell").addEventListener("click", castSelectedSpell);
  $("spell-select").addEventListener("change", updateSpellCostUI);
  $("handoff-player").addEventListener("click", startPlayerHandoff);
  $("handoff-confirm").addEventListener("click", finishPlayerHandoff);
}

function selectGroup(selector, selected) {
  document.querySelectorAll(selector).forEach(b => b.classList.remove("selected"));
  selected.classList.add("selected");
}

function updateShared() {
  $("shared").textContent =
    `STATUS ${state.shared.status} • AÇÃO ${state.shared.acao}`;
}

function showGameMessage(message) {
  $("game-message").textContent = message;
}

async function startGame() {
  if (!state.mode || !state.character) {
    $("message").textContent =
      state.mode === "dupla"
        ? "Escolha quem ficará com o aparelho primeiro."
        : "Escolha o modo e o personagem antes de começar.";
    return;
  }

  if (state.mode === "dupla") {
    const [coltharData, lotharData] = await Promise.all([
      loadCharacterData("colthar"),
      loadCharacterData("lothar")
    ]);

    state.shared = { ...state.rules.modes.dupla.sharedInitial };
    state.duo = createDuoSession(
      {
        colthar: {
          hero: createCharacter(coltharData),
          reference: state.config.startReference
        },
        lothar: {
          hero: createCharacter(lotharData),
          reference: state.config.startReference
        }
      },
      state.character
    );

    await activateDuoCharacter(state.character, {
      render: false
    });
  } else {
    state.characterData = await loadCharacterData(state.character);
    state.hero = createCharacter(state.characterData);
    state.partnerActive = false;
    state.duo = null;
    state.ref = state.config.startReference;
    state.encounter = null;
    state.completedEncounters = new Set();
    state.history = [];
  }

  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  renderSheet();
  renderHistory();
  renderReference(state.ref);
}

function persistActiveDuoPlayer() {
  if (state.mode !== "dupla" || !state.duo || !state.character) return;

  updateDuoPlayer(state.duo, state.character, {
    hero: state.hero,
    reference: state.ref,
    history: state.history,
    encounter: state.encounter,
    completedEncounters: state.completedEncounters
  });
}

function updatePartnerState() {
  if (state.mode !== "dupla" || !state.duo) {
    state.partnerActive = false;
    return;
  }

  const other = state.character === "colthar" ? "lothar" : "colthar";
  state.partnerActive = !state.duo.players[other].removed;
}

async function activateDuoCharacter(characterId, options = {}) {
  if (!state.duo) throw new Error("Sessão em dupla inexistente.");

  const player = state.duo.players[characterId];
  if (!player) throw new Error("Jogador inexistente.");

  state.character = characterId;
  state.characterData = await loadCharacterData(characterId);
  state.hero = player.hero;
  state.ref = Number(player.reference);
  state.history = [...(player.history || [])];
  state.encounter = player.encounter || null;
  state.completedEncounters = new Set(player.completedEncounters || []);
  state.duo.activeCharacter = characterId;
  updatePartnerState();

  if (options.render !== false) {
    renderSheet();
    renderHistory();
    renderReference(state.ref, { applyEntryEffects: false });
  }
}

function renderDuoStatus() {
  const bar = $("duo-bar");
  if (!bar) return;

  if (state.mode !== "dupla" || !state.duo) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  const other = state.character === "colthar" ? "lothar" : "colthar";
  const otherName = other === "colthar" ? "Colthar" : "Lothar";
  const currentName = state.character === "colthar" ? "Colthar" : "Lothar";

  $("duo-current").textContent =
    `Jogador atual: ${currentName} • sua referência ${state.ref}`;
  const sharedCombatActive =
    state.cooperativeEncounter &&
    !state.cooperativeEncounter.finished;

  $("handoff-player").textContent = sharedCombatActive
    ? "⚔️ Combate compartilhado em andamento"
    : state.duo.players[other].removed
      ? `${otherName} está fora da aventura`
      : `🔒 Entregar aparelho para ${otherName}`;

  $("handoff-player").disabled =
    sharedCombatActive ||
    state.duo.players[other].removed;
}

function startPlayerHandoff() {
  if (state.mode !== "dupla" || !state.duo) return;

  if (
    state.cooperativeEncounter &&
    !state.cooperativeEncounter.finished
  ) {
    showGameMessage(
      "O aparelho permanece compartilhado até este combate cooperativo terminar."
    );
    return;
  }

  persistActiveDuoPlayer();
  const result = beginHandoff(state.duo);

  if (!result.ok) {
    showGameMessage("O outro príncipe já está fora da aventura.");
    return;
  }

  const targetName =
    result.targetCharacter === "colthar" ? "Colthar" : "Lothar";

  $("handoff-target").textContent = targetName;
  $("handoff-confirm").textContent =
    `Sou ${targetName} — abrir minha aventura`;
  $("handoff-overlay").classList.remove("hidden");
}

async function finishPlayerHandoff() {
  if (!state.duo) return;

  const result = completeHandoff(state.duo);
  if (!result.ok) return;

  await activateDuoCharacter(result.activeCharacter, {
    render: false
  });

  $("handoff-overlay").classList.add("hidden");
  renderSheet();
  renderHistory();
  renderReference(state.ref, { applyEntryEffects: false });
}

function renderSheet() {
  const hero = state.hero;

  $("stats").innerHTML = Object.entries(hero.stats)
    .map(([key, value]) =>
      `<div class="stat"><div class="muted">${key.toUpperCase()}</div><strong>${value}</strong><div class="muted">máx. ${hero.initialStats[key]}</div></div>`
    )
    .join("");

  $("resources").textContent =
    `Provisões: ${hero.provisions} • Ouro: ${hero.gold}`;

  $("inventory").textContent =
    hero.items.length ? `Itens: ${hero.items.join(", ")}` : "Itens: nenhum";

  updateShared();
  renderDuoStatus();
}

function navigateTo(target, label = "Avançar", options = {}) {
  const from = state.ref;
  const to = Number(target);

  if (Number.isInteger(from) && Number.isInteger(to) && from !== to) {
    state.history.push({
      from,
      to,
      label
    });
    renderHistory();
  }

  renderReference(to, options);
}

function renderHistory() {
  const box = $("history");
  if (!box) return;

  if (!state.history.length) {
    box.textContent = "Nenhuma decisão registrada ainda.";
    return;
  }

  box.innerHTML = state.history
    .slice(-8)
    .reverse()
    .map(entry =>
      `<div class="history-item"><strong>${entry.from} → ${entry.to}</strong> <span class="muted">${entry.label}</span></div>`
    )
    .join("");
}

function renderReference(reference, options = {}) {
  state.ref = Number(reference);
  renderDuoStatus();
  const node = state.characterData.references[String(state.ref)];

  $("reference").textContent = `Referência ${state.ref}`;
  showGameMessage("");
  $("sync-message").textContent = "";

  if (!node) {
    $("scene").textContent =
      "Esta referência ainda não foi extraída para o banco de dados.";
    $("choices").innerHTML = "";
    return;
  }

  const applyEntryEffects = options.applyEntryEffects !== false;
  if (applyEntryEffects) {
    const context = {
      shared: state.shared,
      partnerActive: state.partnerActive,
      ignoreSharedMutations:
        state.mode === "solo" &&
        state.rules.modes.solo.ignoreSharedMutations
    };

    const effectResults = applyStoryEffects(
      state.hero,
      node.effects || [],
      context
    );

    state.shared = context.shared;

    const randomDamage = effectResults.find(
      result => result.type === "random_stat_damage"
    );
    if (randomDamage) {
      showGameMessage(
        `Efeito da cena: ${randomDamage.roll.rolls.join(" + ")} = ${randomDamage.roll.total} de dano em ${randomDamage.stat.toUpperCase()}.`
      );
    }

    renderSheet();
  }

  const syncResult = processSyncPoint(
    state.syncData,
    {
      character: state.character,
      reference: state.ref,
      shared: state.shared
    },
    {
      ignoreMutations:
        state.mode === "solo" &&
        state.rules.modes.solo.ignoreSharedMutations
    }
  );

  state.shared = syncResult.shared;

  if (syncResult.entry) {
    if (syncResult.target) {
      $("sync-message").textContent =
        `Sincronização resolvida automaticamente → ${syncResult.target}`;

      if (syncResult.target !== state.ref) {
        updateShared();
        setTimeout(() => navigateTo(syncResult.target, "Sincronização", { applyEntryEffects: true }), 0);
        return;
      }
    } else if (syncResult.waitingFor) {
      $("sync-message").textContent =
        `Aguardando o outro jogador alterar ${syncResult.waitingFor.toUpperCase()}.`;
    }
  }

  $("scene").textContent = node.resumo || "Cena sem resumo.";
  $("choices").innerHTML = "";
  updateShared();

  if (node.encounter && !state.completedEncounters.has(state.ref)) {
    renderEncounter(node);
    return;
  }

  hideCombat();

  const context = {
    character: state.hero,
    shared: state.shared,
    partnerActive: state.partnerActive
  };
  const choices = availableChoices(node, context);

  for (const choice of choices) {
    const button = document.createElement("button");
    button.textContent = `${choice.label} → ${choice.target}`;
    button.addEventListener("click", () => {
      const effectContext = {
        shared: state.shared,
        partnerActive: state.partnerActive,
        ignoreSharedMutations:
          state.mode === "solo" &&
          state.rules.modes.solo.ignoreSharedMutations
      };
      applyStoryEffects(
        state.hero,
        choice.effects || [],
        effectContext
      );
      state.shared = effectContext.shared;
      renderSheet();
      navigateTo(choice.target, choice.label);
    });
    $("choices").appendChild(button);
  }

  if (node.test?.type === "luck") {
    const button = document.createElement("button");
    button.textContent = "🍀 Testar a Sorte";
    button.addEventListener("click", () => {
      const result = testLuck(state.hero);
      renderSheet();
      showGameMessage(
        `Teste de Sorte: ${result.rolls.join(" + ")} = ${result.total}. ` +
        (result.success ? "SUCESSO." : "AZAR.")
      );
      navigateTo(
        result.success ? node.test.successTarget : node.test.failureTarget,
        result.success ? "Teste de Sorte: sucesso" : "Teste de Sorte: azar"
      );
    });
    $("choices").appendChild(button);
  }

  if (node.ending) {
    if (
      state.mode === "dupla" &&
      state.duo &&
      node.ending === "death" &&
      !state.duo.players[state.character].removed
    ) {
      updateDuoPlayer(state.duo, state.character, {
        hero: state.hero,
        reference: state.ref,
        history: state.history,
        encounter: state.encounter,
        completedEncounters: state.completedEncounters,
        removed: true
      });
      updatePartnerState();
      renderDuoStatus();
    }

    const info = document.createElement("p");
    info.className = "muted";
    info.textContent =
      state.mode === "dupla" && state.partnerActive
        ? "Fim da aventura deste príncipe. O outro jogador pode continuar."
        : "Fim desta aventura.";
    $("choices").appendChild(info);
  } else if (
    choices.length === 0 &&
    !node.test &&
    !node.encounter &&
    !node.partnerInstruction
  ) {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = "Esse nó ainda aguarda extração/validação.";
    $("choices").appendChild(info);
  }
}

function hideCombat() {
  $("combat-card").classList.add("hidden");
  $("combat-continue").classList.add("hidden");
  $("spell-panel").classList.add("hidden");
}

function renderEncounter(node) {
  $("combat-card").classList.remove("hidden");

  if (node.encounter.cooperative && state.mode === "dupla") {
    state.encounter = null;

    if (
      !state.cooperativeEncounter ||
      state.cooperativeEncounter.reference !== state.ref
    ) {
      const colthar = state.duo.players.colthar.hero;
      const lothar = state.duo.players.lothar.hero;

      state.cooperativeEncounter = createCooperativeCombatState(
        [colthar, lothar],
        node.encounter.enemies.map(enemy => ({
          name: enemy.name,
          habilidade: enemy.habilidade,
          energia: enemy.energia,
          initialEnergy: enemy.energia
        }))
      );
      state.cooperativeEncounter.reference = state.ref;
    }

    renderCooperativeEncounter(node);
    return;
  }

  state.cooperativeEncounter = null;

  if (!state.encounter || state.encounter.reference !== state.ref) {
    state.encounter = createEncounter(state.ref, node.encounter);
  }

  const enemy = currentOpponent(state.encounter);
  $("combat-title").textContent = enemy
    ? `⚔️ ${state.hero.name} x ${enemy.name}`
    : "Combate concluído";

  updateCombatOpponents();

  if (state.encounter.rounds.length === 0) {
    $("combat-log").textContent =
      "O combate está pronto. Cada toque em “Rolar rodada” executa uma série de ataque.";
  }

  renderSpellPanel(node);
  $("combat-round").classList.remove("hidden");
  $("combat-continue").classList.add("hidden");
}

function renderCooperativeEncounter(node) {
  $("combat-card").classList.remove("hidden");
  $("spell-panel").classList.add("hidden");
  $("combat-continue").classList.add("hidden");
  $("combat-round").classList.remove("hidden");
  $("combat-round").textContent = "🎲 Rolar rodada cooperativa";
  $("combat-title").textContent = "⚔️ Colthar + Lothar";

  updateCooperativeCombatDisplay();

  if (!state.cooperativeEncounter.log.length) {
    $("combat-log").textContent =
      "Os dois príncipes estão no mesmo confronto. Com vários inimigos, cada um enfrenta um adversário; contra um único inimigo, os ataques se alternam.";
  }

  renderDuoStatus();
}

function updateCooperativeCombatDisplay() {
  if (!state.cooperativeEncounter) return;

  const heroes = state.cooperativeEncounter.heroes;
  const enemies = state.cooperativeEncounter.enemies;

  const heroText = [
    `Colthar: ENERGIA ${heroes[0].stats.energia}/${heroes[0].initialStats.energia}`,
    `Lothar: ENERGIA ${heroes[1].stats.energia}/${heroes[1].initialStats.energia}`
  ].join(" | ");

  const enemyText = enemies
    .map(enemy =>
      `${enemy.name}: HABILIDADE ${enemy.habilidade} • ENERGIA ${enemy.energia}/${enemy.initialEnergy}`
    )
    .join(" | ");

  $("combat-opponents").textContent =
    `${heroText} || ${enemyText}`;
}

function markFallenDuoHeroes() {
  if (!state.duo || !state.cooperativeEncounter) return;

  const [colthar, lothar] = state.cooperativeEncounter.heroes;

  if (colthar.stats.energia <= 0) {
    updateDuoPlayer(state.duo, "colthar", {
      hero: colthar,
      removed: true
    });
  }

  if (lothar.stats.energia <= 0) {
    updateDuoPlayer(state.duo, "lothar", {
      hero: lothar,
      removed: true
    });
  }

  updatePartnerState();
}

function playCooperativeCombatRound() {
  if (
    !state.cooperativeEncounter ||
    state.cooperativeEncounter.finished
  ) {
    return;
  }

  const node = state.characterData.references[String(state.ref)];
  const result = cooperativeCombatStep(
    state.cooperativeEncounter
  );

  markFallenDuoHeroes();
  updateCooperativeCombatDisplay();

  if (result.events.length) {
    const descriptions = result.events.map(event => {
      const heroName =
        event.heroIndex === 0 ? "Colthar" : "Lothar";
      const enemy =
        state.cooperativeEncounter.enemies[event.enemyIndex];
      const round = event.result;

      if (round.outcome === "hero-hit") {
        return `${heroName} acerta ${enemy.name} e causa ${round.damage} de dano`;
      }

      if (round.outcome === "enemy-hit") {
        return `${enemy.name} acerta ${heroName} e causa ${round.damage} de dano`;
      }

      return `${heroName} e ${enemy.name} empatam`;
    });

    $("combat-log").textContent =
      `Série ${state.cooperativeEncounter.step}: ` +
      descriptions.join(" • ") + ".";
  }

  renderSheet();

  if (result.finished) {
    state.cooperativeEncounter.finished = true;
    $("combat-round").classList.add("hidden");

    if (result.winner === "heroes") {
      state.completedEncounters.add(state.ref);
      $("combat-title").textContent = "🏆 Vitória dos príncipes";

      applyStoryEffects(state.hero, node.rewards || [], {
        shared: state.shared,
        partnerActive: state.partnerActive
      });

      $("combat-continue").classList.remove("hidden");
      $("combat-continue").dataset.target =
        node.onVictory ?? "";
      $("combat-continue").textContent = node.onVictory
        ? `Continuar → ${node.onVictory}`
        : "Continuar";
    } else {
      $("combat-title").textContent = "☠️ Os dois príncipes foram derrotados";
      showGameMessage(
        "A ENERGIA dos dois personagens chegou a zero."
      );
    }
  }

  persistActiveDuoPlayer();
  renderDuoStatus();
}

function updateCombatOpponents() {
  if (!state.encounter) return;

  const shadow = state.encounter.proxy?.stats?.energia > 0
    ? ` | Sombra: HABILIDADE ${state.encounter.proxy.stats.habilidade} • ENERGIA ${state.encounter.proxy.stats.energia}/${state.encounter.proxy.initialStats.energia}`
    : "";

  $("combat-opponents").textContent =
    state.encounter.enemies
      .map(opponent => {
        const stateLabel = opponent.asleep ? " • ADORMECIDO" : "";
        return `${opponent.name}: HABILIDADE ${opponent.habilidade} • ENERGIA ${opponent.energia}/${opponent.initialEnergy}${stateLabel}`;
      })
      .join(" | ") + shadow;
}

function renderSpellPanel(node) {
  const panel = $("spell-panel");

  const canCast =
    state.character === "lothar" &&
    !node.encounter.noCombatMagic &&
    state.encounter &&
    state.encounter.rounds.length === 0 &&
    !state.encounter.combatSpellAttempted;

  if (!canCast) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");

  const select = $("spell-select");
  select.innerHTML = state.spells.spells
    .map(spell => {
      const cost = spell.cost === "variable" ? "variável" : spell.cost;
      return `<option value="${spell.id}">${spell.name} — custo ${cost}</option>`;
    })
    .join("");

  updateSpellCostUI();
  $("spell-result").textContent =
    "Lothar pode lançar um Feitiço de Combate antes da primeira série de ataque.";
}

function updateSpellCostUI() {
  const spell = state.spells?.spells?.find(
    item => item.id === $("spell-select").value
  );
  const variable = spell?.cost === "variable";
  $("spell-variable-wrap").classList.toggle("hidden", !variable);
}

function describeSpellResult(result) {
  if (!result.ok) {
    const reasons = {
      "combat-spell-already-attempted": "Um Feitiço de Combate já foi tentado neste encontro.",
      "invalid-variable-cost": "Informe um custo válido de MAGIA.",
      "recovery-cost-must-be-multiple-of-3": "Recuperação exige um múltiplo de 3 pontos de MAGIA.",
      "insufficient-magic": "MAGIA insuficiente."
    };
    return reasons[result.reason] || "Não foi possível lançar o feitiço.";
  }

  if (!result.success) {
    return `${result.spellName}: o dado marcou 6. O feitiço falhou, mas o custo de MAGIA foi gasto.`;
  }

  if (result.spellId === "recuperacao") {
    return `${result.spellName}: +${result.recoveredEnergy || 0} de ENERGIA.`;
  }

  if (result.spellId === "sono") {
    const sleeping = result.details.filter(detail => detail.asleep).length;
    return `${result.spellName}: ${sleeping} oponente(s) adormeceram.`;
  }

  if (result.spellId === "sombra") {
    return "Sombra: um guerreiro espiritual com HABILIDADE 7 e ENERGIA 4 lutará primeiro.";
  }

  if (result.spellId === "rajada-mortal" && result.details[0]?.roll) {
    return `${result.spellName}: ${result.details[0].roll.total} de dano mágico.`;
  }

  return `${result.spellName} foi lançado com sucesso.`;
}

function castSelectedSpell() {
  if (!state.encounter || state.character !== "lothar") return;

  const spell = state.spells.spells.find(
    item => item.id === $("spell-select").value
  );
  if (!spell) return;

  const magicSpend = Number($("spell-magic-spend").value);
  const result = applyCombatSpell(
    state.hero,
    state.encounter,
    spell,
    { magicSpend }
  );

  $("spell-result").textContent = describeSpellResult(result);
  renderSheet();
  updateCombatOpponents();

  if (result.ok) {
    $("spell-panel").classList.add("hidden");
  }

  if (result.encounterVictory) {
    const node = state.characterData.references[String(state.ref)];
    completeCombatVictory(node);
  }
}

function completeCombatVictory(node) {
  if (!state.completedEncounters.has(state.ref)) {
    state.completedEncounters.add(state.ref);
    applyStoryEffects(state.hero, node.rewards || [], {
      shared: state.shared,
      partnerActive: state.partnerActive
    });
    renderSheet();
  }

  $("combat-title").textContent = "🏆 Vitória";
  $("combat-round").classList.add("hidden");
  $("spell-panel").classList.add("hidden");
  $("combat-continue").classList.remove("hidden");
  $("combat-continue").dataset.target = node.onVictory ?? "";
  $("combat-continue").textContent = node.onVictory
    ? `Continuar → ${node.onVictory}`
    : "Continuar";
}

function playCombatRound() {
  if (
    state.cooperativeEncounter &&
    !state.cooperativeEncounter.finished
  ) {
    playCooperativeCombatRound();
    return;
  }

  if (!state.encounter || state.encounter.finished) return;

  const node = state.characterData.references[String(state.ref)];
  const result = playEncounterRound(state.encounter, state.hero);

  if (result.round) {
    const attacker = result.round.attackerName || state.hero.name;
    const labels = {
      "hero-hit": `${attacker} acertou e causou ${result.round.damage} de dano.`,
      "enemy-hit": result.round.damagePrevented
        ? `${result.round.enemyName} acertou, mas Estontear anulou o dano (dado ${result.round.incomingSaveRoll}).`
        : `${result.round.enemyName} acertou e causou ${result.round.damage} de dano.`,
      tie: "Empate: ninguém sofreu dano."
    };

    const shadowNote = result.round.proxyDefeated
      ? " A Sombra foi vencida; Lothar continuará o combate pessoalmente."
      : "";

    $("combat-log").textContent =
      `Rodada ${result.round.round}: ` +
      `${attacker} ${result.round.heroRolls.join("+")} + HABILIDADE = ${result.round.heroAttack}; ` +
      `${result.round.enemyName} ${result.round.enemyRolls.join("+")} + HABILIDADE = ${result.round.enemyAttack}. ` +
      labels[result.round.outcome] + shadowNote;
  }

  renderSheet();

  const enemy = currentOpponent(state.encounter);
  updateCombatOpponents();

  if (result.defeat) {
    $("combat-title").textContent = "☠️ Derrota";
    $("combat-round").classList.add("hidden");
    showGameMessage("Sua ENERGIA chegou a zero.");
    return;
  }

  if (result.victory) {
    completeCombatVictory(node);
    return;
  }

  if (enemy) {
    $("combat-title").textContent = `⚔️ ${state.hero.name} x ${enemy.name}`;
  }
}

function continueAfterCombat() {
  const target = Number($("combat-continue").dataset.target);
  state.encounter = null;

  if (state.cooperativeEncounter?.finished) {
    state.cooperativeEncounter = null;
  }

  hideCombat();
  $("combat-round").textContent = "🎲 Rolar rodada";

  if (Number.isInteger(target) && target > 0) {
    navigateTo(target, "Vitória no combate");
  } else {
    renderReference(state.ref, { applyEntryEffects: false });
  }
}

function jumpToReference() {
  if (!state.hero) return;

  const target = Number($("dev-ref").value);
  if (!Number.isInteger(target) || target < 1 || target > 500) {
    showGameMessage("Informe uma referência entre 1 e 500.");
    return;
  }

  state.encounter = null;
  state.cooperativeEncounter = null;
  renderReference(target);
}

function saveGame() {
  if (!state.hero) {
    showGameMessage("Não há partida ativa para salvar.");
    return;
  }

  persistActiveDuoPlayer();
  localStorage.setItem(SAVE_KEY, serializeSave(state));
  showGameMessage(`Partida salva na referência ${state.ref}.`);
}

async function loadGame() {
  const serialized = localStorage.getItem(SAVE_KEY);
  if (!serialized) {
    $("message").textContent = "Nenhuma partida salva neste aparelho.";
    return;
  }

  try {
    const snapshot = parseSave(serialized);
    state.mode = snapshot.mode;
    state.shared = snapshot.shared;
    state.cooperativeEncounter =
      snapshot.cooperativeEncounter || null;

    if (snapshot.mode === "dupla" && snapshot.duo) {
      await Promise.all([
        loadCharacterData("colthar"),
        loadCharacterData("lothar")
      ]);
      state.duo = restoreDuoSession(snapshot.duo);

      if (state.cooperativeEncounter) {
        state.cooperativeEncounter.heroes = [
          state.duo.players.colthar.hero,
          state.duo.players.lothar.hero
        ];
      }

      await activateDuoCharacter(
        state.duo.activeCharacter,
        { render: false }
      );
    } else {
      state.duo = null;
      state.character = snapshot.character;
      state.hero = snapshot.hero;
      state.ref = snapshot.reference;
      state.partnerActive = snapshot.partnerActive;
      state.completedEncounters = new Set(
        snapshot.completedEncounters || []
      );
      state.encounter = snapshot.encounter;
      state.history = snapshot.history || [];
      state.characterData = await loadCharacterData(state.character);
    }

    $("setup").classList.add("hidden");
    $("game").classList.remove("hidden");
    renderSheet();
    renderHistory();
    renderReference(state.ref, { applyEntryEffects: false });
    showGameMessage("Partida carregada.");
  } catch (error) {
    $("message").textContent = `Falha ao carregar: ${error.message}`;
  }
}

function restartGame() {
  state.hero = null;
  state.characterData = null;
  state.character = null;
  state.mode = null;
  state.shared = { status: 0, acao: 0 };
  state.ref = 1;
  state.partnerActive = false;
  state.encounter = null;
  state.completedEncounters = new Set();
  state.history = [];
  state.duo = null;
  state.cooperativeEncounter = null;

  hideCombat();
  $("game").classList.add("hidden");
  $("setup").classList.remove("hidden");
  $("message").textContent = "Nova partida pronta para configurar.";
  document.querySelectorAll(".selected").forEach(
    element => element.classList.remove("selected")
  );
}

function useProvision() {
  if (!state.hero) return;

  const result = consumeProvision(state.hero);

  if (result.ok) {
    showGameMessage(
      `Provisão consumida: +${result.restored} de ENERGIA.`
    );
  } else {
    const messages = {
      "full-energy": "Sua ENERGIA já está no máximo.",
      "no-provisions": "Você não possui mais provisões.",
      blocked: "Não é possível consumir provisões neste momento."
    };
    showGameMessage(messages[result.reason] || "Não foi possível usar a provisão.");
  }

  renderSheet();
}

function applyManualSync() {
  if (!state.hero || state.mode !== "dupla") {
    showGameMessage("A edição manual de STATUS/AÇÃO só é usada no protótipo do modo em dupla.");
    return;
  }

  const status = Number($("manual-status").value);
  const acao = Number($("manual-action").value);

  if (!Number.isInteger(status) || status < 0 || !Number.isInteger(acao) || acao < 0) {
    showGameMessage("Informe valores inteiros não negativos para STATUS e AÇÃO.");
    return;
  }

  state.shared = { status, acao };
  updateShared();
  renderReference(state.ref, { applyEntryEffects: false });
}

function runLuckTest() {
  if (!state.hero) return;

  const result = testLuck(state.hero);
  showGameMessage(
    `Teste de Sorte: ${result.rolls.join(" + ")} = ${result.total}. ` +
    (result.success ? "SUCESSO." : "AZAR.") +
    ` SORTE agora: ${result.luckAfter}.`
  );
  renderSheet();
}

init().catch((error) => {
  $("message").textContent = error.message;
});
