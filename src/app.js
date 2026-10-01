const state = {
  config: null,
  characterData: null,
  mode: null,
  character: null,
  stats: null,
  shared: { status: 0, acao: 0 },
  ref: 1
};

const $ = (id) => document.getElementById(id);
const d6 = () => 1 + Math.floor(Math.random() * 6);
const roll = (expression) => {
  const match = /^(\d+)d6\+(\d+)$/.exec(expression);
  if (!match) return 0;
  const count = Number(match[1]);
  const bonus = Number(match[2]);
  let total = bonus;
  for (let i = 0; i < count; i++) total += d6();
  return total;
};

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return response.json();
}

async function init() {
  const catalog = await loadJSON("jogos/catalogo.json");
  const game = catalog.games[0];
  state.config = await loadJSON(game.config);

  $("game-title").textContent = state.config.title;
  $("game-status").textContent = "Estrutura inicial carregada";

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.shared = state.mode === "solo"
        ? { status: 1, acao: 1 }
        : { ...state.config.sharedState };
      selectGroup("[data-mode]", button);
      updateShared();
    });
  });

  document.querySelectorAll("[data-character]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.character = button.dataset.character;
      const config = state.config.characters.find(c => c.id === state.character);
      state.characterData = await loadJSON(`jogos/furia-de-principes/${config.data}`);
      selectGroup("[data-character]", button);
    });
  });

  $("start").addEventListener("click", startGame);
}

function selectGroup(selector, selected) {
  document.querySelectorAll(selector).forEach(b => b.classList.remove("selected"));
  selected.classList.add("selected");
}

function updateShared() {
  $("shared").textContent = `STATUS ${state.shared.status} • AÇÃO ${state.shared.acao}`;
}

function startGame() {
  if (!state.mode || !state.characterData) {
    $("message").textContent = "Escolha o modo e o personagem antes de começar.";
    return;
  }

  state.stats = {};
  for (const [key, expression] of Object.entries(state.characterData.initialStats)) {
    state.stats[key] = roll(expression);
  }

  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  renderStats();
  renderReference(1);
}

function renderStats() {
  $("stats").innerHTML = Object.entries(state.stats)
    .map(([key, value]) => `<div class="stat"><div class="muted">${key.toUpperCase()}</div><strong>${value}</strong></div>`)
    .join("");
  updateShared();
}

function applyEffects(node) {
  for (const effect of node.effects || []) {
    if (effect.type === "set_shared") {
      state.shared[effect.key] = effect.value;
    }
  }
}

function renderReference(reference) {
  state.ref = Number(reference);
  const node = state.characterData.references[String(state.ref)];

  $("reference").textContent = `Referência ${state.ref}`;

  if (!node) {
    $("scene").textContent = "Esta referência ainda não foi extraída para o banco de dados.";
    $("choices").innerHTML = "";
    return;
  }

  applyEffects(node);
  $("scene").textContent = node.resumo || "Cena sem resumo.";
  $("choices").innerHTML = "";
  updateShared();

  for (const choice of node.choices || []) {
    const button = document.createElement("button");
    button.textContent = `${choice.label} → ${choice.target}`;
    button.addEventListener("click", () => renderReference(choice.target));
    $("choices").appendChild(button);
  }

  if (!(node.choices || []).length) {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = "Esse nó ainda aguarda extração/validação.";
    $("choices").appendChild(info);
  }
}

init().catch((error) => {
  $("message").textContent = error.message;
});
