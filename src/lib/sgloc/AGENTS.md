# Conector SGLOC
- O conector SGLOC fica em src/lib/sgloc (core.ts puro; client.server.ts só servidor; sgloc.functions.ts com master/usuário conferido no servidor); tokens SGLOC são cifrados (AES-GCM, chave SGLOC_TOKEN_KEY) em sgloc_accounts, inacessível ao cliente, e relatórios de teste só guardam dados mascarados — evita vazar credenciais e dados pessoais.
