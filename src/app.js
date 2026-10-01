import { createCharacter, consumeProvision } from "./engine/character.js";
import { testLuck } from "./engine/luck.js";
import { processSyncPoint } from "./engine/sync.js";
import { applyEffects as applyStoryEffects, availableChoices } from "./engine/story.js";

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
  visitedEffects: new Set()
};

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
  state.visitedEffects = new Set();
  state.partnerActive = state.mode === "dupla";
  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  renderSheet();
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

function renderReference(reference) {
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

  const visitKey = `${state.character}:${state.ref}`;
  if (!state.visitedEffects.has(visitKey)) {
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
    state.visitedEffects.add(visitKey);

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
        setTimeout(() => renderReference(syncResult.target), 0);
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
      renderReference(choice.target);
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
      renderReference(
        result.success ? node.test.successTarget : node.test.failureTarget
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
  renderReference(state.ref);
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
