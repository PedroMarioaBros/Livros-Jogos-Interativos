# Roadmap

## Fase 1 — Fundação
- [x] Repositório único para múltiplos livros-jogos
- [x] Catálogo de jogos
- [x] Motor web mínimo
- [x] Seleção solo/dupla
- [x] Seleção de personagem
- [x] Rolagem inicial de atributos
- [x] Estado compartilhado STATUS/AÇÃO
- [x] Estrutura de dados separada por personagem
- [x] Validador automático
- [x] Testes unitários e CI no GitHub Actions

## Fase 2 — Fúria de Príncipes
- [x] Registrar fórmulas de atributos dos dois príncipes
- [x] Registrar recursos/equipamentos iniciais
- [x] Modelar núcleo de dados e rolagens
- [x] Modelar Teste de Sorte
- [x] Modelar núcleo de combate individual
- [x] Modelar provisões e recuperação de ENERGIA
- [x] Catalogar os 12 Feitiços de Combate
- [x] Modelar custo, falha e limite de Feitiço de Combate
- [ ] Aplicar automaticamente os 12 efeitos mágicos ao combate
- [x] Modelar combates cooperativos e múltiplos inimigos
- [ ] Consolidar regras especiais encontradas nas referências
  - [x] Motor genérico de condições e efeitos narrativos
- [ ] Extrair referências de Colthar
  - [x] Primeiro lote estrutural: 44 referências cadastradas no banco
- [ ] Extrair referências de Lothar
- [ ] Mapear todas as sincronizações STATUS/AÇÃO
  - [x] Motor genérico de sincronização
  - [x] Primeira varredura de AÇÃO de Lothar
  - [x] Primeiros pontos verificados de STATUS de Colthar (31 e 60)
- [ ] Classificar finais, mortes e encontros
- [ ] Testar todos os caminhos alcançáveis

## Fase 3 — Interface
- [ ] Biblioteca de aventuras
- [x] Ficha básica de personagem
- [ ] Dados animados
- [x] Combate guiado individual
- [ ] Tela completa de combate cooperativo
- [x] Inventário inicial e recursos na ficha
- [x] Salvamento local
- [x] Histórico de decisões
- [ ] Ilustrações originais por cena
- [ ] Sons e música opcionais

## Fase 4 — Dois jogadores
- [ ] Turnos no mesmo aparelho
- [ ] Ocultação de informações privadas
- [x] Infraestrutura para pontos de sincronização entre os dois príncipes
- [ ] Pontos de encontro narrativos entre os dois príncipes
- [ ] Sincronização entre dois aparelhos

## Regra de qualidade

Nenhuma referência será marcada como `validada` sem conferência explícita. O motor deve aceitar conteúdo incompleto sem inventar destinos inexistentes.
