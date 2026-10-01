# Livros-Jogos Interativos

Repositório para um motor reutilizável de livros-jogos digitais em português brasileiro.

## Objetivo

Criar uma biblioteca de aventuras interativas com:

- escolhas ramificadas;
- inventário e atributos;
- rolagens de dados;
- combate;
- magia e regras específicas por aventura;
- estados e condições;
- múltiplos finais;
- suporte futuro a modo cooperativo;
- salvamento e retomada de partidas;
- ilustrações e áudio próprios.

## Estrutura

```text
/
├── index.html
├── src/
│   ├── app.js
│   └── style.css
├── docs/
│   ├── ARQUITETURA.md
│   └── FORMATO-DE-JOGO.md
└── jogos/
    ├── catalogo.json
    └── furia-de-principes/
        ├── README.md
        ├── game.json
        └── data/
            ├── colthar.json
            ├── lothar.json
            └── sincronizacao.json
```

## Primeiro projeto

**Fúria de Príncipes** é o primeiro pacote em desenvolvimento. O repositório guarda somente código, estrutura de dados, regras implementadas, resumos técnicos e material original criado para a adaptação. Não deve conter scans ou reprodução integral dos livros.

## Status

Fase 1 — arquitetura do motor e protótipo navegável.
