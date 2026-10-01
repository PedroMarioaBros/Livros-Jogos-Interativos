# Arquitetura

O projeto é dividido em duas camadas.

## 1. Motor

Responsável por comportamentos reutilizáveis entre livros:

- navegação entre cenas;
- escolhas condicionais;
- inventário;
- atributos;
- dados;
- combate;
- variáveis globais;
- estados por personagem;
- persistência;
- finais;
- apresentação de imagens, efeitos e áudio.

O motor não deve conhecer detalhes de uma aventura específica.

## 2. Pacotes de jogo

Cada aventura fica em `jogos/<slug>/` e fornece:

- metadados;
- personagens;
- regras específicas;
- nós narrativos;
- condições;
- efeitos;
- sincronizações especiais;
- referências a assets próprios.

## Fúria de Príncipes

Este jogo exige uma extensão cooperativa do motor.

Estado compartilhado inicial:

```json
{
  "status": 0,
  "acao": 0
}
```

No modo solo, o pacote poderá sobrescrever esses valores conforme as regras documentadas da aventura.

## Princípio de validação

Nenhuma ligação narrativa deve ser adicionada como fato sem conferência da fonte de trabalho.

Estados possíveis de uma referência:

- `pendente`
- `extraida`
- `validada`
- `implementada`
- `testada`

Isso permite avançar sem misturar dados confirmados com hipóteses.
