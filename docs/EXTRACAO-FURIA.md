# Extração técnica — Fúria de Príncipes

## Estratégia

O banco narrativo é construído sem copiar o texto integral dos livros. Para cada referência, extraímos apenas o que o motor precisa:

- número da referência;
- destinos possíveis;
- condições;
- alterações de atributos e recursos;
- combates e estatísticas dos oponentes;
- itens recebidos ou removidos;
- testes de Sorte;
- opções de magia;
- eventos cooperativos;
- alterações de STATUS/AÇÃO;
- tipo de término da aventura.

## Estado atual

### Lothar — O Caminho do Feiticeiro

Foi concluída a primeira varredura específica de comandos de **AÇÃO**.

- 18 referências com alteração explícita de AÇÃO catalogadas;
- 17 delas com leitura suficientemente clara para estruturação;
- referência 217 marcada para revisão visual porque uma condição aparece ambígua no OCR;
- referências 148 e 199 já confirmadas no banco principal do personagem.

Pontos detectados:

`31, 39, 42, 51, 60, 111, 148, 185, 199, 217, 226, 329, 344, 367, 451, 453, 465, 494`

## Próximas varreduras

1. comandos de STATUS no volume de Colthar;
2. ordens de comunicação entre os dois jogadores;
3. combates;
4. Testes de Sorte;
5. alterações de inventário e ouro;
6. opções de feitiços situacionais;
7. mortes e finais;
8. grafo completo de destinos das 500 referências de cada personagem.

## Regra de validação

Quando o OCR for ambíguo, o dado não é adivinhado. Ele é marcado para conferência visual antes de receber o estado `validada`.


### Colthar — O Caminho do Guerreiro

A varredura do lado de STATUS foi iniciada e dois pontos foram confirmados diretamente no texto:

- referência **31**: define STATUS = 19 e aguarda AÇÃO; AÇÃO 1 leva à referência 44 e AÇÃO 39 leva à 421;
- referência **60**: define STATUS = 4 e aguarda AÇÃO; AÇÃO 1 ou 25 leva à 13, AÇÃO 24 leva à 212 e AÇÃO 26 leva à 413.

Esses dois pontos já estão no banco de sincronização e cobertos por testes automatizados.

### Motor cooperativo

Foi criado `src/engine/sync.js`, responsável por:

- localizar o ponto de sincronização de cada personagem;
- aplicar alterações de STATUS/AÇÃO;
- manter STATUS/AÇÃO fixos em 1 no modo solo;
- resolver automaticamente um destino quando o valor recebido do outro jogador satisfaz uma rota;
- deixar a cena em espera quando a outra metade da aventura ainda não produziu o valor necessário.

O protótipo web possui temporariamente um painel de teste manual de STATUS/AÇÃO. Ele será substituído pela comunicação entre os dois jogadores quando a camada de multiplayer for implementada.


## Lote narrativo de Lothar — referências 1 a 116

Foi concluída uma varredura estrutural do início do volume do Feiticeiro.

- referências 1–116 cadastradas no banco, com resumos técnicos próprios;
- referências 148 e 199 já existentes foram preservadas;
- total atual no arquivo de Lothar: **118 referências**;
- escolhas, Testes de Sorte, combates, mortes, itens, custos de MAGIA, feitiços situacionais e instruções entre jogadores foram convertidos em dados;
- referências com OCR duvidoso permanecem marcadas como `parcial` ou `needsManualReview`;
- o texto integral da obra não foi copiado para o repositório.

O motor também passou a interpretar rolagens genéricas e opções de feitiços situacionais encontradas nesse lote.


## Segundo grande lote de Lothar — referências 117 a 200

A árvore do Feiticeiro agora está estruturada continuamente da referência **1 até a 200**.

Neste lote foram incorporados:

- combates individuais e cooperativos;
- Testes de Sorte;
- escolhas dependentes de itens;
- rolagens de 1d6 com múltiplas rotas;
- feitiços situacionais com custo de MAGIA;
- falhas mágicas com alternativas de continuação;
- instruções de passagem para Colthar;
- perda e posterior recuperação de pertences;
- penalidades temporárias de combate;
- mortes e remoções da aventura;
- pontos de sincronização já conhecidos preservados.

Total atual de Lothar: **200 de 500 referências (40%)**.

Referências cujo comportamento exige histórico anterior de itens ou combate continuam marcadas como `parcial` até a cadeia completa ser testada de ponta a ponta.
