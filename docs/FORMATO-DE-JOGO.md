# Formato de jogo

Cada jogo possui um `game.json` com metadados e regras gerais.

## Nó narrativo

Estrutura proposta:

```json
{
  "id": 1,
  "estado": "validada",
  "resumo": "Resumo técnico da cena.",
  "choices": [
    {
      "label": "Descrição curta da decisão",
      "target": 148,
      "conditions": [],
      "effects": []
    }
  ]
}
```

## Condições

Exemplos:

```json
{ "type": "has_item", "item": "chave" }
{ "type": "stat_gte", "stat": "energia", "value": 4 }
{ "type": "shared_equals", "key": "status", "value": 2 }
```

## Efeitos

Exemplos:

```json
{ "type": "add_item", "item": "chave" }
{ "type": "change_stat", "stat": "energia", "delta": -2 }
{ "type": "set_shared", "key": "acao", "value": 23 }
```

## Conteúdo protegido

Os arquivos de dados do repositório devem priorizar:

- resumos técnicos próprios;
- números de referência;
- ligações entre nós;
- estados, itens e regras;
- textos novos de interface.

Não incluir texto integral ou scans das obras-fonte.
