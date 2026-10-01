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


## Terceiro grande lote de Lothar — referências 201 a 300

A árvore do Feiticeiro está agora estruturada continuamente da referência **1 até a 300**.

Este lote acrescentou:

- mais combates individuais e cooperativos;
- condições por item;
- escolhas conjuntas;
- instruções condicionais para Colthar;
- rotas por Teste de Sorte e rolagens simples;
- perda e recuperação de equipamentos;
- escolhas após vitória em combate;
- feitiços com alternativas após falha;
- efeitos diretos sobre HABILIDADE, ENERGIA e MAGIA;
- finais e remoções da aventura.

Total atual de Lothar: **300 de 500 referências (60%)**.

A referência 217 continua marcada para revisão visual por ambiguidade de OCR. Referências como 246 e 250 permanecem parciais quando exigem estado histórico ou interação econômica que ainda será consolidada no motor.


## Quarto lote de Lothar — referências 301 a 400

A estrutura narrativa foi ampliada continuamente até a referência **400**.

Foram acrescentados novos pontos de sincronização, combates cooperativos, rolagens contra atributos, objetos de uso especial, caminhos condicionais e uma habilidade permanente conquistada após a vitória sobre o Djinn.

## Quinto lote de Lothar — referências 401 a 500

A extração estrutural do volume **O Caminho do Feiticeiro** foi concluída.

- total: **500 de 500 referências cadastradas**;
- referência 500 identificada como final de sucesso de Lothar;
- todos os números de 1 a 500 possuem uma entrada no banco;
- pontos de AÇÃO conhecidos foram preservados;
- mortes, remoções, combates, escolhas, magia, itens e instruções cooperativas foram representados estruturalmente;
- situações cuja leitura do OCR é duvidosa continuam marcadas como `parcial` ou `needsManualReview`, em vez de serem adivinhadas.

A conclusão da extração estrutural **não significa que o volume esteja totalmente validado ou testado**. As próximas etapas para Lothar são revisão visual das referências ambíguas, consolidação de exceções ainda parciais e teste automatizado do grafo completo.


## Retomada de Colthar — referências iniciais

Após a conclusão estrutural das 500 referências de Lothar, a extração voltou para **O Caminho do Guerreiro**.

- total de Colthar passou de **44 para 77 referências cadastradas**;
- lacunas do início do volume foram preenchidas até a faixa da referência 75;
- a referência 2 usa a correção conhecida da edição original: **256 para as colinas** e **140 para a floresta**, em vez dos destinos trocados na impressão;
- referências com OCR insuficiente, como 7, 19 e 75, continuam marcadas para revisão;
- o Reflexo da referência 5 passou a usar dinamicamente os valores atuais de HABILIDADE e ENERGIA de Colthar;
- a rolagem compartilhada da referência 71 passou a ser executável na interface.

A extração continua usando apenas estrutura, efeitos e resumos técnicos, sem copiar o texto integral da obra.


### Revisão do início de Colthar e economia compartilhada

A revisão do trecho já extraído confirmou a referência **7** como combate contra **Moscas Gigantes — HABILIDADE 5, ENERGIA 4**, com vitória levando à referência 386.

Também foi consolidado o tratamento das finanças conjuntas nas referências em que os dois irmãos precisam reunir ouro. O motor agora soma o ouro dos dois personagens para verificar cobranças, permite definir quanto cada um paga e possui uma etapa interativa para dividir moedas e objetos encontrados em conjunto.

O tesouro ainda não dividido também passa a fazer parte do salvamento da partida.
