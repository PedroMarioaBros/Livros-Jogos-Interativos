# Release Android

O projeto possui dois pipelines Android separados:

- `.github/workflows/android-build.yml`: debug, emulador, offline, save/load e atualização;
- `.github/workflows/android-release.yml`: APK/AAB de release e assinatura.

## Regra de segurança

Nenhuma chave privada, keystore ou senha de produção deve ser versionada no repositório.

O workflow de release usa variáveis de ambiente para configurar o Gradle. Em pull requests, ele gera uma chave efêmera de CI apenas para provar que o APK/AAB de release podem ser assinados e validados. Esses artefatos recebem o aviso `distribution=NAO_USAR_EM_PRODUCAO`.

## Secrets para release de produção

Para assinar uma release definitiva, configure estes GitHub Secrets:

- `ANDROID_KEYSTORE_BASE64`: conteúdo do arquivo JKS/keystore codificado em Base64;
- `ANDROID_KEYSTORE_PASSWORD`: senha do keystore;
- `ANDROID_KEY_ALIAS`: alias da chave;
- `ANDROID_KEY_PASSWORD`: senha da chave privada.

O arquivo da chave nunca é persistido no repositório. Durante o workflow ele é reconstruído em `.ci-signing/`, diretório ignorado pelo Git.

## Executar release de produção

No GitHub Actions, execute manualmente o workflow **Gerar release Android** e informe:

- `production_signing = true`;
- `version_code`: inteiro crescente exigido pelo Android;
- `version_name`: versão visível, por exemplo `0.1.0`.

Se qualquer secret estiver ausente, o workflow falha antes da compilação assinada.

## Validações automáticas

O pipeline exige:

- APK release;
- Android App Bundle (AAB) release;
- assinatura válida do APK via `apksigner`;
- assinatura válida do AAB via `jarsigner`;
- `applicationId = io.github.pedromariabros.livrosjogos`;
- minSdk 24;
- targetSdk 36;
- `versionCode` e `versionName` solicitados;
- ausência de `application-debuggable`;
- SHA-256 do APK e do AAB;
- arquivo `SIGNING-NOTICE.txt` indicando se a chave é efêmera ou de produção.

## Artefatos

Em pull request:

- `livros-jogos-ci-release` — somente validação técnica, não distribuir.

Em execução manual com assinatura de produção:

- `livros-jogos-production-release` — APK e AAB assinados com a chave fornecida via GitHub Secrets.

## Chave definitiva

A chave definitiva deve ser criada e armazenada fora do repositório, com cópia de segurança segura. A perda da chave/credenciais pode impedir atualizações futuras do mesmo aplicativo quando a mesma identidade de assinatura for necessária.
