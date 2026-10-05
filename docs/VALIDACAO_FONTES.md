# Procedimento permanente de validação de fontes

Este documento define a regra obrigatória para análise, extração e validação dos livros de **Fúria de Príncipes** e de qualquer outro livro-jogo incorporado ao projeto.

## Regra fundamental

**OCR ambíguo + ausência de confirmação confiável = validação manual do usuário.**

Nunca transformar uma hipótese, dedução ou reconstrução plausível em dado definitivo apenas para completar uma referência.

É preferível manter um ponto pendente a introduzir silenciosamente uma informação errada no jogo.

## Ordem obrigatória de confirmação

Quando uma referência, regra, atributo, combate, destino, item, número ou outro trecho estiver ilegível, ambíguo ou incompleto:

1. reler a própria página/documento-fonte;
2. consultar páginas relacionadas do mesmo livro quando elas puderem esclarecer a informação;
3. buscar confirmação em outra fonte confiável disponível, quando apropriado;
4. comparar com outras digitalizações, transcrições ou derivados da mesma obra quando existirem.

Se a informação continuar sem confirmação segura, **parar naquele ponto**.

## Quando pedir validação manual

A referência não deve ser marcada como validada.

Apresentar ao usuário, sempre que tecnicamente possível, a página completa ou a imagem da página correspondente. Se uma região puder ser indicada sem eliminar contexto importante, apontar onde olhar.

Usar formato curto e objetivo:

> Validação manual necessária  
> Livro/personagem: Colthar — O Caminho do Guerreiro  
> Referência: 117  
> Página do documento: XXX  
> Dúvida: não foi possível confirmar visualmente os valores de HABILIDADE/ENERGIA do segundo Gárgula.  
> Preciso confirmar se está escrito HABILIDADE 8 / ENERGIA 8.

Informar sempre:

- livro/personagem;
- referência;
- página do documento;
- trecho em dúvida;
- dado exato que precisa ser confirmado.

## Depois da resposta do usuário

Quando o usuário realizar a leitura visual:

1. corrigir ou completar o dado estrutural;
2. registrar que a informação passou por validação manual do usuário;
3. somente então promover aquele ponto para confirmado/validado, caso não haja outra pendência.

Se a leitura do usuário também deixar dúvida, manter a referência pendente.

## Dados que exigem cautela máxima

A regra é especialmente importante para:

- HABILIDADE e ENERGIA de inimigos;
- números de referências de destino;
- valores de ouro;
- dano e alterações de atributos;
- Testes de Sorte;
- regras especiais de combate;
- itens ganhos ou perdidos;
- feitiços e seus custos;
- STATUS e AÇÃO;
- condições de morte;
- instruções entre Colthar e Lothar;
- qualquer número capaz de mudar o caminho ou o resultado da aventura.

## Estados e marcações

- `validada`: somente com confirmação explícita suficiente.
- `extraida`: conteúdo estruturado, mas ainda sem promoção para validação definitiva.
- `parcial`: leitura ou estrutura incompleta.
- `needsManualReview`: requer conferência visual/manual específica.
- `encounterNeedsReview`: encontro incompleto que permanece parcial conforme as regras do classificador.

A presença de dados plausíveis no JSON não elimina uma marcação de revisão manual.

## Fila ativa de pendências

As referências ainda não fechadas após esgotamento das fontes acessíveis ficam registradas em `docs/VALIDACAO-MANUAL-FURIA.md`. Essa fila é a fonte de verdade para novas rodadas de conferência e deve ser atualizada sempre que uma pendência for fechada.

## Caso ativo: Colthar 117

O teste físico no Android mostrou funcionamento coerente do motor no encontro, mas a referência permanece `extraida`.

Antes de validar definitivamente, confirmar na fonte original:

- Gárgula Um — HABILIDADE 9 / ENERGIA 8;
- Gárgula Dois — HABILIDADE 8 / ENERGIA 8;
- combate sucessivo;
- ausência de regra especial omitida;
- ausência de opção de fuga, ajuda, item, modificador ou condição perdida na extração.

Não rebalancear a luta antes dessa conferência.
