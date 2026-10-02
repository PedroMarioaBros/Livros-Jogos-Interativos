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
- [x] Aplicar automaticamente os 12 efeitos mágicos ao combate
- [x] Modelar combates cooperativos e múltiplos inimigos
- [ ] Consolidar regras especiais encontradas nas referências
  - [x] Motor genérico de condições e efeitos narrativos
  - [x] Rolagens genéricas e feitiços situacionais
  - [x] Recuperação de pertences confiscados
  - [x] Modificadores especiais de combate por referência
  - [x] Escolhas pós-combate e encaminhamento condicional entre jogadores
  - [x] Perda seletiva de itens e definição direta de atributos
  - [x] Testes de atributo contra rolagens de dados
  - [x] Dois Feitiços de Combate após o Djinn
  - [x] Maldição que impede recuperação de ENERGIA
  - [x] Reflexo com atributos dinâmicos do próprio herói
  - [x] Rolagem compartilhada simples entre os jogadores
  - [x] Ouro conjunto para cobranças compartilhadas
  - [x] Divisão interativa de tesouro entre os dois príncipes
  - [x] Penalidades temporárias até recuperar arma
  - [x] Condições STATUS/AÇÃO com múltiplos valores
  - [x] Dano simultâneo da Bruxa aos dois príncipes
  - [x] Combate cooperativo do Coletor de Impostos com quatro adversários
  - [x] Revisão de marcações obsoletas de suporte em cenas já implementadas
  - [x] Itens empilháveis e comparação de Pedras de Poder entre os príncipes
  - [x] Loja compartilhada com estoque único entre os dois príncipes
  - [x] Limite de séries em combates com prazo narrativo
  - [x] Efeitos condicionais nas sincronizações STATUS/AÇÃO
  - [x] Rolagem especial a cada série de combate
- [x] Extrair referências de Colthar
  - [x] Primeira expansão estrutural: 77 referências cadastradas no banco
  - [x] Segunda expansão estrutural: referências 75–100 conferidas; 102 referências cadastradas no banco
  - [x] Terceira expansão estrutural: referências 101–125 conferidas; 127 referências cadastradas no banco
  - [x] Quarta expansão estrutural: referências 126–150 conferidas; 151 referências cadastradas no banco
  - [x] Quinta expansão estrutural: referências 151–175 conferidas; 176 referências cadastradas no banco
  - [x] Sexta expansão estrutural: referências 176–200 conferidas; 200 referências cadastradas no banco
  - [x] Sétima expansão estrutural: referências 201–225 conferidas; 225 referências cadastradas no banco
  - [x] Oitava expansão estrutural: referências 226–250 conferidas; 250 referências cadastradas no banco
  - [x] Nona expansão estrutural: referências 251–275 conferidas; 275 referências cadastradas no banco
  - [x] Décima expansão estrutural: referências 276–300 conferidas; 300 referências cadastradas no banco
  - [x] Décima primeira expansão estrutural: referências 301–325 conferidas; 325 referências cadastradas no banco
  - [x] Décima segunda expansão estrutural: referências 326–350 conferidas; 350 referências cadastradas no banco
  - [x] Décima terceira expansão estrutural: referências 351–375 conferidas; 375 referências cadastradas no banco
  - [x] Décima quarta expansão estrutural: referências 376–400 conferidas; 400 referências cadastradas no banco
  - [x] Décima quinta expansão estrutural: referências 401–425 conferidas; 425 referências cadastradas no banco
  - [x] Décima sexta expansão estrutural: referências 426–450 conferidas; 450 referências cadastradas no banco
  - [x] Décima sétima expansão estrutural: referências 451–475 conferidas; 475 referências cadastradas no banco
  - [x] Décima oitava expansão estrutural: referências 476–500 conferidas; 500 referências cadastradas no banco
  - [x] Referências 1–500 estruturadas continuamente
- [x] Extrair referências de Lothar
  - [x] Referências 1–500 estruturadas continuamente
- [x] Mapear todas as sincronizações STATUS/AÇÃO
  - [x] Motor genérico de sincronização
  - [x] Primeira varredura de AÇÃO de Lothar
  - [x] Primeiros pontos verificados de STATUS de Colthar (31 e 60)
  - [x] 34 pontos catalogados e conferidos individualmente
  - [x] Varredura final das 1.000 referências concluída com cobertura automática no CI
- [x] Classificar finais, mortes e encontros
  - [x] 95 finais/saídas classificados em death, removed, removed-transition ou success
  - [x] 105 encontros estruturados e 7 encontros explicitamente em revisão
  - [x] CI exige um único sucesso por volume na referência 500 e resolução para encontros completos
- [ ] Testar todos os caminhos alcançáveis
  - [x] Análise automática dos grafos de ambos os volumes
  - [x] Grafo combinado em dupla com rotas cruzadas e STATUS/AÇÃO: 988/1000 nós explicitamente alcançáveis, zero becos sem saída
  - [x] Regressões de morte em combate, transição solo e resultado do outro príncipe
  - [x] Auditoria de runtime nas 989 referências completas: 335 efeitos e 178 condições com suporte reconhecido pelo CI
  - [x] Raio de Dizimação implementado em combate solo/cooperativo; referência 314 confirmada no OCR do item `livros-jogos` do Archive.org
  - [x] Enigma numérico de Lothar 44 migrado para `referenceInput` após confirmação no Archive.org
  - [x] Colthar 19 confirmado no Archive.org com rotas 133 e 243
  - [x] Auditoria reversa de resolução: zero ciclos alcançáveis presos sem final, espera, resposta numérica ou revisão explícita
  - [x] Finais conjuntos e `removed-transition` normalizados no runtime do modo dupla
  - [x] Resultados de combate que movem/removem o parceiro centralizados em `duo.js` e cobertos por regressões reais
  - [x] Smoke test de 104/104 encontros completos e 208 resoluções integrais de combate (vitória/derrota)

## Fase 3 — Interface
- [ ] Biblioteca de aventuras
- [x] Ficha básica de personagem
- [ ] Dados animados
- [x] Combate guiado individual
- [x] Feitiços de Combate selecionáveis para Lothar
- [x] Tela funcional de combate cooperativo
- [x] Feitiços de Combate de Lothar em encontros cooperativos
- [ ] Polimento visual da tela cooperativa e regras especiais remanescentes
- [x] Inventário inicial e recursos na ficha
- [x] Salvamento local
- [x] Histórico de decisões
- [ ] Ilustrações originais por cena
- [ ] Sons e música opcionais

## Fase 4 — Dois jogadores
- [x] Turnos no mesmo aparelho
- [x] Ocultação de informações privadas
- [x] Infraestrutura para pontos de sincronização entre os dois príncipes
- [ ] Pontos de encontro narrativos entre os dois príncipes
  - [x] Sessões independentes de Colthar e Lothar no mesmo aparelho
  - [x] Passagem protegida do aparelho entre jogadores
  - [x] Escolhas coordenadas com destino próprio e do parceiro (partnerTarget), incluindo a referência 287
  - [x] Transição automática pós-saída para modo solo: 64/64 ocorrências via referência 39
  - [x] Rotas dependentes de vitória/derrota do parceiro: Lothar 270 e 493
  - [x] Auditoria de 6 escolhas coordenadas com partnerTarget
- [ ] Sincronização entre dois aparelhos

## Regra de qualidade

Nenhuma referência será marcada como `validada` sem conferência explícita. O motor deve aceitar conteúdo incompleto sem inventar destinos inexistentes.


## Fase 5 — Aplicativo instalável
- [x] Manifesto PWA
- [x] Service Worker
- [x] Cache do motor e dados para funcionamento offline
- [x] Fluxo de instalação pelo navegador quando suportado
- [x] Salvamento local compatível com uso offline
- [ ] Ícones finais em múltiplos tamanhos
- [ ] Empacotamento Android/APK
- [ ] Testes de instalação e atualização em aparelho real
