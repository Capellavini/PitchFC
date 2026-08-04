-- ─────────────────────────────────────────────────────────
-- Migration 43 — Editable /roadmap content
--
-- Singleton table (id always 1) holding the whole /roadmap page as one
-- JSON document, editable from the new "Roadmap" tab in the /admin
-- dashboard without a code deploy. Admin-only both ways (read AND
-- write) — unlike events (public-read), this has financial projections
-- Vini doesn't want publicly discoverable. Seeded with the content
-- originally drafted as a static Artifact, so /roadmap isn't empty on
-- first load.
-- ─────────────────────────────────────────────────────────

create table if not exists public.roadmap_content (
  id         int primary key default 1,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint roadmap_content_singleton check (id = 1)
);

alter table public.roadmap_content enable row level security;
drop policy if exists "roadmap select" on public.roadmap_content;
drop policy if exists "roadmap upsert" on public.roadmap_content;
drop policy if exists "roadmap update" on public.roadmap_content;
create policy "roadmap select" on public.roadmap_content for select using (public.is_admin());
create policy "roadmap upsert" on public.roadmap_content for insert with check (public.is_admin());
create policy "roadmap update" on public.roadmap_content for update using (public.is_admin()) with check (public.is_admin());

insert into public.roadmap_content (id, data) values (1, '{
  "hero": {
    "tagline": "De grupo de WhatsApp caótico a sistema operativo do futebol amador — organizador, jogador e, mais tarde, o campo em si.",
    "stats": [
      { "value": "6", "label": "fases de produto mapeadas" },
      { "value": "~645k", "label": "grupos endereçáveis (PT+BR, estimativa)" },
      { "value": "8", "label": "vias de monetização identificadas" },
      { "value": "2", "label": "verticais já validadas: amigos e empresas" }
    ]
  },
  "today": [
    { "title": "Grelha de confirmações", "desc": "10 vagas, WhatsApp, pagamento por jogador, lista de espera automática.", "status": "done" },
    { "title": "Sorteio de equipas", "desc": "Equilibrado por posição, edição manual, equipas nomeadas.", "status": "done" },
    { "title": "Matchday ao vivo", "desc": "Golos, assistências, defesas espetaculares, guarda-redes rotativo, campeonato/eliminatórias.", "status": "done" },
    { "title": "Quadro tático", "desc": "Arrastar jogadores, escolher formação (4-3-3 e outras), pessoal por jogador.", "status": "done" },
    { "title": "Stats & conquistas", "desc": "Época, histórico, badges, MVP por votação, cartão FUT-style com avaliação de pares.", "status": "done" },
    { "title": "Pitch Manager (Fantasy)", "desc": "Liga fantasy interna com mercado de jogadores, trocas, formações e pontuação real.", "status": "done" },
    { "title": "Feed social", "desc": "Posts, fotos/vídeo, Golo da Semana, amizades entre grupos.", "status": "done" },
    { "title": "Identidade cross-group", "desc": "Um jogador pode pertencer a vários grupos, com stats e histórico próprios por grupo.", "status": "done" },
    { "title": "Ferramentas de organizador", "desc": "Auxiliares, remover/banir membros, cancelar/reagendar jogo, reservas de campo.", "status": "done" },
    { "title": "Link mágico (sem login)", "desc": "Confirmação por WhatsApp num toque, sem instalar nem criar conta.", "status": "done" },
    { "title": "Notificações push", "desc": "Fila automática pronta (aviso ao suplente quando alguém desiste) — falta só ativar.", "status": "beta" },
    { "title": "Pagamento real (MB Way)", "desc": "Hoje é um toggle manual do organizador — é a maior peça em falta.", "status": "beta" }
  ],
  "phases": [
    { "num": 0, "title": "Fundação — o organizador de bolso", "when": "CONCLUÍDA", "desc": "Tudo o que está listado na secção anterior. É o wedge: resolver de forma completa o jogo semanal de um grupo de amigos, sem exigir que ninguém mude de app para participar.", "tags": ["Confirmações", "Sorteio", "Matchday", "Stats", "Fantasy", "Social", "Multi-grupo"] },
    { "num": 1, "title": "Ativar monetização & automação", "when": "0–6 meses", "desc": "Ligar o que já existe mas está desligado (push), e construir o que falta para o organizador deixar de precisar de fazer nada manualmente. É também a fase onde a subscrição paga nasce.", "tags": ["MB Way real", "Push automático", "Lembretes agendados", "Jogo recorrente automático", "Planos free / pro"] },
    { "num": 2, "title": "Efeitos de rede", "when": "6–12 meses", "desc": "Sair de uma app por grupo isolado para uma rede de grupos. A identidade cross-group já está construída — esta fase é sobre dar-lhe uso.", "tags": ["Falta 1 jogador", "Rankings locais", "Seletor de grupos na Perfil", "Convites com incentivo"] },
    { "num": 3, "title": "Reservas & eventos", "when": "12–18 meses", "desc": "Entrar na transação que já acontece hoje por fora (reservar o campo, cobrar aos jogadores) e torná-la nativa — com operadores de campo como parceiros, não concorrentes.", "tags": ["Marketplace de reservas", "Pacotes corporativos", "Torneios/ligas entre grupos"] },
    { "num": 4, "title": "Captura automática & conteúdo", "when": "18–24 meses", "desc": "A aposta de maior risco técnico do roteiro — reconhecimento de golo por vídeo é terreno de empresas inteiras (Veo, Trace). Começar pela parte fácil: integrações via OAuth.", "tags": ["Strava / Garmin (OAuth)", "Vídeo destaques", "Golo da Semana com prémio"] },
    { "num": 5, "title": "PITCH Club & PITCH OS", "when": "24+ meses", "desc": "O software financia e valida a marca antes de qualquer investimento físico. Só depois: um espaço próprio, e a mesma plataforma licenciada a outros operadores.", "tags": ["Campo físico (Porto/Matosinhos)", "PITCH OS white-label", "CRM para operadores"] }
  ],
  "tam": {
    "tam": { "value": 645000, "label": "grupos (TAM)" },
    "sam": { "value": 225000, "label": "grupos (SAM)" },
    "som": { "value": 3500, "label": "grupos (SOM, ano 3–5)" },
    "assumptions": "Portugal ≈10,4M hab., Brasil ≈213M hab. Assumimos que ≈7% da população portuguesa e ≈4% da brasileira joga futebol recreativo com regularidade semanal/quinzenal em grupo organizado (~700k PT + ~8,5M BR jogadores), divididos por grupos de ~15 pessoas → ~47k grupos em PT + ~570k no BR ≈ 645k TAM. SAM assume 35% (urbano, smartphone, já paga aluguer de campo). SOM assume captação orgânica sem aquisição paga em escala — deve ser revisto com dados primários antes de uso externo."
  },
  "revenueStreams": [
    { "title": "Subscrição do organizador", "desc": "Freemium: grátis até 1 grupo/funcionalidades base; plano Pro (~€5–10/mês por grupo) com automação total, stats ilimitados, Fantasy avançado, cartão premium.", "statusLabel": "Fase 1", "statusKind": "next" },
    { "title": "Comissão em pagamentos", "desc": "% sobre os pagamentos MB Way processados dentro da app quando o pagamento real for ativado — alinhado com taxas Easypay/Stripe (~1,5–3%).", "statusLabel": "Fase 1", "statusKind": "next" },
    { "title": "Marketplace falta 1 jogador", "desc": "Taxa de matchmaking quando um jogador avulso entra num jogo aberto de outro grupo através da rede cross-group.", "statusLabel": "Fase 2", "statusKind": "next" },
    { "title": "Comissão em reservas de campo", "desc": "% por reserva feita através do marketplace de campos parceiros.", "statusLabel": "Fase 3", "statusKind": "later" },
    { "title": "Eventos corporativos & torneios", "desc": "Pacotes pagos para empresas organizarem o seu próprio jogo/torneio recorrente. Já validado organicamente: um grupo real de uma empresa (Ziar Imóveis) usa a PITCH hoje.", "statusLabel": "Sinal real hoje", "statusKind": "live" },
    { "title": "Brand deals & patrocínios", "desc": "Marcas desportivas, bebidas, torneios com nome patrocinado, Golo da Semana patrocinado.", "statusLabel": "Fase 2–4", "statusKind": "later" },
    { "title": "PITCH OS — licenciamento B2B", "desc": "Operadores de campos pagam uma licença mensal pelo CRM + motor de reservas + engagement da PITCH, white-label.", "statusLabel": "Fase 5", "statusKind": "later" },
    { "title": "PITCH Club — receita física", "desc": "Aluguer de campo, bar/F&B, eventos no espaço próprio.", "statusLabel": "Fase 5", "statusKind": "later" }
  ],
  "financials": {
    "rows": [
      { "year": "Ano 1", "groups": "≈ 50", "revenue": 5600, "costs": 2000, "sources": "Subscrições iniciais + 1º piloto de brand deal" },
      { "year": "Ano 2", "groups": "≈ 500", "revenue": 55000, "costs": 26000, "sources": "Subscrições + 1º pacote corporativo + brand deal" },
      { "year": "Ano 3", "groups": "≈ 3 000", "revenue": 304000, "costs": 155000, "sources": "Subscrições PT+BR, comissões, 2 pilotos B2B SaaS" }
    ],
    "assumptions": "Preço médio blended ≈€6–7/mês/grupo (mistura free/pro, PT/BR); ano 2 inclui 1ª contratação part-time (~€18k); ano 3 inclui equipa de 2–3 pessoas (~€90k) e entrada operacional no Brasil (~€15k). Não inclui capital de arranque, apenas fluxo operacional do próprio produto."
  },
  "marketing": [
    { "title": "Orgânico / produto-liderado", "desc": "Convite de grupo embutido no core loop; cartão FUT-style e Golo da Semana como conteúdo naturalmente partilhável; recapitulações de época (Wrapped) como gancho sazonal de retorno." },
    { "title": "Parcerias de distribuição", "desc": "Co-marketing com operadores de futebol 5/campos — eles ganham clientes mais fiéis, a PITCH ganha acesso a grupos já organizados no balcão deles." },
    { "title": "Conteúdo & criadores", "desc": "Micro-criadores de pelada/futebol de rua em PT e BR (YouTube/TikTok/Instagram) — formato barato, audiência já qualificada." },
    { "title": "Canal corporativo", "desc": "O caso real Ziar Imóveis vira case study para vender bem-estar corporativo a RH de outras empresas." }
  ],
  "partnerships": [
    { "category": "Distribuição", "name": "Operadores de campos / complexos desportivos", "why": "Acesso direto a grupos já organizados; mais tarde, clientes do PITCH OS (Fase 5)." },
    { "category": "Pagamentos", "name": "Easypay / SIBS (PT) · Stripe / Pix (BR)", "why": "Processamento licenciado — a PITCH nunca guarda dados de cartão nem assume risco regulatório direto." },
    { "category": "Mensageria", "name": "WhatsApp Business API", "why": "Só quando o volume justificar — hoje os links wa.me já cobrem o essencial sem custo." },
    { "category": "Corporativo", "name": "RH / bem-estar de empresas", "why": "Replicar o caso Ziar Imóveis como canal de vendas B2B recorrente." },
    { "category": "Wearables", "name": "Strava / Garmin (OAuth)", "why": "Parte fácil da Fase 4 — integração de dados, não visão computacional." },
    { "category": "Comunidade", "name": "Associações universitárias / ligas informais", "why": "Grupos já numerosos e organizados, fricção de adoção baixa." }
  ],
  "brandDeals": [
    { "title": "Equipamento desportivo", "desc": "Chuteiras/equipamento — marcas globais ou emergentes PT/BR mais acessíveis a um parceiro early-stage." },
    { "title": "Bebidas isotónicas", "desc": "Naming ou skin de Golo da Semana; amostras físicas via parceria com campos." },
    { "title": "Torneios com nome", "desc": "Patrocínio de título de uma liga/torneio dentro da app (Fase 3)." },
    { "title": "Clínicas & fisioterapia", "desc": "Patrocínio geolocalizado por campo/cidade — relevância real, não banner genérico." },
    { "title": "Apps complementares", "desc": "Cross-promo com Strava/Garmin — valor mútuo antes de dinheiro direto." },
    { "title": "Cartão de jogador premium", "desc": "Skins/frames de marca no cartão FUT-style, opt-in, nunca pay-to-win." }
  ],
  "risks": [
    { "risk": "O WhatsApp grátis é bom o suficiente para a maioria dos grupos", "mitigation": "Fricção zero — não é preciso convencer o grupo todo a mudar de app de uma vez; o valor aparece mesmo com adoção parcial." },
    { "risk": "Vão pagar por algo que hoje resolvem de graça?", "mitigation": "Freemium — o tier pago vende tempo poupado ao organizador (automação), não a funcionalidade base." },
    { "risk": "Equipa pequena, execução concentrada numa pessoa", "mitigation": "Stack simples e barato (Supabase + Vercel), roteiro faseado que não exige contratar cedo." },
    { "risk": "Brasil é um mercado muito maior mas nada validado", "mitigation": "TAM do BR incluído por tamanho, mas o roteiro só entra lá depois de PT provar retenção e conversão." },
    { "risk": "Risco regulatório de pagamentos", "mitigation": "Nunca processar cartão/MB Way diretamente — sempre via processador licenciado (Easypay/Stripe)." },
    { "risk": "Reconhecimento de golo por vídeo é terreno de players muito maiores", "mitigation": "Adiado para a Fase 4, e mesmo aí prioriza-se OAuth com Strava/Garmin em vez de visão computacional própria." }
  ]
}'::jsonb)
on conflict (id) do nothing;
