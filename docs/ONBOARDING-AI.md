# Onboarding guiado do organizador (com IA de recurso)

Decisão do Vinicius, 2026-10-19. Primeira vez que um organizador cria o grupo (modo cloud), em vez do formulário vê **5 perguntas, uma por ecrã**, em estilo chat:

1. **Onde jogam?** — texto livre. Também aceita a frase toda colada ("às quintas às 21h no Campo X, 5 contra 5, 60 €"): preenche os outros passos e salta direto para o cartão.
2. **Dia e hora** — chips de dia + seletor de hora (ou texto livre).
3. **Quantos de cada lado** — 5×5 · 6×6 · 7×7 · 8×8 · 11×11 · outro (dá as vagas: 5×5 → 10).
4. **Quanto custa o campo** — total por jogo, com a divisão por jogador ao vivo (arredonda **para cima** a 0,50 €), ou "Não pagamos".
5. **Nome do grupo** — sugerido ("Futebol de Quinta"), editável.

Depois: **cartão de confirmação** (tudo editável, incluindo semanal sim/não e quando abrem as confirmações — por omissão 2 dias antes às 10:00) → **"Está certo, criar"** → cria grupo + primeiro jogo pelo caminho de sempre (`createGroupAsOrganizer`) → **convite** (copiar link, "Partilhar no WhatsApp" com mensagem pronta PT-PT/PT-BR/EN, "Ir para o meu jogo").

"Prefiro preencher o formulário" leva ao formulário clássico (pré-preenchido com o que já respondeu).

## Aparece uma única vez

Guardado **no servidor, por conta**: `user_metadata.pitch_ai_onboarding_done_at` (Supabase Auth), marcado quando o 1.º grupo é criado por aqui ou quando escolhe o formulário. Não volta em novo login, outro dispositivo ou 2.º grupo (que usa o formulário). O endpoint também recusa contas já marcadas. Modo demo: `localStorage`.

## Custo — local primeiro

Cada resposta é lida por um parser determinístico (`src/lib/onboardingAi.js`: dia, hora, formato, valor, moeda, "paus", "cada", "não pagamos"…). **A IA só é chamada quando uma resposta em texto livre não é percebida** (ex.: "depois do trabalho" sem hora), e só para **esse campo**, com um esquema mínimo.

| | Chamadas IA |
|---|---|
| Respostas típicas (chips, "Campo X", "quinta 21h", "60") | **0** |
| Frase completa colada que o parser percebe | **0** |
| Uma resposta vaga | 1 por resposta vaga |
| Máximo por onboarding (limite no cliente) | 6 |

Modelo: **`claude-haiku-4-5`** ($1 / $5 por milhão de tokens entrada/saída). Uma chamada ≈ 700 tokens de entrada + ≈ 100 de saída ≈ **US$ 0,001**. Pior caso por onboarding ≈ US$ 0,007; típico **US$ 0**. O custo estimado de cada chamada fica em `ai_onboarding_usage.est_cost_micros` (1 = US$ 0,000001).

## Segurança

- `api/onboarding-ai.js` (Vercel) exige o token de sessão Supabase (`Authorization: Bearer`), verificado no servidor com `auth.getUser`.
- A chave Anthropic e a service-role **só existem no ambiente do servidor**.
- Texto limitado a 600 caracteres; o texto vai entre `<answer>` e é tratado como dados.
- Limite diário por utilizador: **15 chamadas** (`ai_onboarding_bump`, atómico, fuso Europe/Lisbon). Se a tabela não responder, **não chama a IA** (falha fechado).
- Tabela `ai_onboarding_usage`: RLS ligado, sem políticas, sem grants para `anon`/`authenticated` — só `service_role`.
- Qualquer falha (env em falta, timeout de 12 s, erro da API, recusa) → `{ fallback: true }`; a app segue com os controlos estruturados. Os logs só têm um código de erro, nunca o texto.

## O que o Vinicius tem de configurar na Vercel

| Variável | Estado |
|---|---|
| `ANTHROPIC_API_KEY` | **nova — obrigatória** para o recurso de IA (sem ela tudo funciona, só sem IA) |
| `SUPABASE_SERVICE_ROLE_KEY` | já existe (usada por `api/ai-team.js`) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (ou `SUPABASE_URL` / `SUPABASE_ANON_KEY`) | já existem |
| `ONBOARDING_AI_MODEL` | opcional (por omissão `claude-haiku-4-5`) |
| `ONBOARDING_AI_DAILY_LIMIT` | opcional (por omissão 15) |

A migração `supabase/migrations/20261019160000_ai_onboarding_usage.sql` chega a produção pelo CI (nunca à mão). Verificação: `supabase/tests/onboarding_ai_check.sql`.

## Fora deste âmbito (próximos passos)

- Jogador sem grupo (onboarding guiado do lado do jogador).
- Explicações de VAR e Fantasy durante o onboarding.
- PT-BR: o jogo é sempre agendado em hora de Lisboa (limitação já existente da app, `GAME_TZ`).
- Gravar `groups.game_format` (jogadores por equipa) a partir do formato escolhido.
