# Fúria de Príncipes — fila ativa de validação manual

Atualização: 2026-10-05.

Este documento registra somente as pendências de fonte que **não puderam ser fechadas com confirmação suficiente** após cruzamento de dados. Ele existe para impedir que futuras rodadas repitam buscas já realizadas ou transformem uma reconstrução plausível em dado definitivo.

## Estado atual

- Lothar: 500/500 referências completas.
- Colthar: 491/500 referências completas.
- Pendências estruturais: 9 referências, todas de Colthar.
- Colthar 117 não entra na contagem acima porque está `extraida`, mas continua com `needsManualReview` para conferência visual final.

## Fontes já esgotadas nesta rodada

Foram confrontados, quando tecnicamente acessíveis:

- OCR derivado do item `livros-jogos` do Internet Archive;
- referências relacionadas dentro do próprio volume de Colthar;
- referências correspondentes no volume de Lothar;
- transcrição/scan alternativo localizado no Scribd;
- índice da Biblioteca Élfica, que confirma a existência de um PDF completo do Caminho do Guerreiro;
- espelho público antigo da Biblioteca Élfica no GitHub;
- buscas pelo original em inglês e por digitalizações alternativas.

O PDF completo do Guerreiro foi localizado na Biblioteca Élfica, mas as páginas individuais desse arquivo não ficaram acessíveis às ferramentas desta sessão. Portanto, **nenhum número foi extraído dele por suposição**.

## Fila de validação

| Ref. | Dado já confirmado | Dado exato ainda faltante | Impacto |
| ---: | --- | --- | --- |
| 144 | Formiga-leão Gigante; ENERGIA 8; vitória → 359 | HABILIDADE do inimigo | combate |
| 168 | Bruxa; HABILIDADE 10; vitória → 253 | ENERGIA da Bruxa | combate |
| 169 | Zumbi 1 = 9/6; Zumbi 2 = 8/6; Zumbi 3 = ?/4; escolhas pós-vitória → 358 ou 119 | HABILIDADE do terceiro Zumbi | combate |
| 220 | três Espectros das Sombras; energias 4/4/4; segundo e terceiro com HABILIDADE 8; vitória → 318 | HABILIDADE do primeiro Espectro | combate |
| 241 | rolagem 1d6; 1 → 317; valor corrompido → 178; 3/4/5 → 269; 6 → 84 | confirmar visualmente qual face do dado leva a 178 | rota |
| 252 | Lobisomem 1 = 10/6; Lobisomem 2 = ?/6; machado de prata concede +2 HABILIDADE; vitória → 426 | HABILIDADE do segundo Lobisomem | combate |
| 263 | cruz de ouro + livro sagrado subjugam o Vampiro | número da referência de destino após “Volte para” | rota |
| 266 | Homem das Cavernas 1 = ?/6; 2 = 8/6; 3 = 8/4; vitória → 65 | HABILIDADE do primeiro inimigo | combate |
| 378 | Homem-camaleão = 10/6; Pedra de Poder; +1 HABILIDADE; +1 SORTE | destino após a vitória | rota |

## Prioridade de conferência

As referências **241, 263 e 378** têm prioridade máxima porque o dado ausente altera diretamente o grafo de navegação. As referências **144, 168, 169, 220, 252 e 266** dependem de atributos de combate e devem permanecer parciais até leitura visual.

## Regra para fechamento

Uma referência desta lista só sai da fila quando o valor ausente for confirmado por pelo menos uma fonte visual/textual suficientemente clara ou por correspondência inequívoca com outra passagem da própria obra.

Não usar:

- progressão provável de dificuldade;
- repetição de atributos de monstros semelhantes;
- sequência numérica aparente;
- “o valor mais lógico”;
- correção automática de OCR sem confirmação visual.

Depois da confirmação, atualizar o JSON correspondente, remover as marcações de revisão pertinentes, acrescentar regressão automatizada quando fizer sentido e atualizar `docs/PROGRESSO.md`.
