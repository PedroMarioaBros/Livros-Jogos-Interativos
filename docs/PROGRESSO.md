# Progresso do projeto

Atualização de referência: 2026-10-02.

As porcentagens abaixo são estimativas de engenharia para um **Fúria de Príncipes completo, testado e instalável**, não apenas para um protótipo. Medidas de conteúdo são calculadas diretamente dos JSONs; estimativas de engenharia usam uma régua conservadora e não são média simples.

## Medidas objetivas

| Medida | Estado atual |
| --- | ---: |
| Colthar — referências estruturadas | 375/500 (75,0%) |
| Colthar — completas/extraídas | 366/500 (73,2%) |
| Colthar — parciais | 9 |
| Colthar — pendentes | 0 |
| Lothar — referências estruturadas | 500/500 (100%) |
| Lothar — completas/extraídas | 496/500 (99,2%) |
| Narrativa combinada — estruturada | 875/1000 (87,5%) |
| Narrativa combinada — completa/extraída | 862/1000 (86,2%) |
| STATUS/AÇÃO catalogados | 29 |
| STATUS/AÇÃO verificados | 29/29 catalogados |
| Feitiços de Combate | 12/12 implementados |

Colthar está contínuo de **1 a 375**, sem lacunas estruturais nesse intervalo. A referência 144 permanece parcial porque o OCR do acervo do Internet Archive preserva a ENERGIA da Formiga-leão, mas não o valor de HABILIDADE; a lacuna não é preenchida por inferência.

## Estado por área

| Área | Progresso |
| --- | ---: |
| Fundação e arquitetura | 100% |
| Motor genérico de livro-jogo | 97% |
| Regras específicas de Fúria de Príncipes | 95% |
| Conteúdo estrutural de Colthar | 75,0% |
| Conteúdo completo/extraído de Colthar | 73,2% |
| Conteúdo estrutural de Lothar | 100% |
| Conteúdo completo/extraído de Lothar | 99,2% |
| Combate individual | 96% |
| Magia de Lothar | 96% |
| Combate cooperativo | 88% |
| Interface funcional | 85% |
| Salvamento e histórico | 95% |
| Dois jogadores no mesmo aparelho | 86% |
| Sincronização entre dois aparelhos | 0% |
| Camada PWA/offline | 70% |
| Empacotamento Android/APK | 0% |
| Ilustrações e áudio finais | 0–5% |
| Testes do motor | 93% |
| Testes da aventura completa | ~63% |

## Percentual global

Para evitar uma média simples enganosa, o acompanhamento global usa pesos fixos:

- conteúdo narrativo e validação: 45%;
- motor e regras: 20%;
- modo local em dupla e sincronizações: 10%;
- interface, salvamento e usabilidade: 10%;
- testes de caminhos e regressão: 10%;
- instalação/empacotamento final: 5%.

Com essa régua, o projeto está em aproximadamente:

- **Fúria de Príncipes completo no mesmo aparelho: ~82%**;
- **aplicativo Android final: ~76% do caminho total**.

Esses percentuais são conservadores: o conteúdo narrativo e os testes de caminhos têm o maior peso, e são hoje o principal trabalho restante.

## Marcos

| Marco | Progresso estimado |
| --- | ---: |
| Motor reutilizável | ~97% |
| Demonstração jogável de Fúria | ~92% |
| Colthar solo completo | ~75% |
| Lothar solo completo | ~94% |
| Fúria completo no mesmo aparelho | ~82% |
| Aplicativo Android final | ~76% |

## Próximos gargalos

1. continuar Colthar a partir da referência 376;
2. fechar referências parciais/pendentes sem inventar dados ausentes;
3. mapear novos pontos STATUS/AÇÃO conforme surgirem no volume de Colthar;
4. ampliar testes de caminhos alcançáveis;
5. polir interface cooperativa;
6. criar ícones finais e empacotar/testar APK Android.

## Critério de qualidade

Nenhuma referência é marcada como `validada` sem conferência explícita. OCR duvidoso permanece como `parcial`, `needsManualReview`, `encounterNeedsReview` ou equivalente até conferência visual.
