export function rollDie(sides = 6, rng = Math.random) {
  if (!Number.isInteger(sides) || sides < 2) {
    throw new RangeError("O dado precisa ter pelo menos 2 lados.");
  }

  const value = Number(rng());
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("A função aleatória deve retornar um valor entre 0 e 1.");
  }

  return Math.floor(value * sides) + 1;
}

export function rollDice(count = 1, sides = 6, rng = Math.random) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("A quantidade de dados deve ser positiva.");
  }

  const rolls = Array.from({ length: count }, () => rollDie(sides, rng));
  return {
    rolls,
    total: rolls.reduce((sum, value) => sum + value, 0)
  };
}

export function parseDiceExpression(expression) {
  const match = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(String(expression).trim());
  if (!match) {
    throw new Error(`Expressão de dados inválida: ${expression}`);
  }

  return {
    count: Number(match[1]),
    sides: Number(match[2]),
    modifier: Number(match[3] || 0)
  };
}

export function rollExpression(expression, rng = Math.random) {
  const parsed = parseDiceExpression(expression);
  const result = rollDice(parsed.count, parsed.sides, rng);

  return {
    ...result,
    modifier: parsed.modifier,
    total: result.total + parsed.modifier
  };
}
