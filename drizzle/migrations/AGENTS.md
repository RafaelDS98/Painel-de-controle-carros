# drizzle/migrations

## AGENTS.md (leia antes de mexer aqui)

- Migrations 0020–0023 são histórico de mudanças já aplicadas direto no banco (sem _journal); a verdade do banco é o que está em produção (ex.: gatilho de edição com limite da Previsão de Entrega vem da 0019).
- Nunca reescrever migrações anteriores; mudanças novas viram arquivo novo e o SQL é entregue ao Rafael para aplicar no SQL Editor do Supabase.
