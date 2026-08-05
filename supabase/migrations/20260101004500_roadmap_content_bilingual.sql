-- ─────────────────────────────────────────────────────────
-- Migration 45 — Bilingual /roadmap content (PT/EN)
--
-- Every translatable string in roadmap_content becomes { pt, en } instead
-- of a bare string, ported from a standalone bilingual .htm draft of the
-- same business plan. The public /roadmap page gained a PT/EN toggle
-- (src/lib/roadmapI18n.js reads the active language, falling back to pt
-- for any field saved before this migration). Same table, same admin-only
-- RLS — content only, no schema change. Mirrors docs/roadmap-seed.json.
-- ─────────────────────────────────────────────────────────

update public.roadmap_content
set data = '{
  "hero": {
    "tagline": {
      "pt": "De grupo de WhatsApp caótico a sistema operativo do futebol amador — organizador, jogador e, mais tarde, o campo em si.",
      "en": "From a chaotic WhatsApp group to the operating system of amateur football — organiser, player, and later, the pitch itself."
    },
    "stats": [
      {
        "value": "11",
        "label": {
          "pt": "módulos já em produção",
          "en": "modules already live"
        }
      },
      {
        "value": "~645k",
        "label": {
          "pt": "grupos endereçáveis PT+BR (estimativa)",
          "en": "addressable groups PT+BR (estimate)"
        }
      },
      {
        "value": "8",
        "label": {
          "pt": "vias de monetização identificadas",
          "en": "identified revenue streams"
        }
      },
      {
        "value": "2",
        "label": {
          "pt": "verticais com sinal real",
          "en": "verticals with real signal (friends, corporate)"
        }
      }
    ]
  },
  "execSummary": [
    {
      "title": {
        "pt": "O problema",
        "en": "The problem"
      },
      "desc": {
        "pt": "Milhões de jogos semanais são organizados à mão em grupos de WhatsApp: contar quem vem, perseguir quem não pagou, sortear equipas de cabeça, reservar campo por telefone. O organizador é um voluntário exausto, e o grupo perde o jogo quando ele desiste.",
        "en": "Millions of weekly games are organised by hand in WhatsApp groups: counting who is in, chasing who hasn''t paid, drawing teams from memory, booking the pitch by phone. The organiser is an exhausted volunteer, and the game dies when they quit."
      }
    },
    {
      "title": {
        "pt": "A solução",
        "en": "The solution"
      },
      "desc": {
        "pt": "Uma aplicação web que absorve todo o trabalho do organizador — grelha de confirmações, cobrança, sorteio equilibrado, matchday ao vivo, estatísticas e fantasy — sem obrigar ninguém a instalar nada: o jogador confirma por link mágico no WhatsApp, num toque.",
        "en": "A web app that absorbs the organiser''s entire workload — confirmation grid, collection, balanced draw, live matchday, stats and fantasy — without forcing anyone to install anything: players confirm via a magic link in WhatsApp, in one tap."
      }
    },
    {
      "title": {
        "pt": "Porquê agora",
        "en": "Why now"
      },
      "desc": {
        "pt": "Pagamento instantâneo (MB Way em PT, Pix no BR) tornou-se universal e gratuito de iniciar; o WhatsApp é canal por omissão nos dois mercados; e as web apps modernas eliminam a fricção da app store. As três peças que tornavam isto inviável há cinco anos existem hoje.",
        "en": "Instant payments (MB Way in PT, Pix in BR) are now universal and free to initiate; WhatsApp is the default channel in both markets; and modern web apps remove app-store friction. The three blockers of five years ago are gone."
      }
    },
    {
      "title": {
        "pt": "Estado actual",
        "en": "Current status"
      },
      "desc": {
        "pt": "Produto em produção e em uso real. Falta a peça de monetização: pagamento MB Way nativo (hoje é um toggle manual do organizador) e os planos free/pro. Notificações push estão codificadas mas desligadas.",
        "en": "The product is live and in real use. The monetisation piece is missing: native MB Way payments (today a manual organiser toggle) and free/pro plans. Push notifications are coded but switched off."
      }
    },
    {
      "title": {
        "pt": "Modelo de receita",
        "en": "Revenue model"
      },
      "desc": {
        "pt": "Freemium por grupo (~€5–10/mês no plano Pro) + comissão sobre pagamentos processados, escalando depois para reservas de campo, eventos corporativos, patrocínios e licenciamento B2B.",
        "en": "Per-group freemium (~€5–10/month on Pro) plus a fee on processed payments, later scaling into pitch bookings, corporate events, sponsorships and B2B licensing."
      }
    },
    {
      "title": {
        "pt": "O pedido",
        "en": "The ask"
      },
      "desc": {
        "pt": "Capital de arranque modesto para cobrir 12 meses de infraestrutura, integração de pagamentos e a primeira contratação part-time — ou uma parceria de distribuição com um operador de campos. O plano não depende de ronda de investimento para chegar a receita.",
        "en": "Modest seed capital to cover 12 months of infrastructure, payments integration and the first part-time hire — or a distribution partnership with a pitch operator. The plan does not require a funding round to reach revenue."
      }
    }
  ],
  "company": {
    "mission": {
      "pt": "Garantir que o jogo semanal acontece. Tudo o resto — estatísticas, fantasy, feed, reservas — existe para tornar esse jogo mais fácil de organizar e mais difícil de abandonar.",
      "en": "Make sure the weekly game happens. Everything else — stats, fantasy, feed, bookings — exists to make that game easier to organise and harder to abandon."
    },
    "operations": [
      {
        "title": {
          "pt": "Estrutura",
          "en": "Structure"
        },
        "desc": {
          "pt": "Sociedade unipessoal ou por quotas sediada em Portugal; expansão ao Brasil por entidade local ou parceiro de merchant of record, apenas depois de PT validar retenção.",
          "en": "Single-member or private limited company based in Portugal; Brazil expansion via a local entity or merchant-of-record partner, only after PT proves retention."
        }
      },
      {
        "title": {
          "pt": "Operação",
          "en": "Operations"
        },
        "desc": {
          "pt": "100% remota e digital. Sem inventário, sem loja, sem armazém. O único activo físico eventual é o PITCH Club, na Fase 5, e só se o software o financiar.",
          "en": "100% remote and digital. No inventory, no store, no warehouse. The only eventual physical asset is PITCH Club, in Phase 5, and only if the software funds it."
        }
      },
      {
        "title": {
          "pt": "Stack e custos fixos",
          "en": "Stack and fixed costs"
        },
        "desc": {
          "pt": "Hospedagem serverless (Vercel), Supabase gerido e domínio — dezenas de euros por mês em fase inicial, escalando com o uso.",
          "en": "Serverless hosting (Vercel), managed Supabase and a domain — tens of euros per month early on, scaling with usage."
        }
      },
      {
        "title": {
          "pt": "Pagamentos",
          "en": "Payments"
        },
        "desc": {
          "pt": "Sempre através de processador licenciado (Easypay/SIBS em PT, Stripe/Pix no BR). A PITCH nunca detém fundos de terceiros.",
          "en": "Always through a licensed processor (Easypay/SIBS in PT, Stripe/Pix in BR). PITCH never holds third-party funds."
        }
      }
    ],
    "startupCosts": [
      {
        "item": {
          "pt": "Infraestrutura (hosting, BD, domínio, e-mail)",
          "en": "Infrastructure (hosting, DB, domain, email)"
        },
        "kind": {
          "pt": "Fixo",
          "en": "Fixed"
        },
        "amount": 600
      },
      {
        "item": {
          "pt": "Integração e taxas de processador de pagamentos",
          "en": "Payment processor integration and fees"
        },
        "kind": {
          "pt": "Variável",
          "en": "Variable"
        },
        "amount": 400
      },
      {
        "item": {
          "pt": "Contabilidade, constituição e taxas legais",
          "en": "Accounting, incorporation and legal fees"
        },
        "kind": {
          "pt": "Fixo",
          "en": "Fixed"
        },
        "amount": 700
      },
      {
        "item": {
          "pt": "Design, marca e conteúdo",
          "en": "Design, brand and content"
        },
        "kind": {
          "pt": "Pontual",
          "en": "One-off"
        },
        "amount": 300
      }
    ],
    "costsNote": {
      "pt": "O trabalho de desenvolvimento é feito internamente e não está monetizado nesta tabela — é o principal custo de oportunidade do projecto e deve ser declarado como tal a qualquer investidor.",
      "en": "Development work is done in-house and is not priced in this table — it is the project''s main opportunity cost and should be declared as such to any investor."
    }
  },
  "today": [
    {
      "title": {
        "pt": "Grelha de confirmações",
        "en": "Confirmation grid"
      },
      "desc": {
        "pt": "10 vagas, WhatsApp, pagamento por jogador, lista de espera automática.",
        "en": "10 slots, WhatsApp, per-player payment, automatic waiting list."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Sorteio de equipas",
        "en": "Team draw"
      },
      "desc": {
        "pt": "Equilibrado por posição, edição manual, equipas nomeadas.",
        "en": "Balanced by position, manual editing, named teams."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Matchday ao vivo",
        "en": "Live matchday"
      },
      "desc": {
        "pt": "Golos, assistências, defesas, guarda-redes rotativo, campeonato e eliminatórias.",
        "en": "Goals, assists, saves, rotating keeper, league and knockout formats."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Quadro tático",
        "en": "Tactics board"
      },
      "desc": {
        "pt": "Arrastar jogadores, formações (4-3-3 e outras), notas por jogador.",
        "en": "Drag players, formations (4-3-3 and others), per-player notes."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Stats e conquistas",
        "en": "Stats & achievements"
      },
      "desc": {
        "pt": "Época, histórico, badges, MVP por votação, cartão FUT com avaliação de pares.",
        "en": "Season, history, badges, voted MVP, FUT-style card with peer ratings."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Pitch Manager (Fantasy)",
        "en": "Pitch Manager (Fantasy)"
      },
      "desc": {
        "pt": "Liga fantasy interna com mercado, trocas, formações e pontuação real.",
        "en": "Internal fantasy league with market, trades, formations and real scoring."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Feed social",
        "en": "Social feed"
      },
      "desc": {
        "pt": "Posts, fotos e vídeo, Golo da Semana, amizades entre grupos.",
        "en": "Posts, photos and video, Goal of the Week, friendships across groups."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Identidade cross-group",
        "en": "Cross-group identity"
      },
      "desc": {
        "pt": "Um jogador em vários grupos, com stats e histórico próprios em cada um.",
        "en": "One player across several groups, with separate stats and history in each."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Ferramentas de organizador",
        "en": "Organiser tools"
      },
      "desc": {
        "pt": "Auxiliares, remover e banir membros, cancelar e reagendar jogo, reservas de campo.",
        "en": "Co-admins, remove/ban members, cancel and reschedule games, pitch bookings."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Link mágico (sem login)",
        "en": "Magic link (no login)"
      },
      "desc": {
        "pt": "Confirmação por WhatsApp num toque, sem instalar nem criar conta.",
        "en": "One-tap WhatsApp confirmation, no install, no account."
      },
      "status": "done"
    },
    {
      "title": {
        "pt": "Notificações push",
        "en": "Push notifications"
      },
      "desc": {
        "pt": "Fila automática pronta (avisar o suplente quando alguém desiste) — falta activar.",
        "en": "Automatic queue ready (alert the sub when someone drops) — needs switching on."
      },
      "status": "beta"
    },
    {
      "title": {
        "pt": "Pagamento real (MB Way)",
        "en": "Real payments (MB Way)"
      },
      "desc": {
        "pt": "Hoje é um toggle manual do organizador. É a maior peça em falta.",
        "en": "Today a manual organiser toggle. This is the biggest missing piece."
      },
      "status": "beta"
    }
  ],
  "phases": [
    {
      "num": 0,
      "when": {
        "pt": "Concluída",
        "en": "Done"
      },
      "title": {
        "pt": "Fundação — o organizador de bolso",
        "en": "Foundation — the pocket organiser"
      },
      "desc": {
        "pt": "O wedge: resolver por completo o jogo semanal de um grupo de amigos, sem exigir que ninguém mude de app para participar.",
        "en": "The wedge: fully solve one group of friends'' weekly game, without requiring anyone to switch apps to take part."
      },
      "tags": [
        {
          "pt": "Confirmações",
          "en": "Confirmations"
        },
        {
          "pt": "Sorteio",
          "en": "Draw"
        },
        {
          "pt": "Matchday",
          "en": "Matchday"
        },
        {
          "pt": "Stats",
          "en": "Stats"
        },
        {
          "pt": "Fantasy",
          "en": "Fantasy"
        },
        {
          "pt": "Social",
          "en": "Social"
        },
        {
          "pt": "Multi-grupo",
          "en": "Multi-group"
        }
      ]
    },
    {
      "num": 1,
      "when": {
        "pt": "0–6 meses",
        "en": "0–6 months"
      },
      "title": {
        "pt": "Activar monetização e automação",
        "en": "Switch on monetisation and automation"
      },
      "desc": {
        "pt": "Ligar o que já existe mas está desligado, e construir o que falta para o organizador deixar de fazer trabalho manual. É onde nasce a subscrição paga.",
        "en": "Switch on what already exists but is off, and build what''s missing so the organiser stops doing manual work. This is where the paid subscription is born."
      },
      "tags": [
        {
          "pt": "MB Way real",
          "en": "Real MB Way"
        },
        {
          "pt": "Push automático",
          "en": "Automatic push"
        },
        {
          "pt": "Lembretes agendados",
          "en": "Scheduled reminders"
        },
        {
          "pt": "Jogo recorrente",
          "en": "Recurring game"
        },
        {
          "pt": "Planos free/pro",
          "en": "Free/Pro plans"
        }
      ]
    },
    {
      "num": 2,
      "when": {
        "pt": "6–12 meses",
        "en": "6–12 months"
      },
      "title": {
        "pt": "Efeitos de rede",
        "en": "Network effects"
      },
      "desc": {
        "pt": "Sair de \"uma app por grupo isolado\" para \"uma rede de grupos\". A identidade cross-group já está construída — esta fase dá-lhe uso.",
        "en": "Move from \"one app per isolated group\" to \"a network of groups\". Cross-group identity is already built — this phase puts it to work."
      },
      "tags": [
        {
          "pt": "Falta 1 jogador",
          "en": "Need 1 player"
        },
        {
          "pt": "Rankings locais",
          "en": "Local rankings"
        },
        {
          "pt": "Seletor de grupos",
          "en": "Group switcher"
        },
        {
          "pt": "Convites com incentivo",
          "en": "Incentivised invites"
        }
      ]
    },
    {
      "num": 3,
      "when": {
        "pt": "12–18 meses",
        "en": "12–18 months"
      },
      "title": {
        "pt": "Reservas e eventos",
        "en": "Bookings and events"
      },
      "desc": {
        "pt": "Entrar na transação que já acontece hoje por fora — reservar campo, cobrar aos jogadores — e torná-la nativa, com operadores de campo como parceiros, não concorrentes.",
        "en": "Enter the transaction that already happens outside the app — booking the pitch, collecting from players — and make it native, with pitch operators as partners, not competitors."
      },
      "tags": [
        {
          "pt": "Marketplace de reservas",
          "en": "Booking marketplace"
        },
        {
          "pt": "Pacotes corporativos",
          "en": "Corporate packages"
        },
        {
          "pt": "Torneios entre grupos",
          "en": "Inter-group tournaments"
        }
      ]
    },
    {
      "num": 4,
      "when": {
        "pt": "18–24 meses",
        "en": "18–24 months"
      },
      "title": {
        "pt": "Captura automática e conteúdo",
        "en": "Automatic capture and content"
      },
      "desc": {
        "pt": "A aposta de maior risco técnico. Reconhecimento de golo por vídeo é o negócio inteiro de outras empresas — começar pelo mais barato: integrações via OAuth.",
        "en": "The highest technical-risk bet. Video goal recognition is the whole business of other companies — start with the cheap part: OAuth integrations."
      },
      "tags": [
        {
          "pt": "Strava / Garmin",
          "en": "Strava / Garmin"
        },
        {
          "pt": "Vídeo destaques",
          "en": "Video highlights"
        },
        {
          "pt": "Golo da Semana com prémio",
          "en": "Goal of the Week with prize"
        }
      ]
    },
    {
      "num": 5,
      "when": {
        "pt": "24+ meses",
        "en": "24+ months"
      },
      "title": {
        "pt": "PITCH Club & PITCH OS",
        "en": "PITCH Club & PITCH OS"
      },
      "desc": {
        "pt": "O software financia e valida a marca antes de qualquer investimento físico. Só depois: um espaço próprio, e a mesma plataforma licenciada a outros operadores.",
        "en": "The software funds and validates the brand before any physical investment. Only then: a venue of our own, and the same platform licensed to other operators."
      },
      "tags": [
        {
          "pt": "Campo físico (Porto/Matosinhos)",
          "en": "Physical pitch (Porto/Matosinhos)"
        },
        {
          "pt": "PITCH OS white-label",
          "en": "PITCH OS white-label"
        },
        {
          "pt": "CRM para operadores",
          "en": "Operator CRM"
        }
      ]
    }
  ],
  "pricing": [
    {
      "name": {
        "pt": "Free",
        "en": "Free"
      },
      "price": {
        "pt": "€0",
        "en": "€0"
      },
      "highlight": "",
      "desc": {
        "pt": "1 grupo, confirmações, sorteio, matchday e stats base. Sem limite de jogadores. O objectivo é que o grupo nunca tenha razão para sair.",
        "en": "1 group, confirmations, draw, matchday and basic stats. No player cap. The point is that a group never has a reason to leave."
      }
    },
    {
      "name": {
        "pt": "Pro",
        "en": "Pro"
      },
      "price": {
        "pt": "€5–10 / mês por grupo",
        "en": "€5–10 / month per group"
      },
      "highlight": "1",
      "desc": {
        "pt": "Cobrança automática MB Way, push e lembretes, jogo recorrente, fantasy completo, histórico ilimitado e exportação. Chega na Fase 1.",
        "en": "Automatic MB Way collection, push and reminders, recurring games, full fantasy, unlimited history and export. Arrives in Phase 1."
      }
    },
    {
      "name": {
        "pt": "Empresas",
        "en": "Corporate"
      },
      "price": {
        "pt": "Por evento ou anual",
        "en": "Per event or annual"
      },
      "highlight": "",
      "desc": {
        "pt": "Torneios internos, marca da empresa, relatório de participação para RH. Já validado organicamente com um grupo real (Ziar Imóveis).",
        "en": "Internal tournaments, company branding, participation reporting for HR. Already organically validated with a real group (Ziar Imóveis)."
      }
    }
  ],
  "tam": {
    "tam": {
      "value": 645000,
      "label": {
        "pt": "grupos com jogo semanal ou quinzenal (PT+BR)",
        "en": "groups playing weekly or fortnightly (PT+BR)"
      }
    },
    "sam": {
      "value": 225000,
      "label": {
        "pt": "digitalmente alcançáveis, já a pagar campo",
        "en": "digitally reachable, already paying for pitches"
      }
    },
    "som": {
      "value": 3500,
      "label": {
        "pt": "meta realista a 3–5 anos",
        "en": "realistic 3–5 year target"
      }
    },
    "assumptions": {
      "pt": "⚠ Estimativa, não pesquisa primária. Portugal ≈10,4M hab.; Brasil ≈213M. Assume-se que ≈7% da população portuguesa e ≈4% da brasileira joga futebol recreativo com regularidade semanal/quinzenal em grupo organizado (~700k jogadores em PT, ~8,5M no BR), divididos por grupos de ~15 pessoas → ~47k grupos em PT + ~570k no BR ≈ 645k. O SAM assume 35% (urbano, smartphone, com transacção já a acontecer). O SOM assume captação essencialmente orgânica, sem orçamento de aquisição paga relevante. Estes rácios devem ser substituídos por dados primários antes de qualquer utilização externa — um inquérito a organizadores e dados de ocupação de operadores de campo são as duas fontes mais rápidas de obter.",
      "en": "⚠ Estimate, not primary research. Portugal ≈10.4M people; Brazil ≈213M. It is assumed that ≈7% of the Portuguese and ≈4% of the Brazilian population play recreational football weekly or fortnightly in an organised group (~700k players in PT, ~8.5M in BR), split into groups of ~15 people → ~47k groups in PT + ~570k in BR ≈ 645k. SAM assumes 35% (urban, smartphone, with a transaction already happening). SOM assumes essentially organic acquisition, without a meaningful paid-acquisition budget. These ratios must be replaced with primary data before any external use — an organiser survey and pitch-operator occupancy data are the two fastest sources to obtain."
    }
  },
  "competitors": [
    {
      "category": {
        "pt": "WhatsApp + folha de cálculo",
        "en": "WhatsApp + spreadsheet"
      },
      "examples": {
        "pt": "o status quo, >90% do mercado",
        "en": "the status quo, >90% of the market"
      },
      "solves": {
        "pt": "Toda a gente já lá está. Custo zero.",
        "en": "Everyone is already there. Zero cost."
      },
      "fails": {
        "pt": "Trabalho manual todo em cima de uma pessoa; sem histórico, sem cobrança, sem lista de espera. O grupo morre quando o organizador desiste.",
        "en": "All manual work on one person; no history, no collection, no waiting list. The group dies when the organiser quits."
      }
    },
    {
      "category": {
        "pt": "Apps de gestão de equipa",
        "en": "Team management apps"
      },
      "examples": {
        "pt": "Spond, TeamSnap, Heja",
        "en": "Spond, TeamSnap, Heja"
      },
      "solves": {
        "pt": "Presenças e comunicação para equipas federadas e desporto juvenil.",
        "en": "Attendance and comms for club teams and youth sport."
      },
      "fails": {
        "pt": "Desenhadas para uma equipa fixa com treinador, não para o jogo aberto entre amigos. Obrigam toda a gente a instalar e a criar conta — a barreira que mata a adopção num grupo casual.",
        "en": "Built for a fixed team with a coach, not the open pick-up game. They require everyone to install and register — the barrier that kills adoption in a casual group."
      }
    },
    {
      "category": {
        "pt": "Marketplaces de reserva",
        "en": "Booking marketplaces"
      },
      "examples": {
        "pt": "Playtomic, Matchi",
        "en": "Playtomic, Matchi"
      },
      "solves": {
        "pt": "Encontrar e reservar campo, sobretudo em padel e ténis.",
        "en": "Finding and booking courts, mostly padel/tennis."
      },
      "fails": {
        "pt": "Resolvem o campo, não o grupo. Nada de sorteio, stats, fantasy ou vida do grupo entre jogos. Parceiro natural na Fase 3, não concorrente frontal.",
        "en": "They solve the venue, not the group. No draw, stats, fantasy or between-games group life. A natural Phase 3 partner, not a head-on competitor."
      }
    },
    {
      "category": {
        "pt": "Captura de vídeo",
        "en": "Video capture"
      },
      "examples": {
        "pt": "Veo, Trace",
        "en": "Veo, Trace"
      },
      "solves": {
        "pt": "Gravação e análise automática de jogos.",
        "en": "Automatic game recording and analysis."
      },
      "fails": {
        "pt": "Hardware caro, orientado a clubes com orçamento. Fora do alcance de um grupo de amigos. Por isso a Fase 4 começa por OAuth e não por visão computacional própria.",
        "en": "Expensive hardware aimed at funded clubs. Out of reach for a group of friends. Hence Phase 4 starts with OAuth, not in-house computer vision."
      }
    }
  ],
  "advantages": [
    {
      "title": {
        "pt": "Fricção zero no lado do jogador",
        "en": "Zero friction on the player side"
      },
      "desc": {
        "pt": "Link mágico sem instalação nem conta. Nenhum concorrente de gestão de equipa faz isto, porque o modelo deles depende de contas.",
        "en": "Magic link, no install, no account. No team-management competitor does this, because their model depends on accounts."
      }
    },
    {
      "title": {
        "pt": "Dados acumulados por grupo",
        "en": "Accumulated per-group data"
      },
      "desc": {
        "pt": "Histórico, ratings de pares e ligas fantasy criam custo de mudança que cresce todas as semanas e não se replica.",
        "en": "History, peer ratings and fantasy leagues create switching cost that grows every week and cannot be copied."
      }
    },
    {
      "title": {
        "pt": "Identidade cross-group já construída",
        "en": "Cross-group identity already built"
      },
      "desc": {
        "pt": "A base técnica do \"falta 1 jogador\" — o efeito de rede real — existe antes de haver rede.",
        "en": "The technical base for \"need 1 player\" — the real network effect — exists before the network does."
      }
    },
    {
      "title": {
        "pt": "Amplitude do fluxo completo",
        "en": "End-to-end coverage"
      },
      "desc": {
        "pt": "Confirmação → cobrança → sorteio → jogo → stats → fantasy num só sítio; os concorrentes cobrem um pedaço cada.",
        "en": "Confirmation → collection → draw → game → stats → fantasy in one place; competitors each cover a slice."
      }
    }
  ],
  "revenueStreams": [
    {
      "title": {
        "pt": "1 · Subscrição do organizador",
        "en": "1 · Organiser subscription"
      },
      "statusLabel": {
        "pt": "FASE 1",
        "en": "PHASE 1"
      },
      "statusKind": "next",
      "desc": {
        "pt": "Freemium: grátis até 1 grupo e funcionalidades base; plano Pro a ~€5–10/mês por grupo.",
        "en": "Freemium: free for 1 group and base features; Pro plan at ~€5–10/month per group."
      }
    },
    {
      "title": {
        "pt": "2 · Comissão em pagamentos",
        "en": "2 · Payment fee"
      },
      "statusLabel": {
        "pt": "FASE 1",
        "en": "PHASE 1"
      },
      "statusKind": "next",
      "desc": {
        "pt": "Percentagem sobre pagamentos MB Way processados na app (~1,5–3%, alinhado com Easypay/Stripe).",
        "en": "Percentage on MB Way payments processed in-app (~1.5–3%, aligned with Easypay/Stripe)."
      }
    },
    {
      "title": {
        "pt": "3 · Marketplace \"falta 1 jogador\"",
        "en": "3 · \"Need 1 player\" marketplace"
      },
      "statusLabel": {
        "pt": "FASE 2",
        "en": "PHASE 2"
      },
      "statusKind": "later",
      "desc": {
        "pt": "Taxa de matchmaking entre grupos, através da rede cross-group.",
        "en": "Matchmaking fee between groups, through the cross-group network."
      }
    },
    {
      "title": {
        "pt": "4 · Comissão em reservas de campo",
        "en": "4 · Pitch booking commission"
      },
      "statusLabel": {
        "pt": "FASE 3",
        "en": "PHASE 3"
      },
      "statusKind": "later",
      "desc": {
        "pt": "Percentagem por reserva feita via marketplace de campos parceiros.",
        "en": "Percentage per booking made via the partner-pitch marketplace."
      }
    },
    {
      "title": {
        "pt": "5 · Eventos corporativos e torneios",
        "en": "5 · Corporate events and tournaments"
      },
      "statusLabel": {
        "pt": "SINAL REAL HOJE",
        "en": "SIGNAL TODAY"
      },
      "statusKind": "live",
      "desc": {
        "pt": "Já validado organicamente com um grupo real de empresa (Ziar Imóveis).",
        "en": "Already organically validated with a real corporate group (Ziar Imóveis)."
      }
    },
    {
      "title": {
        "pt": "6 · Brand deals e patrocínios",
        "en": "6 · Brand deals and sponsorships"
      },
      "statusLabel": {
        "pt": "FASE 2–4",
        "en": "PHASE 2–4"
      },
      "statusKind": "later",
      "desc": {
        "pt": "Marcas desportivas, bebidas, torneios e Golo da Semana com nome patrocinado.",
        "en": "Sports brands, drinks, tournaments and a title-sponsored Goal of the Week."
      }
    },
    {
      "title": {
        "pt": "7 · PITCH OS — licenciamento B2B",
        "en": "7 · PITCH OS — B2B licensing"
      },
      "statusLabel": {
        "pt": "FASE 5",
        "en": "PHASE 5"
      },
      "statusKind": "later",
      "desc": {
        "pt": "Operadores de campos pagam licença mensal pelo CRM e motor de reservas, em white-label.",
        "en": "Pitch operators pay a monthly licence for the CRM and booking engine, white-label."
      }
    },
    {
      "title": {
        "pt": "8 · PITCH Club — receita física",
        "en": "8 · PITCH Club — physical revenue"
      },
      "statusLabel": {
        "pt": "FASE 5",
        "en": "PHASE 5"
      },
      "statusKind": "later",
      "desc": {
        "pt": "Aluguer de campo, bar/F&B e eventos no espaço próprio.",
        "en": "Pitch rental, bar/F&B and events at our own venue."
      }
    }
  ],
  "financials": {
    "rows": [
      {
        "year": {
          "pt": "Ano 1",
          "en": "Year 1"
        },
        "groups": {
          "pt": "≈ 50",
          "en": "≈ 50"
        },
        "revenue": 5600,
        "costs": 2000,
        "sources": {
          "pt": "Subscrições iniciais + 1.º piloto de brand deal",
          "en": "Early subscriptions + first brand-deal pilot"
        }
      },
      {
        "year": {
          "pt": "Ano 2",
          "en": "Year 2"
        },
        "groups": {
          "pt": "≈ 500",
          "en": "≈ 500"
        },
        "revenue": 55000,
        "costs": 26000,
        "sources": {
          "pt": "Subscrições + 1.º pacote corporativo + brand deal",
          "en": "Subscriptions + first corporate package + brand deal"
        }
      },
      {
        "year": {
          "pt": "Ano 3",
          "en": "Year 3"
        },
        "groups": {
          "pt": "≈ 3 000",
          "en": "≈ 3,000"
        },
        "revenue": 304000,
        "costs": 155000,
        "sources": {
          "pt": "Subscrições PT+BR, comissões, 2 pilotos B2B SaaS",
          "en": "PT+BR subscriptions, fees, 2 B2B SaaS pilots"
        }
      }
    ],
    "assumptions": {
      "pt": "⚠ Premissas. Preço médio blended ≈€6–7/mês por grupo (mistura free/pro e PT/BR). O ano 2 inclui a primeira contratação part-time (~€18k); o ano 3 inclui equipa de 2–3 pessoas (~€90k) e entrada operacional no Brasil (~€15k). Exclui capital de arranque e o custo de oportunidade da equipa fundadora. O salto de 500 para 3 000 grupos no ano 3 é a premissa mais frágil de todo o plano e depende inteiramente de o efeito de rede da Fase 2 funcionar.",
      "en": "⚠ Assumptions. Blended average price ≈€6–7/month per group (free/pro and PT/BR mix). Year 2 includes the first part-time hire (~€18k); Year 3 includes a 2–3 person team (~€90k) and Brazil operational entry (~€15k). Excludes seed capital and the founding team''s opportunity cost. The jump from 500 to 3,000 groups in Year 3 is the single most fragile assumption in the plan and depends entirely on Phase 2''s network effect working."
    }
  },
  "calculator": {
    "groups": 500,
    "price": 7,
    "players": 14,
    "fee": 5,
    "games": 4,
    "adoption": 40,
    "take": 2,
    "fixedMonthly": 1800,
    "variablePerGroup": 0.45
  },
  "calculatorNote": {
    "pt": "Como ler: o cenário Base está calibrado para reproduzir a tabela acima — 50 grupos dão ≈€5,5k (ano 1), 500 grupos ≈€55k (ano 2) e 3 000 grupos ≈€333k (ano 3). Se mexeres nos parâmetros e os números deixarem de bater com a tabela, é o modelo que está certo e a tabela que precisa de ser reescrita. O modelo é de estado estável: assume o número de grupos constante ao longo de doze meses e não modela crescimento, churn nem sazonalidade. Serve para testar ordem de grandeza e sensibilidade ao preço — não substitui uma projecção mensal de tesouraria.",
    "en": "How to read this: the Base scenario is calibrated to reproduce the table above — 50 groups yield ≈€5.5k (year 1), 500 groups ≈€55k (year 2) and 3,000 groups ≈€333k (year 3). If you change the parameters and the numbers stop matching the table, the model is right and the table needs rewriting. This is a steady-state model: it assumes a constant group count over twelve months and does not model growth, churn or seasonality. It is for testing order of magnitude and price sensitivity — it does not replace a monthly cash-flow projection."
  },
  "marketing": [
    {
      "title": {
        "pt": "1 · Orgânico, liderado pelo produto",
        "en": "1 · Organic, product-led"
      },
      "desc": {
        "pt": "O convite de grupo está embutido no ciclo central: cada jogo espalha o link por 10–15 pessoas. O cartão FUT e o Golo da Semana são naturalmente partilháveis; o \"Wrapped\" de época é o gancho sazonal.",
        "en": "The group invite is baked into the core loop: every game pushes the link to 10–15 people. The FUT-style card and Goal of the Week are naturally shareable; the season \"Wrapped\" is the seasonal hook."
      }
    },
    {
      "title": {
        "pt": "2 · Parcerias de distribuição",
        "en": "2 · Distribution partnerships"
      },
      "desc": {
        "pt": "Co-marketing com operadores de futebol 5/7: eles já têm os grupos, nós damos-lhes uma ferramenta que reduz faltas e no-shows. Canal de maior alavancagem por euro investido.",
        "en": "Co-marketing with 5/7-a-side venues: they already have the groups, we give them a tool that reduces no-shows. Highest leverage per euro spent."
      }
    },
    {
      "title": {
        "pt": "3 · Conteúdo e criadores",
        "en": "3 · Content and creators"
      },
      "desc": {
        "pt": "Micro-criadores de \"pelada\" e futebol de rua em PT e BR — audiências pequenas, altíssima afinidade e custo por parceria baixo.",
        "en": "Micro-creators in pick-up and street football in PT and BR — small audiences, very high affinity, low cost per partnership."
      }
    },
    {
      "title": {
        "pt": "4 · Canal corporativo",
        "en": "4 · Corporate channel"
      },
      "desc": {
        "pt": "O caso Ziar Imóveis como case study para vender a RH de outras empresas. Venda directa, ticket maior, sem depender de viralidade.",
        "en": "The Ziar Imóveis case as a case study to sell into other companies'' HR. Direct sales, bigger ticket, no reliance on virality."
      }
    }
  ],
  "partnerships": [
    {
      "category": {
        "pt": "Distribuição",
        "en": "Distribution"
      },
      "name": {
        "pt": "Operadores de campos e complexos desportivos",
        "en": "Pitch operators and sports complexes"
      },
      "why": {
        "pt": "Já têm os grupos concentrados; a app reduz-lhes no-shows e cancelamentos.",
        "en": "They already have the groups concentrated; the app reduces their no-shows and cancellations."
      }
    },
    {
      "category": {
        "pt": "Pagamentos",
        "en": "Payments"
      },
      "name": {
        "pt": "Easypay / SIBS (PT) · Stripe / Pix (BR)",
        "en": "Easypay / SIBS (PT) · Stripe / Pix (BR)"
      },
      "why": {
        "pt": "Processador licenciado — a PITCH nunca detém fundos de terceiros.",
        "en": "Licensed processor — PITCH never holds third-party funds."
      }
    },
    {
      "category": {
        "pt": "Mensageria",
        "en": "Messaging"
      },
      "name": {
        "pt": "WhatsApp Business API",
        "en": "WhatsApp Business API"
      },
      "why": {
        "pt": "Quando o volume justificar o custo por mensagem; até lá, wa.me deep links.",
        "en": "Once volume justifies the per-message cost; until then, wa.me deep links."
      }
    },
    {
      "category": {
        "pt": "Corporativo",
        "en": "Corporate"
      },
      "name": {
        "pt": "Departamentos de RH e bem-estar",
        "en": "HR and wellbeing departments"
      },
      "why": {
        "pt": "Orçamento real, ticket maior, sem sensibilidade a €10/mês.",
        "en": "Real budget, bigger ticket, no sensitivity to €10/month."
      }
    },
    {
      "category": {
        "pt": "Wearables",
        "en": "Wearables"
      },
      "name": {
        "pt": "Strava / Garmin (OAuth)",
        "en": "Strava / Garmin (OAuth)"
      },
      "why": {
        "pt": "Caminho barato para a Fase 4, sem construir visão computacional.",
        "en": "Cheap path to Phase 4, without building computer vision."
      }
    },
    {
      "category": {
        "pt": "Comunidade",
        "en": "Community"
      },
      "name": {
        "pt": "Associações universitárias e ligas informais",
        "en": "University associations and informal leagues"
      },
      "why": {
        "pt": "Densidade de grupos por metro quadrado — aquisição concentrada.",
        "en": "Groups per square metre — concentrated acquisition."
      }
    }
  ],
  "brandDeals": [
    {
      "title": {
        "pt": "Equipamento desportivo",
        "en": "Sports equipment"
      },
      "desc": {
        "pt": "Chuteiras e equipamento, com presença no cartão de jogador e nos destaques.",
        "en": "Boots and gear, with presence on the player card and highlights."
      }
    },
    {
      "title": {
        "pt": "Bebidas isotónicas",
        "en": "Isotonic drinks"
      },
      "desc": {
        "pt": "Naming ou skin do Golo da Semana.",
        "en": "Naming or a skin for Goal of the Week."
      }
    },
    {
      "title": {
        "pt": "Torneios patrocinados",
        "en": "Sponsored tournaments"
      },
      "desc": {
        "pt": "Torneios entre grupos com nome de marca.",
        "en": "Inter-group tournaments with a brand name."
      }
    },
    {
      "title": {
        "pt": "Clínicas e fisioterapia",
        "en": "Clinics and physiotherapy"
      },
      "desc": {
        "pt": "Geolocalizado por campo e cidade — alta intenção depois de uma lesão.",
        "en": "Geo-targeted by pitch and city — high intent after an injury."
      }
    },
    {
      "title": {
        "pt": "Apps complementares",
        "en": "Complementary apps"
      },
      "desc": {
        "pt": "Cross-promo com Strava e Garmin.",
        "en": "Cross-promo with Strava and Garmin."
      }
    },
    {
      "title": {
        "pt": "Cartão de jogador premium",
        "en": "Premium player card"
      },
      "desc": {
        "pt": "Skins de marca, sempre opt-in e nunca pay-to-win.",
        "en": "Branded skins, always opt-in and never pay-to-win."
      }
    }
  ],
  "management": {
    "now": {
      "pt": "Equipa fundadora, acumulando produto, engenharia e apoio ao cliente. É simultaneamente a maior força do projecto — ciclo de iteração muito curto, custo próximo de zero — e o seu maior risco de concentração.",
      "en": "Founding team, doubling as product, engineering and customer support. This is simultaneously the project''s greatest strength — very short iteration cycle, near-zero cost — and its biggest concentration risk."
    },
    "hires": [
      {
        "when": {
          "pt": "Ano 1",
          "en": "Year 1"
        },
        "role": {
          "pt": "— (só fundadores)",
          "en": "— (founders only)"
        },
        "trigger": {
          "pt": "Validar que grupos pagam antes de somar custo fixo.",
          "en": "Prove groups pay before adding fixed cost."
        },
        "cost": 0
      },
      {
        "when": {
          "pt": "Ano 2",
          "en": "Year 2"
        },
        "role": {
          "pt": "Suporte e comunidade (part-time)",
          "en": "Support & community (part-time)"
        },
        "trigger": {
          "pt": "~200 grupos pagantes; o suporte deixa de caber no tempo dos fundadores.",
          "en": "~200 paying groups; support no longer fits in founder time."
        },
        "cost": 18000
      },
      {
        "when": {
          "pt": "Ano 3",
          "en": "Year 3"
        },
        "role": {
          "pt": "Engenharia + parcerias/vendas (2–3 pessoas)",
          "en": "Engineering + partnerships/sales (2–3 people)"
        },
        "trigger": {
          "pt": "Entrada no Brasil e abertura dos canais de reservas e corporativo.",
          "en": "Brazil entry and opening the bookings and corporate channels."
        },
        "cost": 90000
      },
      {
        "when": {
          "pt": "Ano 3",
          "en": "Year 3"
        },
        "role": {
          "pt": "Operação Brasil (parceiro local)",
          "en": "Brazil operations (local partner)"
        },
        "trigger": {
          "pt": "Entidade, fiscalidade e Pix; só após PT provar retenção.",
          "en": "Entity, tax and Pix; only after PT proves retention."
        },
        "cost": 15000
      }
    ],
    "advisors": {
      "pt": "Contabilista certificado (PT), apoio jurídico pontual para termos, RGPD e contratos de parceria, e — idealmente — um mentor com experiência em marketplaces ou operação desportiva. Um operador de campos no advisory board vale mais do que capital.",
      "en": "Certified accountant (PT), ad-hoc legal support for terms, GDPR and partnership contracts, and — ideally — a mentor with marketplace or sports-operations experience. A pitch operator on the advisory board is worth more than capital."
    }
  },
  "risks": [
    {
      "risk": {
        "pt": "\"O WhatsApp grátis chega.\"",
        "en": "\"Free WhatsApp is good enough.\""
      },
      "mitigation": {
        "pt": "Fricção zero de entrada: o valor aparece mesmo com adopção parcial do grupo, e o link mágico convive com o WhatsApp em vez de o substituir.",
        "en": "Zero entry friction: value shows up even with partial group adoption, and the magic link coexists with WhatsApp instead of replacing it."
      }
    },
    {
      "risk": {
        "pt": "Vão pagar por algo já resolvido de graça?",
        "en": "Will they pay for something already solved for free?"
      },
      "mitigation": {
        "pt": "Freemium: o grátis resolve o jogo, o pago vende tempo poupado ao organizador — cobrança automática e zero perseguição de pagamentos.",
        "en": "Freemium: free solves the game, paid sells the organiser''s time back — automatic collection and no chasing payments."
      }
    },
    {
      "risk": {
        "pt": "Equipa muito pequena",
        "en": "Very small team"
      },
      "mitigation": {
        "pt": "Stack simples e barato, roteiro faseado, e nenhuma contratação antes do gatilho de receita correspondente.",
        "en": "Simple, cheap stack, phased roadmap, and no hire before its matching revenue trigger."
      }
    },
    {
      "risk": {
        "pt": "Brasil não validado",
        "en": "Brazil unvalidated"
      },
      "mitigation": {
        "pt": "O TAM inclui o Brasil por dimensão, mas a entrada só acontece depois de Portugal provar retenção. Nenhum custo brasileiro entra antes do ano 3.",
        "en": "TAM includes Brazil for scale, but entry only happens after Portugal proves retention. No Brazilian cost lands before Year 3."
      }
    },
    {
      "risk": {
        "pt": "Risco regulatório de pagamentos",
        "en": "Payments regulatory risk"
      },
      "mitigation": {
        "pt": "Sempre via processador licenciado, nunca fluxo directo. A PITCH não detém nem transfere fundos de terceiros.",
        "en": "Always via a licensed processor, never a direct flow. PITCH neither holds nor transfers third-party funds."
      }
    },
    {
      "risk": {
        "pt": "Visão computacional é terreno de players maiores",
        "en": "Computer vision is bigger players'' turf"
      },
      "mitigation": {
        "pt": "Adiada para a Fase 4 e reduzida ao mínimo: integrações OAuth em vez de reconhecimento de golo próprio.",
        "en": "Deferred to Phase 4 and reduced to the minimum: OAuth integrations instead of in-house goal recognition."
      }
    },
    {
      "risk": {
        "pt": "Concentração no fundador",
        "en": "Founder concentration"
      },
      "mitigation": {
        "pt": "Documentar operação e automatizar suporte antes de escalar; a contratação do ano 2 existe precisamente para reduzir este risco.",
        "en": "Document operations and automate support before scaling; the Year 2 hire exists precisely to reduce this risk."
      }
    }
  ],
  "nextSteps": [
    {
      "title": {
        "pt": "Substituir as estimativas de mercado por dados primários",
        "en": "Replace market estimates with primary data"
      },
      "desc": {
        "pt": "Um inquérito a 50–100 organizadores em PT dá TAM e disposição a pagar reais em poucas semanas.",
        "en": "A survey of 50–100 organisers in PT yields real TAM and willingness-to-pay within weeks."
      }
    },
    {
      "title": {
        "pt": "Medir retenção nos grupos activos",
        "en": "Measure retention in active groups"
      },
      "desc": {
        "pt": "Percentagem de grupos que continuam a marcar jogo ao fim de 4, 8 e 12 semanas — é a métrica que decide tudo o resto.",
        "en": "Share of groups still scheduling games after 4, 8 and 12 weeks — the metric that decides everything else."
      }
    },
    {
      "title": {
        "pt": "Fechar a integração MB Way",
        "en": "Ship the MB Way integration"
      },
      "desc": {
        "pt": "Sem ela não há via 1 nem via 2, e o plano financeiro é hipotético.",
        "en": "Without it there is no stream 1 and no stream 2, and the financial plan is hypothetical."
      }
    },
    {
      "title": {
        "pt": "Formalizar o caso Ziar Imóveis",
        "en": "Formalise the Ziar Imóveis case"
      },
      "desc": {
        "pt": "Transformar o sinal orgânico num case study com números de participação.",
        "en": "Turn organic signal into a case study with participation figures."
      }
    },
    {
      "title": {
        "pt": "Assinar um operador de campos piloto",
        "en": "Sign one pilot pitch operator"
      },
      "desc": {
        "pt": "Valida em simultâneo o canal de distribuição e a via de receita 4.",
        "en": "Validates the distribution channel and revenue stream 4 at the same time."
      }
    }
  ],
  "appendixNote": {
    "pt": "Documentos a anexar numa versão formal: currículo da equipa fundadora · demonstração do produto ou capturas de ecrã · dados de utilização actuais · contrato-modelo com operador de campos · termos e política de privacidade (RGPD) · orçamento do processador de pagamentos · projecção mensal de tesouraria a 24 meses.",
    "en": "Documents to attach in a formal version: founding team CVs · product demo or screenshots · current usage data · template pitch-operator agreement · terms and privacy policy (GDPR) · payment processor quote · 24-month monthly cash-flow projection."
  }
}'::jsonb,
    updated_at = now()
where id = 1;
