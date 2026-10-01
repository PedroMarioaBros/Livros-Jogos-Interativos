import { createCharacter, consumeProvision } from "./engine/character.js";
import { testLuck } from "./engine/luck.js";
import { processSyncPoint } from "./engine/sync.js";
import { applyEffects as applyStoryEffects, availableChoices } from "./engine/story.js";
import { createEncounter, playEncounterRound, currentOpponent } from "./engine/encounter.js";
import { serializeSave, parseSave } from "./engine/save.js";
import { applyCombatSpell } from "./engine/spell-combat.js";

const state = {
  config: null,
  rules: null,
  spells: null,
  syncData: null,
  characterData: null,
  hero: null,
  mode: null,
  character: null,
  shared: { status: 0, acao: 0 },
  ref: 1,
  partnerActive: false,
  encounter: null,
  completedEncounters: new Set(),
  history: []
};

const SAVE_KEY = "livros-jogos-interativos:furia-de-principes";

const $ = (id) => document.getElementById(id);

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return response.json();
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
      const config = state.config.characters.find(c => c.id === state.character);
      state.characterData = await loadJSON(base + config.data);
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

function startGame() {
  if (!state.mode || !state.characterData) {
    $("message").textContent = "Escolha o modo e o personagem antes de começar.";
    return;
  }

  state.hero = createCharacter(state.characterData);
  state.partnerActive = state.mode === "dupla";
  state.encounter = null;
  state.completedEncounters = new Set();
  state.history = [];
  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  renderSheet();
  renderHistory();
  renderReference(state.config.startReference);
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
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = "Fim desta aventura.";
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
    $("combat-title").textContent = "Combate cooperativo";
    $("combat-opponents").textContent =
      node.encounter.enemies
        .map(enemy => `${enemy.name} — HABILIDADE ${enemy.habilidade}, ENERGIA ${enemy.energia}`)
        .join(" • ");
    $("combat-log").textContent =
      "Este encontro exige os dois príncipes. O motor cooperativo já está implementado; a tela de controle dos dois personagens será ligada na próxima etapa.";
    $("combat-round").classList.add("hidden");
    $("combat-continue").classList.add("hidden");
    return;
  }

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
  hideCombat();

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
  renderReference(target);
}

function saveGame() {
  if (!state.hero) {
    showGameMessage("Não há partida ativa para salvar.");
    return;
  }

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
    state.character = snapshot.character;
    state.hero = snapshot.hero;
    state.shared = snapshot.shared;
    state.ref = snapshot.reference;
    state.partnerActive = snapshot.partnerActive;
    state.completedEncounters = new Set(snapshot.completedEncounters || []);
    state.encounter = snapshot.encounter;
    state.history = snapshot.history || [];

    const base = "jogos/furia-de-principes/";
    const config = state.config.characters.find(
      character => character.id === state.character
    );
    state.characterData = await loadJSON(base + config.data);

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
