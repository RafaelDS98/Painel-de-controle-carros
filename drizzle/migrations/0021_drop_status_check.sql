-- HISTÓRICO: já aplicado em produção. Não reaplicar.
-- A constraint fixa só aceitava as 4 situações originais e bloqueava renomear/criar situações.
-- A validade vem de status_options (trigger de exclusão já impede remover situação em uso).
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
