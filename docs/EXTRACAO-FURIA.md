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
