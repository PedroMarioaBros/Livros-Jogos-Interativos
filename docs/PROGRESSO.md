# Progresso do projeto

Atualização de referência: 2026-10-04.

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
| Referências extraídas com revisão manual adicional | 1 (Colthar 117) |
| Encontros completos executados no CI | 104/104 |
| Simulações integrais de combate | 208/208 (104 vitórias + 104 derrotas) |
| Testes automatizados | 154/154 |
| Transições pós-saída suportadas | 64/64 |
| Rotas por resultado do parceiro suportadas | 2/2 cenas (4 rotas) |
| Referências completas auditadas pelo runtime | 989/989 |
| Referências completas executadas em smoke test narrativo | 989/989 |
| Rota completa com save/load intermediário | 1/1 validada até o final 500 |
| Auditoria PWA/offline | 28 recursos de shell, 14 módulos JS, 5 dependências de jogo e 3 ícones — 0 problemas/warnings |
| Bootstrap Android/Capacitor | webDir `www`, 10 arquivos críticos e 28 recursos auditados — 0 problemas |
| Primeiro APK Android de debug | gerado no CI, assinatura v2 válida, applicationId/SDKs auditados |
| Integridade do APK | SHA-256 gerado e conferido; APK + checksum + badging publicados como artefato |
| Smoke test Android em emulador | instalação, abertura, processo ativo, Activity em primeiro plano e captura de tela — OK |
| Persistência/offline no APK | partida Solo/Colthar salva, processo encerrado, modo avião ativado, APK reaberto e save restaurado na referência 1 — OK |
| Atualização do APK preservando dados | v1 atualizada para v2 (`versionCode 2` / `versionName 1.0.1`) com save preservado na referência 1 — OK |
| Pipeline Android release | APK + AAB release gerados, assinados com chave efêmera de CI, assinatura/metadados/checksums validados — OK |
| Assinatura de produção | workflow manual pronto para receber keystore e credenciais via GitHub Secrets; chave definitiva ainda não configurada |
| Ícones nativos Android | launchers por densidade + adaptive icons gerados via `@capacitor/assets` e auditados no CI — OK |
| Teste físico Android v1→v2 | instalação, abertura, gameplay, save/load e atualização preservando save — OK por teste manual em aparelho real |
| Atualização física v2→v3 entre execuções do CI | bloqueada corretamente pelo Android por assinatura debug diferente (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) |
| Preview Android lado a lado | `io.github.pedromariabros.livrosjogos.preview`, versionCode 3 / versionName `1.0.2-preview` — gerada e validada no CI sem substituir a v2 |
| Offline em aparelho físico | ainda não verificado manualmente |
| UX de Teste de Sorte | ação geral removida; teste contextual com cálculo persistente antes/depois da navegação — OK no CI |
| UX de provisões | estoque inicial/atual explícito, +2 ENERGIA explicado e consumo bloqueado durante combate — OK no CI |
| Morte narrativa | finais `death` identificados explicitamente, separados de derrota por ENERGIA 0 — OK no CI |
| Rotas narrativas conjuntas completas executadas | 2/2 finais de sucesso (Colthar e Lothar → 500) |
| Instâncias de efeitos auditadas | 335 |
| Instâncias de condições auditadas | 178 |
| Escolhas coordenadas auditadas | 6 |

Colthar está contínuo de **1 a 500**, sem lacunas estruturais. Isso conclui 100% da estrutura narrativa dos dois volumes. A varredura final de STATUS/AÇÃO também foi concluída: existem 34 pontos catalogados e 34 verificados; o CI agora exige cobertura para todo efeito inline que altere STATUS ou AÇÃO. Ainda existem 10 referências parciais em Colthar (144, 168, 169, 220, 241, 252, 263, 266, 378 e 403) e 1 em Lothar (347). Além delas, Colthar 117 permanece `extraida`, mas agora está marcada com `needsManualReview` após o teste físico: os atributos dos dois Gárgulas, o combate sucessivo e a ausência de regras especiais/alternativas precisam ser conferidos visualmente na fonte original antes de qualquer validação definitiva ou rebalanceamento. Colthar 19 e Lothar 314/44 foram promovidas após conferência do OCR derivado do próprio item `livros-jogos` do Archive.org.

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
| Interface funcional | 92% |
| Polimento visual mobile | 45% |
| Salvamento e histórico | 97% |
| Dois jogadores no mesmo aparelho | 94% |
| Sincronização entre dois aparelhos | 0% |
| Camada PWA/offline | 82% |
| Empacotamento Android/APK | 95% |
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
- **aplicativo Android final: ~90% do caminho total**.

A classificação automática agora cobre 95 finais/saídas e 105 encontros estruturados. Há exatamente um final de sucesso por volume, ambos na referência 500; 7 encontros de Colthar permanecem explicitamente em revisão visual. O grafo combinado em dupla distingue corretamente rotas próprias e rotas do parceiro: 988 de 1000 referências são alcançáveis por transições explícitas, sem alvos inválidos, sem becos sem saída não explicados e sem ciclos alcançáveis presos fora de qualquer resolução. As 12 restantes descendem de apenas duas entradas não explícitas por resposta numérica: Colthar 465 e Lothar 18. O runtime do modo dupla agora executa 64 transições pós-saída para a referência 39 e as duas cenas dependentes do resultado do parceiro (Lothar 270 e 493). Uma auditoria automática adicional cobre as 989 referências completas: 335 instâncias de efeitos, 178 condições, 4 rotas por resultado do parceiro e 6 escolhas coordenadas são validadas contra o catálogo de recursos suportados pelo motor. Derrotas fatais em combate individual removem corretamente o príncipe ativo antes de o outro continuar. Finais `removed-transition` também removem corretamente o personagem, e mortes conjuntas diretas removem ambos os príncipes sem exigir handoff intermediário. O CI também instancia todos os 104 encontros completos e executa 208 resoluções integrais determinísticas — uma vitória e uma derrota para cada encontro — além da suíte unitária e das auditorias. Além disso, as 989 referências completas passam por execução real de efeitos, recompensas, condições, escolhas e resoluções condicionais sem retornar recursos não suportados. Duas rotas conjuntas completas são reproduzidas no CI desde a referência 1 até os dois finais de sucesso 500. A rota de Colthar preserva STATUS/AÇÃO, inventário, flags, tesouro compartilhado, instruções cruzadas, morte de Lothar e continuação solo; a rota de Lothar valida pagamentos, três feitiços situacionais, morte de Colthar, STATUS=1 e continuação solo até 500. A rota de Lothar também é interrompida na referência 191, serializada, restaurada como sessão dupla e retomada até 500 preservando ouro, MAGIA, inventário, STATUS/AÇÃO, referências e remoção do parceiro. A PWA passa por auditoria automática de integridade do cache: todos os recursos/imports/dependências necessários ao jogo estão cobertos. Os ícones PNG reais 192×192 e 512×512 já estão no manifesto e no cache, com dimensões verificadas pelo CI. O empacotamento Android usa Capacitor com `webDir` gerado em `www/`. O CI já gera o projeto nativo, sincroniza os assets, compila `app-debug.apk`, verifica assinatura APK v2, `applicationId`, minSdk 24, target/compileSdk 36 e gera SHA-256 antes de publicar o artefato. O mesmo pipeline também instala o APK em um emulador Android, abre o aplicativo, confirma processo ativo e Activity em primeiro plano e salva capturas/árvores de UI como evidência. O smoke test agora cria uma partida Solo com Colthar, salva na referência 1, encerra o processo, ativa modo avião, reabre o APK e carrega o save, confirmando a restauração da referência 1 sem rede. O CI também gera uma v1 e uma v2 do APK, instala a v2 por cima da v1 com a mesma assinatura debug e confirma `versionCode 2`, `versionName 1.0.1` e preservação do save na referência 1. Um pipeline separado de release já gera APK e AAB, injeta configuração de assinatura por variáveis de ambiente, valida assinatura, applicationId, minSdk/targetSdk, versionCode/versionName, ausência de `application-debuggable` e checksums. Em pull requests ele usa uma chave efêmera marcada como não distribuível; em execução manual o mesmo pipeline aceita a chave definitiva via GitHub Secrets. A instalação, abertura, gameplay, save/load e atualização v1→v2 já foram validados manualmente em aparelho Android físico, com preservação do save. Um teste posterior de atualização v2→v3 produzida em outra execução do CI revelou corretamente um bloqueio de assinatura: as chaves debug efêmeras de execuções distintas não coincidem. O workflow agora aceita opcionalmente uma chave debug estável pelo secret `ANDROID_TEST_DEBUG_KEYSTORE_BASE64` e também gera uma Preview com package separado para testes lado a lado sem tocar nos dados da v2. A primeira rodada de correções baseada nos testes físicos removeu o Teste de Sorte geral da ficha, mantém somente o teste contextual exigido pela narrativa, preserva na tela o cálculo completo de Sorte/rolagens/dano após a mudança de referência, diferencia morte narrativa de ENERGIA 0 e torna o estoque/efeito das provisões explícito, bloqueando consumo durante combate. A suíte subiu para 154/154 testes. Ainda faltam verificar offline no aparelho físico, configurar a chave debug estável para continuidade dos testes, configurar a chave definitiva de produção, validar manualmente Colthar 117 contra a fonte e continuar o polimento visual mobile. Esses percentuais continuam conservadores porque ainda faltam execução de caminhos completos, conferência das 11 referências parciais restantes e empacotamento final.

## Marcos

| Marco | Progresso estimado |
| --- | ---: |
| Motor reutilizável | ~98% |
| Demonstração jogável de Fúria | ~92% |
| Colthar solo completo | ~95% |
| Lothar solo completo | ~94% |
| Fúria completo no mesmo aparelho | ~92% |
| Aplicativo Android final | ~90% |

## Próximos gargalos

1. fechar as 11 referências parciais restantes e validar manualmente Colthar 117 contra a fonte, sem inventar dados;
2. ampliar execução de caminhos narrativos completos além da cobertura integral dos encontros;
3. redesenhar a interface mobile após o primeiro teste físico, reduzindo confusão visual e aproximando a experiência de um jogo final;
4. verificar offline em Android físico, configurar assinatura debug estável para testes entre builds e depois a chave definitiva de produção;
5. iniciar a sincronização entre dois aparelhos depois que o modo local estiver estabilizado.

## Critério de qualidade

Nenhuma referência é marcada como `validada` sem conferência explícita. OCR duvidoso permanece como `parcial`, `needsManualReview`, `encounterNeedsReview` ou equivalente até conferência visual. O procedimento obrigatório está formalizado em `docs/VALIDACAO_FONTES.md`: OCR/leitura ambígua sem confirmação confiável deve ser levado ao usuário para validação visual da página, nunca completado por suposição.
