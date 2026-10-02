import { createCharacter, consumeProvision } from "./engine/character.js";
import { testLuck } from "./engine/luck.js";
import { rollExpression } from "./engine/dice.js";
import {
  castSituationalSpell,
  combatSpellLimit
} from "./engine/magic.js";
import { processSyncPoint } from "./engine/sync.js";
import {
  applyEffects as applyStoryEffects,
  availableChoices,
  conditionMet,
  resolveDynamicDuoComparison
} from "./engine/story.js";
import { createEncounter, playEncounterRound, currentOpponent } from "./engine/encounter.js";
import {
  createCooperativeCombatState,
  cooperativeCombatStep
} from "./engine/combat.js";
import { serializeSave, parseSave } from "./engine/save.js";
import {
  merchantItemSold,
  purchaseMerchantItem
} from "./engine/merchant.js";
import {
  applyCombatSpell,
  applyCooperativeCombatSpell
} from "./engine/spell-combat.js";
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
  cooperativeEncounter: null,
  pendingSharedLoot: null
};

const SAVE_KEY = "livros-jogos-interativos:furia-de-principes";
let deferredInstallPrompt = null;

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
  $("install-app").addEventListener("click", installApp);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("install-app").classList.remove("hidden");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    $("install-app").classList.add("hidden");
  });

  registerServiceWorker();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Service Worker não pôde ser registrado:", error);
  }
}

async function installApp() {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $("install-app").classList.add("hidden");
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

  state.pendingSharedLoot = null;
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

function getPartnerHero() {
  if (state.mode !== "dupla" || !state.duo || !state.character) {
    return null;
  }

  const other = state.character === "colthar" ? "lothar" : "colthar";
  return state.duo.players[other]?.hero || null;
}

function storyContext(extra = {}) {
  return {
    character: state.hero,
    partnerCharacter: getPartnerHero(),
    shared: state.shared,
    partnerActive: state.partnerActive,
    itemTags: state.config?.itemTags || {},
    ...extra
  };
}

function resolveSharedPayment(choice) {
  const amount = Number(choice.sharedPayment?.amount || 0);
  if (!amount) return true;

  const partner = getPartnerHero();

  if (!partner) {
    if (state.hero.gold < amount) {
      showGameMessage("Ouro insuficiente para esse pagamento.");
      return false;
    }
    state.hero.gold -= amount;
    renderSheet();
    return true;
  }

  const combined = state.hero.gold + partner.gold;
  if (combined < amount) {
    showGameMessage("Os dois príncipes juntos não possuem ouro suficiente.");
    return false;
  }

  const minCurrent = Math.max(0, amount - partner.gold);
  const maxCurrent = Math.min(amount, state.hero.gold);
  const suggested = Math.min(
    maxCurrent,
    Math.max(minCurrent, Math.floor(amount / 2))
  );

  const answer = window.prompt(
    `Pagamento conjunto de ${amount} moedas. ` +
    `Quantas moedas ${state.hero.name} vai pagar? ` +
    `Escolha de ${minCurrent} a ${maxCurrent}; o restante será pago por ${partner.name}.`,
    String(suggested)
  );

  if (answer === null) return false;

  const currentShare = Number(answer);
  if (
    !Number.isInteger(currentShare) ||
    currentShare < minCurrent ||
    currentShare > maxCurrent
  ) {
    showGameMessage(
      `Informe um valor inteiro entre ${minCurrent} e ${maxCurrent}.`
    );
    return false;
  }

  const partnerShare = amount - currentShare;
  state.hero.gold -= currentShare;
  partner.gold -= partnerShare;
  persistActiveDuoPlayer();
  renderSheet();

  showGameMessage(
    `Pagamento realizado: ${state.hero.name} pagou ${currentShare} e ${partner.name} pagou ${partnerShare} moedas.`
  );
  return true;
}

function displayItemName(item) {
  return String(item)
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderMerchant(node) {
  const merchant = node.merchant;
  const partner =
    state.mode === "dupla" && state.partnerActive
      ? getPartnerHero()
      : null;
  const participants = partner
    ? [state.hero, partner]
    : [state.hero];

  $("choices").innerHTML = "";

  const info = document.createElement("p");
  info.className = "muted";
  info.textContent =
    "Cada artefato custa " + merchant.pricePerItem + " moedas. " +
    (merchant.sharedUniqueStock && partner
      ? "Existe apenas um exemplar de cada item para os dois príncipes."
      : "Escolha o que deseja comprar.");
  $("choices").appendChild(info);

  for (const item of merchant.items || []) {
    const sold = merchantItemSold(
      state.ref,
      item,
      participants
    );

    const row = document.createElement("div");
    row.className = "merchant-item";

    const label = document.createElement("p");
    label.className = "muted";
    label.textContent = sold
      ? displayItemName(item) + " — vendido"
      : displayItemName(item);
    row.appendChild(label);

    if (!sold) {
      for (const buyer of participants) {
        const button = document.createElement("button");
        button.textContent =
          "Comprar para " + buyer.name + " — " + merchant.pricePerItem + " moedas";
        button.disabled =
          buyer.gold < Number(merchant.pricePerItem || 0) ||
          buyer.items.includes(item);
        button.addEventListener("click", () => {
          const result = purchaseMerchantItem({
            reference: state.ref,
            item,
            price: merchant.pricePerItem,
            buyer,
            participants,
            sharedUniqueStock: merchant.sharedUniqueStock
          });

          if (!result.ok) {
            const messages = {
              sold: "Esse artefato já foi comprado.",
              "insufficient-gold": "Ouro insuficiente.",
              "already-owned": "Esse personagem já possui o artefato."
            };
            showGameMessage(
              messages[result.reason] || "Compra não realizada."
            );
            return;
          }

          persistActiveDuoPlayer();
          renderSheet();
          showGameMessage(
            buyer.name + " comprou " + displayItemName(item) +
            " por " + result.price + " moedas."
          );
          renderMerchant(node);
        });
        row.appendChild(button);
      }
    }

    $("choices").appendChild(row);
  }

  const continueButton = document.createElement("button");
  continueButton.textContent =
    "Encerrar compras → " + merchant.continueTarget;
  continueButton.addEventListener("click", () => {
    navigateTo(
      merchant.continueTarget,
      "Encerrar compras"
    );
  });
  $("choices").appendChild(continueButton);
}

function renderPendingSharedLoot() {
  const loot = state.pendingSharedLoot;
  if (!loot || loot.reference !== state.ref) return false;

  $("choices").innerHTML = "";
  const info = document.createElement("p");
  info.className = "muted";

  const parts = [];
  if (loot.gold) parts.push(`${loot.gold} moedas`);
  if (loot.items?.length) parts.push(loot.items.join(", "));

  info.textContent =
    `Tesouro compartilhado: ${parts.join(" + ")}. ` +
    "Defina a divisão antes de continuar.";
  $("choices").appendChild(info);

  const button = document.createElement("button");
  button.textContent = "🤝 Dividir tesouro";
  button.addEventListener("click", resolvePendingSharedLoot);
  $("choices").appendChild(button);
  return true;
}

function resolvePendingSharedLoot() {
  const loot = state.pendingSharedLoot;
  if (!loot) return;

  const partner = getPartnerHero();

  if (!partner) {
    state.hero.gold += Number(loot.gold || 0);
    for (const item of loot.items || []) {
      if (!state.hero.items.includes(item)) state.hero.items.push(item);
    }
  } else {
    const totalGold = Number(loot.gold || 0);
    let currentGold = 0;
    const itemRecipients = [];

    if (totalGold > 0) {
      const answer = window.prompt(
        `Foram encontradas ${totalGold} moedas. Quantas ficam com ${state.hero.name}? O restante ficará com ${partner.name}.`,
        String(Math.floor(totalGold / 2))
      );

      if (answer === null) return;

      currentGold = Number(answer);
      if (
        !Number.isInteger(currentGold) ||
        currentGold < 0 ||
        currentGold > totalGold
      ) {
        showGameMessage(
          `Informe um número inteiro entre 0 e ${totalGold}.`
        );
        return;
      }
    }

    for (const item of loot.items || []) {
      const answer = window.prompt(
        `Quem fica com “${item}”? Digite 1 para ${state.hero.name} ou 2 para ${partner.name}.`,
        "1"
      );

      if (answer === null) return;

      const normalized = String(answer).trim();
      if (!["1", "2"].includes(normalized)) {
        showGameMessage("Digite apenas 1 ou 2 para escolher o personagem.");
        return;
      }

      itemRecipients.push({
        item,
        recipient: normalized === "2" ? partner : state.hero
      });
    }

    state.hero.gold += currentGold;
    partner.gold += totalGold - currentGold;

    for (const { item, recipient } of itemRecipients) {
      if (!recipient.items.includes(item)) {
        recipient.items.push(item);
      }
    }
  }

  state.pendingSharedLoot = null;
  persistActiveDuoPlayer();
  renderSheet();
  renderReference(state.ref, { applyEntryEffects: false });
  showGameMessage("Tesouro dividido e registrado nas fichas.");
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
      partnerCharacter: getPartnerHero(),
      itemTags: state.config?.itemTags || {},
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

    if (context.pendingSharedLoot) {
      if (state.mode === "dupla" && state.duo) {
        state.pendingSharedLoot = {
          reference: state.ref,
          gold: Number(context.pendingSharedLoot.gold || 0),
          items: [...(context.pendingSharedLoot.items || [])]
        };
      } else {
        state.hero.gold += Number(context.pendingSharedLoot.gold || 0);
        for (const item of context.pendingSharedLoot.items || []) {
          if (!state.hero.items.includes(item)) state.hero.items.push(item);
        }
        showGameMessage("Tesouro acrescentado à ficha.");
      }
    }

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
        state.rules.modes.solo.ignoreSharedMutations,
      character: state.hero,
      partnerCharacter: getPartnerHero(),
      partnerActive: state.partnerActive
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

  if (
    node.partnerRemoved &&
    state.mode === "dupla" &&
    state.duo
  ) {
    const other =
      state.character === "colthar" ? "lothar" : "colthar";

    if (!state.duo.players[other].removed) {
      updateDuoPlayer(state.duo, other, {
        removed: true
      });
      updatePartnerState();
      renderDuoStatus();
    }
  }

  if (renderPendingSharedLoot()) {
    hideCombat();
    return;
  }

  if (node.merchant) {
    hideCombat();
    renderMerchant(node);
    return;
  }

  if (
    node.dynamicDuoComparison &&
    state.mode === "dupla" &&
    state.duo
  ) {
    const partner = getPartnerHero();
    const result = resolveDynamicDuoComparison(
      node.dynamicDuoComparison,
      state.hero,
      partner
    );

    if (result?.target) {
      const outcomeLabel = {
        "self-greater": state.hero.name + " possui mais Pedras de Poder",
        "partner-greater": partner.name + " possui mais Pedras de Poder",
        equal: "Os dois possuem a mesma quantidade de Pedras de Poder"
      }[result.outcome];

      $("sync-message").textContent =
        outcomeLabel + ": " + result.selfCount + " x " + result.partnerCount + ". " +
        "Destino automático → " + result.target;

      setTimeout(
        () => navigateTo(
          result.target,
          "Comparação de Pedras de Poder",
          { applyEntryEffects: true }
        ),
        0
      );
      return;
    }
  }

  const encounterAvailable =
    !node.encounter?.conditions?.length ||
    node.encounter.conditions.every(condition =>
      conditionMet(condition, storyContext())
    );

  if (
    (node.encounter || node.encounterDynamic) &&
    encounterAvailable &&
    !state.completedEncounters.has(state.ref)
  ) {
    renderEncounter(node);
    return;
  }

  hideCombat();

  const context = storyContext();
  const choices = availableChoices(node, context);

  for (const choice of choices) {
    const button = document.createElement("button");
    button.textContent = `${choice.label} → ${choice.target}`;
    button.addEventListener("click", () => {
      if (!resolveSharedPayment(choice)) return;

      const effectContext = {
        shared: state.shared,
        partnerActive: state.partnerActive,
        itemTags: state.config?.itemTags || {},
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

  if (node.dynamicCondition) {
    const condition = {
      type: node.dynamicCondition.type,
      flags: node.dynamicCondition.flags
    };
    const matched = conditionMet(condition, {
      character: state.hero,
      shared: state.shared,
      partnerActive: state.partnerActive
    });
    const target = matched
      ? node.dynamicCondition.trueTarget
      : node.dynamicCondition.falseTarget;

    const button = document.createElement("button");
    button.textContent = `Continuar → ${target}`;
    button.addEventListener("click", () => {
      navigateTo(target, "Condição histórica");
    });
    $("choices").appendChild(button);
  }

  if (node.partnerRollRoutes?.length) {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent =
      "Esta decisão depende de uma rolagem compartilhada com o outro jogador.";
    $("choices").appendChild(info);

    const button = document.createElement("button");
    button.textContent = "🎲 Rolar 1d6 em conjunto";
    button.addEventListener("click", () => {
      const result = rollExpression("1d6");
      const route = node.partnerRollRoutes.find(item => {
        const [min, max] = item.range || [];
        return result.total >= min && result.total <= max;
      });

      showGameMessage(
        `Rolagem compartilhada: ${result.total}.`
      );

      if (route) {
        navigateTo(
          route.target,
          `Rolagem compartilhada ${result.total}`
        );
      }
    });

    $("choices").appendChild(button);
  }

  if (node.rollAgainstStat) {
    const button = document.createElement("button");
    button.textContent =
      `🎲 Rolar ${node.rollAgainstStat.dice} contra ${node.rollAgainstStat.stat.toUpperCase()}`;

    button.addEventListener("click", () => {
      const result = rollExpression(node.rollAgainstStat.dice);
      const statValue =
        state.hero.stats[node.rollAgainstStat.stat];
      const success =
        node.rollAgainstStat.successWhen === "lte"
          ? result.total <= statValue
          : result.total >= statValue;

      showGameMessage(
        `Rolagem: ${result.rolls.join(" + ")} = ${result.total}; ` +
        `${node.rollAgainstStat.stat.toUpperCase()} = ${statValue}. ` +
        (success ? "SUCESSO." : "FALHA.")
      );

      navigateTo(
        success
          ? node.rollAgainstStat.successTarget
          : node.rollAgainstStat.failureTarget,
        success
          ? "Teste de atributo: sucesso"
          : "Teste de atributo: falha"
      );
    });

    $("choices").appendChild(button);
  }

  if (node.roll) {
    const button = document.createElement("button");
    button.textContent = `🎲 Rolar ${node.roll.dice}`;
    button.addEventListener("click", () => {
      const result = rollExpression(node.roll.dice);
      const route = (node.roll.routes || []).find(item => {
        const [min, max] = item.range || [];
        return result.total >= min && result.total <= max;
      });

      showGameMessage(
        `Rolagem: ${result.rolls.join(" + ")} = ${result.total}.`
      );

      if (route) {
        navigateTo(
          route.target,
          `Rolagem ${result.total}`
        );
      }
    });
    $("choices").appendChild(button);
  }

  if (node.spellOptions?.length) {
    for (const option of node.spellOptions) {
      const button = document.createElement("button");
      button.textContent =
        `🪄 ${option.label} — custo ${option.cost} MAGIA`;

      button.addEventListener("click", () => {
        const result = castSituationalSpell(
          state.hero,
          {
            ...option,
            failureTarget: node.failureTarget
          }
        );

        renderSheet();

        if (!result.ok) {
          showGameMessage(
            "MAGIA insuficiente para pagar o custo deste feitiço."
          );
          return;
        }

        const outcome = result.automaticFailure
          ? "Falha automática: MAGIA igual a zero."
          : result.success
            ? `Feitiço funcionou (dado ${result.die}).`
            : `Feitiço falhou (dado ${result.die}).`;

        showGameMessage(outcome);

        if (!result.success && node.partnerOnFailure) {
          showGameMessage(
            outcome +
            ` O outro jogador também deve seguir para ${node.partnerOnFailure}.`
          );
        }

        if (
          !result.success &&
          node.failureChoices?.length
        ) {
          $("choices").innerHTML = "";

          const info = document.createElement("p");
          info.className = "muted";
          info.textContent =
            outcome + " Escolha como continuar após a falha.";
          $("choices").appendChild(info);

          for (const failureChoice of node.failureChoices) {
            const failureButton = document.createElement("button");
            failureButton.textContent =
              `${failureChoice.label} → ${failureChoice.target}`;
            failureButton.addEventListener("click", () => {
              navigateTo(
                failureChoice.target,
                "Alternativa após falha de feitiço"
              );
            });
            $("choices").appendChild(failureButton);
          }

          return;
        }

        if (result.target) {
          if (
            !result.success &&
            node.partnerOnFailure &&
            state.mode === "dupla" &&
            state.duo
          ) {
            const other =
              state.character === "colthar" ? "lothar" : "colthar";
            const partner = state.duo.players[other];
            updateDuoPlayer(state.duo, other, {
              reference: node.partnerOnFailure,
              history: [
                ...(partner.history || []),
                {
                  from: partner.reference,
                  to: node.partnerOnFailure,
                  label: "Falha compartilhada"
                }
              ]
            });
          }

          navigateTo(
            result.target,
            result.success
              ? `Feitiço: ${option.label}`
              : "Falha no feitiço"
          );
        }
      });

      $("choices").appendChild(button);
    }
  }

  if (node.playerEffectChoice?.type === "restore_one_stat") {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent =
      "Escolha qual atributo recuperar antes de continuar:";
    $("choices").appendChild(info);

    for (const stat of node.playerEffectChoice.stats || []) {
      const button = document.createElement("button");
      button.dataset.playerEffectChoice = "true";
      button.textContent = `➕ Recuperar ${node.playerEffectChoice.amount} em ${stat.toUpperCase()}`;
      button.addEventListener("click", () => {
        applyStoryEffects(
          state.hero,
          [{
            type: "change_stat",
            stat,
            delta: node.playerEffectChoice.amount,
            cap: node.playerEffectChoice.cap
          }],
          { itemTags: state.config?.itemTags || {} }
        );
        renderSheet();
        document
          .querySelectorAll("[data-player-effect-choice]")
          .forEach(item => {
            item.disabled = true;
          });
        showGameMessage(
          `${stat.toUpperCase()} recuperada.`
        );
      });
      $("choices").appendChild(button);
    }
  }

  if (node.playerEffectChoice?.type === "discard_one_item") {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = "Escolha um item para perder:";
    $("choices").appendChild(info);

    for (const item of state.hero.items) {
      const button = document.createElement("button");
      button.dataset.playerEffectChoice = "true";
      button.textContent = `🗑️ Perder ${item}`;
      button.addEventListener("click", () => {
        applyStoryEffects(
          state.hero,
          [{ type: "remove_item", item }],
          { itemTags: state.config?.itemTags || {} }
        );
        renderSheet();
        document
          .querySelectorAll("[data-player-effect-choice]")
          .forEach(entry => {
            entry.disabled = true;
          });
        showGameMessage(`Item perdido: ${item}.`);
      });
      $("choices").appendChild(button);
    }
  }

  if (node.partnerInstruction) {
    const info = document.createElement("p");
    info.className = "muted";

    if (state.mode === "dupla" && state.duo) {
      const other =
        state.character === "colthar" ? "lothar" : "colthar";
      const otherName =
        other === "colthar" ? "Colthar" : "Lothar";
      const partner = state.duo.players[other];

      if (
        Array.isArray(node.partnerInstruction.conditionalSend) &&
        !partner.removed
      ) {
        const matched = node.partnerInstruction.conditionalSend.find(
          route => conditionMet(route.condition, {
            character: state.hero,
            shared: state.shared,
            partnerActive: state.partnerActive
          })
        );

        if (matched) {
          const target = matched.target;
          updateDuoPlayer(state.duo, other, {
            reference: target,
            history: [
              ...(partner.history || []),
              {
                from: partner.reference,
                to: target,
                label: `Instrução condicional de ${state.hero.name}`
              }
            ]
          });
          info.textContent =
            `${otherName} foi encaminhado para a referência ${target} conforme STATUS/AÇÃO.`;
        } else {
          info.textContent =
            "Nenhuma condição de encaminhamento foi satisfeita.";
        }
      } else if (
        Number.isInteger(node.partnerInstruction.sendToReference) &&
        !partner.removed
      ) {
        const target = node.partnerInstruction.sendToReference;

        if (partner.reference !== target) {
          updateDuoPlayer(state.duo, other, {
            reference: target,
            history: [
              ...(partner.history || []),
              {
                from: partner.reference,
                to: target,
                label: `Instrução de ${state.hero.name}`
              }
            ]
          });
        }

        info.textContent =
          `${otherName} foi encaminhado para a referência ${target}.`;
      } else if (node.partnerInstruction.wait) {
        info.textContent =
          `A aventura de ${state.hero.name} deve aguardar uma instrução de ${otherName}.`;
      }

      $("choices").appendChild(info);

      if (!partner.removed) {
        const button = document.createElement("button");
        button.textContent =
          `🔒 Entregar aparelho para ${otherName}`;
        button.addEventListener("click", startPlayerHandoff);
        $("choices").appendChild(button);
      }
    } else {
      info.textContent =
        "Esta referência contém uma instrução do modo para dois jogadores.";
      $("choices").appendChild(info);
    }
  }

  if (node.ending) {
    if (
      state.mode === "dupla" &&
      state.duo &&
      ["death", "removed"].includes(node.ending) &&
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

  let encounterDefinition = node.encounter;

  if (node.encounterDynamic?.type === "mirror_character_stats") {
    encounterDefinition = {
      enemies: [{
        name: node.encounterDynamic.name || "Reflexo",
        habilidade: state.hero.stats.habilidade,
        energia: state.hero.stats.energia
      }]
    };
  }

  if (!encounterDefinition) {
    $("combat-title").textContent = "Encontro ainda não suportado";
    $("combat-opponents").textContent = "";
    $("combat-log").textContent =
      "Esta referência contém um encontro estrutural ainda não convertido para combate jogável.";
    $("combat-round").classList.add("hidden");
    $("combat-continue").classList.add("hidden");
    return;
  }

  if (encounterDefinition.cooperative && state.mode === "dupla") {
    state.encounter = null;

    if (
      !state.cooperativeEncounter ||
      state.cooperativeEncounter.reference !== state.ref
    ) {
      const colthar = state.duo.players.colthar.hero;
      const lothar = state.duo.players.lothar.hero;

      state.cooperativeEncounter = createCooperativeCombatState(
        [colthar, lothar],
        encounterDefinition.enemies.map(enemy => ({
          name: enemy.name,
          habilidade: enemy.habilidade,
          energia: enemy.energia,
          initialEnergy: enemy.energia
        })),
        {
          specialRule: encounterDefinition.specialRule || null
        }
      );
      state.cooperativeEncounter.reference = state.ref;
    }

    renderCooperativeEncounter(node);
    return;
  }

  state.cooperativeEncounter = null;

  if (!state.encounter || state.encounter.reference !== state.ref) {
    state.encounter = createEncounter(state.ref, encounterDefinition);
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
  $("combat-continue").classList.add("hidden");
  $("combat-round").classList.remove("hidden");
  $("combat-round").textContent = "🎲 Rolar rodada cooperativa";
  $("combat-title").textContent = "⚔️ Colthar + Lothar";

  updateCooperativeCombatDisplay();

  if (!state.cooperativeEncounter.log.length) {
    $("combat-log").textContent =
      "Os dois príncipes estão no mesmo confronto. Com vários inimigos, cada um enfrenta um adversário; contra um único inimigo, os ataques se alternam.";
  }

  renderSpellPanel(node);
  renderDuoStatus();
}

function updateCooperativeCombatDisplay() {
  if (!state.cooperativeEncounter) return;

  const heroes = state.cooperativeEncounter.heroes;
  const enemies = state.cooperativeEncounter.enemies;

  const shadow = state.cooperativeEncounter.proxiesByHero?.[1];
  const shadowText =
    shadow?.stats?.energia > 0
      ? ` | Sombra: HABILIDADE ${shadow.stats.habilidade} • ENERGIA ${shadow.stats.energia}/${shadow.initialStats.energia}`
      : "";

  const heroText = [
    `Colthar: ENERGIA ${heroes[0].stats.energia}/${heroes[0].initialStats.energia}`,
    `Lothar: ENERGIA ${heroes[1].stats.energia}/${heroes[1].initialStats.energia}`
  ].join(" | ") + shadowText;

  const enemyText = enemies
    .map(enemy => {
      const stateLabel = enemy.asleep ? " • ADORMECIDO" : "";
      return `${enemy.name}: HABILIDADE ${enemy.habilidade} • ENERGIA ${enemy.energia}/${enemy.initialEnergy}${stateLabel}`;
    })
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

function completeCooperativeCombatVictory(node) {
  if (!state.completedEncounters.has(state.ref)) {
    state.completedEncounters.add(state.ref);
    applyStoryEffects(state.hero, node.rewards || [], {
      shared: state.shared,
      partnerActive: state.partnerActive,
      itemTags: state.config?.itemTags || {}
    });
    renderSheet();
  }

  state.cooperativeEncounter.finished = true;
  state.cooperativeEncounter.winner = "heroes";
  $("combat-title").textContent = "🏆 Vitória dos príncipes";
  $("combat-round").classList.add("hidden");
  $("spell-panel").classList.add("hidden");

  const choices = availableChoices(node, storyContext());

  if (choices.length) {
    $("combat-continue").classList.add("hidden");
    $("choices").innerHTML = "";

    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = "Escolha como continuar após a vitória:";
    $("choices").appendChild(info);

    for (const choice of choices) {
      const button = document.createElement("button");
      button.textContent = `${choice.label} → ${choice.target}`;
      button.addEventListener("click", () => {
        if (!resolveSharedPayment(choice)) return;

        const effectContext = {
          shared: state.shared,
          partnerActive: state.partnerActive,
          partnerCharacter: getPartnerHero(),
          itemTags: state.config?.itemTags || {},
          ignoreSharedMutations: false
        };
        applyStoryEffects(
          state.hero,
          choice.effects || [],
          effectContext
        );
        state.shared = effectContext.shared;
        state.cooperativeEncounter = null;
        hideCombat();
        navigateTo(choice.target, choice.label);
      });
      $("choices").appendChild(button);
    }
  } else {
    $("combat-continue").classList.remove("hidden");
    $("combat-continue").dataset.target = node.onVictory ?? "";
    $("combat-continue").textContent = node.onVictory
      ? `Continuar → ${node.onVictory}`
      : "Continuar";
  }

  persistActiveDuoPlayer();
  renderDuoStatus();
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
        event.attackerName ||
        (event.heroIndex === 0 ? "Colthar" : "Lothar");
      const enemy =
        state.cooperativeEncounter.enemies[event.enemyIndex];
      const round = event.result;
      const shadowNote = event.proxyDefeated
        ? " A Sombra foi vencida; Lothar entra no combate."
        : "";
      const collateralNote = event.collateralDamage?.length
        ? " O golpe também atinge " +
          event.collateralDamage
            .map(entry =>
              `${entry.heroIndex === 0 ? "Colthar" : "Lothar"} por ${entry.damage}`
            )
            .join(" e ") +
          "."
        : "";

      if (round.outcome === "hero-hit") {
        return `${heroName} acerta ${enemy.name} e causa ${round.damage} de dano${shadowNote}${collateralNote}`;
      }

      if (round.outcome === "enemy-hit") {
        return `${enemy.name} acerta ${heroName} e causa ${round.damage} de dano${shadowNote}${collateralNote}`;
      }

      return `${heroName} e ${enemy.name} empatam${shadowNote}${collateralNote}`;
    });

    $("combat-log").textContent =
      `Série ${state.cooperativeEncounter.step}: ` +
      descriptions.join(" • ") + ".";
  }

  renderSheet();

  if (result.finished) {
    if (result.winner === "heroes") {
      completeCooperativeCombatVictory(node);
    } else {
      state.cooperativeEncounter.finished = true;
      state.cooperativeEncounter.winner = "enemies";
      $("combat-round").classList.add("hidden");
      $("spell-panel").classList.add("hidden");
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
  const cooperative =
    state.cooperativeEncounter &&
    !state.cooperativeEncounter.finished;
  const encounter = cooperative
    ? state.cooperativeEncounter
    : state.encounter;
  const caster = cooperative
    ? state.cooperativeEncounter.heroes?.[1]
    : state.hero;
  const lotharAvailable = cooperative
    ? Boolean(caster && caster.stats.energia > 0)
    : state.character === "lothar";
  const roundsStarted = cooperative
    ? Number(encounter?.step || 0) > 0
    : Boolean(encounter?.rounds?.length);
  const limit = caster ? combatSpellLimit(caster) : 1;
  const attempts = Number(
    encounter?.combatSpellsAttempted ??
    (encounter?.combatSpellAttempted ? 1 : 0)
  );

  const canCast =
    lotharAvailable &&
    Boolean(caster?.stats && "magia" in caster.stats) &&
    !node.encounter?.noCombatMagic &&
    node.encounter?.allowCombatMagic !== false &&
    encounter &&
    !roundsStarted &&
    attempts < limit;

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
    limit > 1
      ? `Lothar pode lançar até ${limit} Feitiços de Combate antes da primeira série. Restam ${limit - attempts}.`
      : "Lothar pode lançar um Feitiço de Combate antes da primeira série de ataque.";
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
      "combat-spell-limit-reached": "O limite de Feitiços de Combate deste encontro foi atingido.",
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
  const cooperative =
    state.cooperativeEncounter &&
    !state.cooperativeEncounter.finished;
  const encounter = cooperative
    ? state.cooperativeEncounter
    : state.encounter;
  const caster = cooperative
    ? state.cooperativeEncounter.heroes?.[1]
    : state.hero;

  if (
    !encounter ||
    !caster ||
    (!cooperative && state.character !== "lothar")
  ) {
    return;
  }

  const spell = state.spells.spells.find(
    item => item.id === $("spell-select").value
  );
  if (!spell) return;

  const magicSpend = Number($("spell-magic-spend").value);
  const result = cooperative
    ? applyCooperativeCombatSpell(
        caster,
        encounter,
        spell,
        { magicSpend, heroIndex: 1 }
      )
    : applyCombatSpell(
        caster,
        encounter,
        spell,
        { magicSpend }
      );

  $("spell-result").textContent = describeSpellResult(result);
  renderSheet();

  if (cooperative) {
    updateCooperativeCombatDisplay();
  } else {
    updateCombatOpponents();
  }

  if (result.ok) {
    const limit = combatSpellLimit(caster);
    const attempts = Number(
      encounter.combatSpellsAttempted || 0
    );

    if (attempts >= limit || result.encounterVictory) {
      $("spell-panel").classList.add("hidden");
    } else {
      renderSpellPanel(
        state.characterData.references[String(state.ref)]
      );
      $("spell-result").textContent =
        `Feitiço lançado. Ainda resta ${limit - attempts} tentativa(s) antes do combate.`;
    }
  }

  if (result.encounterVictory) {
    const node = state.characterData.references[String(state.ref)];
    if (cooperative) {
      completeCooperativeCombatVictory(node);
    } else {
      completeCombatVictory(node);
    }
  }

  if (cooperative) {
    persistActiveDuoPlayer();
    renderDuoStatus();
  }
}

function completeCombatVictory(node) {
  if (!state.completedEncounters.has(state.ref)) {
    state.completedEncounters.add(state.ref);
    applyStoryEffects(state.hero, node.rewards || [], {
      shared: state.shared,
      partnerActive: state.partnerActive,
      itemTags: state.config?.itemTags || {}
    });
    renderSheet();
  }

  $("combat-title").textContent = "🏆 Vitória";
  $("combat-round").classList.add("hidden");
  $("spell-panel").classList.add("hidden");

  if (node.postVictoryChoices?.length) {
    $("combat-continue").classList.add("hidden");
    $("choices").innerHTML = "";

    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = "Escolha como continuar após a vitória:";
    $("choices").appendChild(info);

    for (const choice of node.postVictoryChoices) {
      const button = document.createElement("button");
      button.textContent = `${choice.label} → ${choice.target}`;
      button.addEventListener("click", () => {
        state.encounter = null;
        hideCombat();
        navigateTo(choice.target, choice.label);
      });
      $("choices").appendChild(button);
    }
    return;
  }

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

  if (
    result.round &&
    !result.victory &&
    !result.defeat &&
    state.encounter.roundLimit > 0 &&
    state.encounter.rounds.length >= state.encounter.roundLimit
  ) {
    state.encounter.finished = true;
    $("combat-title").textContent = "☠️ Limite de séries atingido";
    $("combat-round").classList.add("hidden");
    $("spell-panel").classList.add("hidden");

    if (node.onRoundLimit) {
      $("combat-continue").classList.remove("hidden");
      $("combat-continue").dataset.target = node.onRoundLimit;
      $("combat-continue").textContent =
        `Continuar → ${node.onRoundLimit}`;
      showGameMessage(
        `O inimigo não foi derrotado em ${state.encounter.roundLimit} séries. A aventura determina uma consequência específica.`
      );
    } else {
      showGameMessage(
        `O inimigo não foi derrotado em ${state.encounter.roundLimit} séries.`
      );
    }
    return;
  }

  if (result.defeat) {
    $("combat-title").textContent = node.onDefeat
      ? "⚠️ Combate perdido"
      : "☠️ Derrota";
    $("combat-round").classList.add("hidden");

    if (
      node.partnerOnDefeat &&
      state.mode === "dupla" &&
      state.duo
    ) {
      const other =
        state.character === "colthar" ? "lothar" : "colthar";
      const partner = state.duo.players[other];

      if (!partner.removed) {
        updateDuoPlayer(state.duo, other, {
          reference: node.partnerOnDefeat,
          history: [
            ...(partner.history || []),
            {
              from: partner.reference,
              to: node.partnerOnDefeat,
              label: "Derrota do outro príncipe"
            }
          ]
        });
      }
    }

    if (node.onDefeat) {
      $("combat-continue").classList.remove("hidden");
      $("combat-continue").dataset.target = node.onDefeat;
      $("combat-continue").textContent =
        `Continuar → ${node.onDefeat}`;
      showGameMessage(
        "O combate foi perdido, mas a aventura determina uma continuação específica."
      );
    } else {
      showGameMessage("Sua ENERGIA chegou a zero.");
    }
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
    state.pendingSharedLoot =
      snapshot.pendingSharedLoot || null;

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
  state.pendingSharedLoot = null;

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
      "energy-recovery-blocked": "Uma maldição impede qualquer recuperação de ENERGIA.",
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
