# Progresso do projeto

Atualização de referência: 2026-10-02.

As porcentagens abaixo são estimativas de engenharia para um **Fúria de Príncipes completo, testado e instalável**, não apenas para um protótipo. Medidas de conteúdo são calculadas diretamente dos JSONs; estimativas de engenharia usam uma régua conservadora e não são média simples.

## Medidas objetivas

| Medida | Estado atual |
| --- | ---: |
| Colthar — referências estruturadas | 500/500 (100%) |
| Colthar — completas/extraídas | 490/500 (98,0%) |
| Colthar — parciais | 10 |
| Colthar — pendentes | 0 |
| Lothar — referências estruturadas | 500/500 (100%) |
| Lothar — completas/extraídas | 499/500 (99,8%) |
| Narrativa combinada — estruturada | 1000/1000 (100%) |
| Narrativa combinada — completa/extraída | 989/1000 (98,9%) |
| STATUS/AÇÃO catalogados | 34 |
| STATUS/AÇÃO verificados | 34/34 catalogados |
| Feitiços de Combate | 12/12 implementados |
| Grafo combinado — alcance explícito | 988/1000 (98,8%) |
| Finais/saídas classificados | 95/95 |
| Encontros estruturados | 105 |
| Encontros aguardando revisão visual | 7 |
| Encontros completos executados no CI | 104/104 |
| Simulações integrais de combate | 208/208 (104 vitórias + 104 derrotas) |
| Testes automatizados | 148/148 |
| Transições pós-saída suportadas | 64/64 |
| Rotas por resultado do parceiro suportadas | 2/2 cenas (4 rotas) |
| Referências completas auditadas pelo runtime | 989/989 |
| Referências completas executadas em smoke test narrativo | 989/989 |
| Rota completa com save/load intermediário | 1/1 validada até o final 500 |
| Auditoria PWA/offline | 28 recursos de shell, 14 módulos JS, 5 dependências de jogo e 3 ícones — 0 problemas/warnings |
| Bootstrap Android/Capacitor | webDir `www`, 10 arquivos críticos e 28 recursos auditados — 0 problemas |
| Rotas narrativas conjuntas completas executadas | 2/2 finais de sucesso (Colthar e Lothar → 500) |
| Instâncias de efeitos auditadas | 335 |
| Instâncias de condições auditadas | 178 |
| Escolhas coordenadas auditadas | 6 |

Colthar está contínuo de **1 a 500**, sem lacunas estruturais. Isso conclui 100% da estrutura narrativa dos dois volumes. A varredura final de STATUS/AÇÃO também foi concluída: existem 34 pontos catalogados e 34 verificados; o CI agora exige cobertura para todo efeito inline que altere STATUS ou AÇÃO. Ainda existem 10 referências parciais em Colthar (144, 168, 169, 220, 241, 252, 263, 266, 378 e 403) e 1 em Lothar (347). Colthar 19 e Lothar 314/44 foram promovidas após conferência do OCR derivado do próprio item `livros-jogos` do Archive.org.

## Estado por área

| Área | Progresso |
| --- | ---: |
| Fundação e arquitetura | 100% |
| Motor genérico de livro-jogo | 98% |
| Regras específicas de Fúria de Príncipes | 96% |
| Conteúdo estrutural de Colthar | 100% |
| Conteúdo completo/extraído de Colthar | 98,0% |
| Conteúdo estrutural de Lothar | 100% |
| Conteúdo completo/extraído de Lothar | 99,8% |
| Combate individual | 97% |
| Magia de Lothar | 96% |
| Combate cooperativo | 91% |
| Interface funcional | 88% |
| Salvamento e histórico | 97% |
| Dois jogadores no mesmo aparelho | 94% |
| Sincronização entre dois aparelhos | 0% |
| Camada PWA/offline | 82% |
| Empacotamento Android/APK | 12% |
| Ilustrações e áudio finais | 0–5% |
| Testes do motor | 99% |
| Testes da aventura completa | ~94% |

## Percentual global

Para evitar uma média simples enganosa, o acompanhamento global usa pesos fixos:

- conteúdo narrativo e validação: 45%;
- motor e regras: 20%;
- modo local em dupla e sincronizações: 10%;
- interface, salvamento e usabilidade: 10%;
- testes de caminhos e regressão: 10%;
- instalação/empacotamento final: 5%.

Com essa régua, o projeto está em aproximadamente:

- **Fúria de Príncipes completo no mesmo aparelho: ~92%**;
- **aplicativo Android final: ~86% do caminho total**.

A classificação automática agora cobre 95 finais/saídas e 105 encontros estruturados. Há exatamente um final de sucesso por volume, ambos na referência 500; 7 encontros de Colthar permanecem explicitamente em revisão visual. O grafo combinado em dupla distingue corretamente rotas próprias e rotas do parceiro: 988 de 1000 referências são alcançáveis por transições explícitas, sem alvos inválidos, sem becos sem saída não explicados e sem ciclos alcançáveis presos fora de qualquer resolução. As 12 restantes descendem de apenas duas entradas não explícitas por resposta numérica: Colthar 465 e Lothar 18. O runtime do modo dupla agora executa 64 transições pós-saída para a referência 39 e as duas cenas dependentes do resultado do parceiro (Lothar 270 e 493). Uma auditoria automática adicional cobre as 989 referências completas: 335 instâncias de efeitos, 178 condições, 4 rotas por resultado do parceiro e 6 escolhas coordenadas são validadas contra o catálogo de recursos suportados pelo motor. Derrotas fatais em combate individual removem corretamente o príncipe ativo antes de o outro continuar. Finais `removed-transition` também removem corretamente o personagem, e mortes conjuntas diretas removem ambos os príncipes sem exigir handoff intermediário. O CI também instancia todos os 104 encontros completos e executa 208 resoluções integrais determinísticas — uma vitória e uma derrota para cada encontro — além da suíte unitária e das auditorias. Além disso, as 989 referências completas passam por execução real de efeitos, recompensas, condições, escolhas e resoluções condicionais sem retornar recursos não suportados. Duas rotas conjuntas completas são reproduzidas no CI desde a referência 1 até os dois finais de sucesso 500. A rota de Colthar preserva STATUS/AÇÃO, inventário, flags, tesouro compartilhado, instruções cruzadas, morte de Lothar e continuação solo; a rota de Lothar valida pagamentos, três feitiços situacionais, morte de Colthar, STATUS=1 e continuação solo até 500. A rota de Lothar também é interrompida na referência 191, serializada, restaurada como sessão dupla e retomada até 500 preservando ouro, MAGIA, inventário, STATUS/AÇÃO, referências e remoção do parceiro. A PWA passa por auditoria automática de integridade do cache: todos os recursos/imports/dependências necessários ao jogo estão cobertos. Os ícones PNG reais 192×192 e 512×512 já estão no manifesto e no cache, com dimensões verificadas pelo CI. O bootstrap Android usa Capacitor com `webDir` gerado em `www/`, configuração e assets auditados; ainda faltam gerar o projeto nativo, produzir o primeiro APK e testar instalação/atualização em aparelho real. Esses percentuais continuam conservadores porque ainda faltam execução de caminhos completos, conferência das 11 referências parciais restantes e empacotamento final.

## Marcos

| Marco | Progresso estimado |
| --- | ---: |
| Motor reutilizável | ~98% |
| Demonstração jogável de Fúria | ~92% |
| Colthar solo completo | ~95% |
| Lothar solo completo | ~94% |
| Fúria completo no mesmo aparelho | ~92% |
| Aplicativo Android final | ~86% |

## Próximos gargalos

1. fechar as 11 referências parciais restantes dos dois volumes por conferência da fonte, sem inventar dados;
2. ampliar execução de caminhos narrativos completos além da cobertura integral dos encontros;
3. polir interface cooperativa e mensagens de regras especiais;
4. criar ícones finais e empacotar/testar APK Android;
5. iniciar a sincronização entre dois aparelhos depois que o modo local estiver estabilizado.

## Critério de qualidade

Nenhuma referência é marcada como `validada` sem conferência explícita. OCR duvidoso permanece como `parcial`, `needsManualReview`, `encounterNeedsReview` ou equivalente até conferência visual.
