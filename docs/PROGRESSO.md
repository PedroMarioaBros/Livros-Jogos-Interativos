# Progresso do projeto

Atualização de referência: 2026-10-02.

As porcentagens abaixo são estimativas de engenharia para um **Fúria de Príncipes completo, testado e instalável**, não apenas para um protótipo. Medidas de conteúdo são calculadas diretamente dos JSONs; estimativas de engenharia usam uma régua conservadora e não são média simples.

## Medidas objetivas

| Medida | Estado atual |
| --- | ---: |
| Colthar — referências estruturadas | 500/500 (100%) |
| Colthar — completas/extraídas | 489/500 (97,8%) |
| Colthar — parciais | 11 |
| Colthar — pendentes | 0 |
| Lothar — referências estruturadas | 500/500 (100%) |
| Lothar — completas/extraídas | 497/500 (99,4%) |
| Narrativa combinada — estruturada | 1000/1000 (100%) |
| Narrativa combinada — completa/extraída | 986/1000 (98,6%) |
| STATUS/AÇÃO catalogados | 34 |
| STATUS/AÇÃO verificados | 34/34 catalogados |
| Feitiços de Combate | 12/12 implementados |

Colthar está contínuo de **1 a 500**, sem lacunas estruturais. Isso conclui 100% da estrutura narrativa dos dois volumes. A varredura final de STATUS/AÇÃO também foi concluída: existem 34 pontos catalogados e 34 verificados; o CI agora exige cobertura para todo efeito inline que altere STATUS ou AÇÃO. Ainda existem 11 referências parciais em Colthar (19, 144, 168, 169, 220, 241, 252, 263, 266, 378 e 403) e 3 em Lothar (44, 314 e 347); essas lacunas permanecem explícitas porque o OCR não permite validação segura.

## Estado por área

| Área | Progresso |
| --- | ---: |
| Fundação e arquitetura | 100% |
| Motor genérico de livro-jogo | 97% |
| Regras específicas de Fúria de Príncipes | 95% |
| Conteúdo estrutural de Colthar | 100% |
| Conteúdo completo/extraído de Colthar | 97,8% |
| Conteúdo estrutural de Lothar | 100% |
| Conteúdo completo/extraído de Lothar | 99,4% |
| Combate individual | 96% |
| Magia de Lothar | 96% |
| Combate cooperativo | 88% |
| Interface funcional | 85% |
| Salvamento e histórico | 95% |
| Dois jogadores no mesmo aparelho | 88% |
| Sincronização entre dois aparelhos | 0% |
| Camada PWA/offline | 70% |
| Empacotamento Android/APK | 0% |
| Ilustrações e áudio finais | 0–5% |
| Testes do motor | 94% |
| Testes da aventura completa | ~79% |

## Percentual global

Para evitar uma média simples enganosa, o acompanhamento global usa pesos fixos:

- conteúdo narrativo e validação: 45%;
- motor e regras: 20%;
- modo local em dupla e sincronizações: 10%;
- interface, salvamento e usabilidade: 10%;
- testes de caminhos e regressão: 10%;
- instalação/empacotamento final: 5%.

Com essa régua, o projeto está em aproximadamente:

- **Fúria de Príncipes completo no mesmo aparelho: ~88%**;
- **aplicativo Android final: ~82% do caminho total**.

Esses percentuais são conservadores: o conteúdo narrativo e os testes de caminhos têm o maior peso, e são hoje o principal trabalho restante.

## Marcos

| Marco | Progresso estimado |
| --- | ---: |
| Motor reutilizável | ~97% |
| Demonstração jogável de Fúria | ~92% |
| Colthar solo completo | ~95% |
| Lothar solo completo | ~94% |
| Fúria completo no mesmo aparelho | ~88% |
| Aplicativo Android final | ~82% |

## Próximos gargalos

1. fechar as 14 referências parciais dos dois volumes por conferência visual, sem inventar dados;
2. ampliar testes de caminhos alcançáveis e encontros cruzados;
3. polir interface cooperativa e mensagens de regras especiais;
4. criar ícones finais e empacotar/testar APK Android;
5. iniciar a sincronização entre dois aparelhos depois que o modo local estiver estabilizado.

## Critério de qualidade

Nenhuma referência é marcada como `validada` sem conferência explícita. OCR duvidoso permanece como `parcial`, `needsManualReview`, `encounterNeedsReview` ou equivalente até conferência visual.
