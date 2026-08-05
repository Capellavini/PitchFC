# PITCH — Business Plan

> Estrutura baseada no [SCORE Business Plan Template for a Startup Business](https://www.score.org/resources/business-plan-template-startup-business).
>
> **Este ficheiro é a fonte de verdade editorial.** A página `/roadmap` renderiza o
> mesmo conteúdo a partir da tabela `roadmap_content` (JSONB, `id = 1`), editável em
> `/admin` → separador *Roadmap*. Quando alterares algo aqui, atualiza também o admin
> — ou vice-versa. O seed inicial está em [`docs/roadmap-seed.json`](./roadmap-seed.json).
>
> **Aviso, que deve sobreviver a qualquer cópia deste documento:** os números de mercado
> e financeiros abaixo são estimativas fundamentadas, não pesquisa primária. Ver
> [§10](#10--próximos-passos) para o que falta antes de isto poder ser mostrado a um
> investidor sem ressalvas.

Documento de trabalho · Agosto de 2026

---

## 1 — Sumário executivo

**O problema.** Milhões de jogos semanais são organizados à mão em grupos de WhatsApp:
contar quem vem, perseguir quem não pagou, sortear equipas de cabeça, reservar campo por
telefone. O organizador é um voluntário exausto, e o grupo perde o jogo quando ele desiste.

**A solução.** Uma aplicação web que absorve todo o trabalho do organizador — grelha de
confirmações, cobrança, sorteio equilibrado, matchday ao vivo, estatísticas e fantasy — sem
obrigar ninguém a instalar nada: o jogador confirma por link mágico no WhatsApp, num toque.

**Porquê agora.** Pagamento instantâneo (MB Way em PT, Pix no BR) tornou-se universal e
gratuito de iniciar; o WhatsApp é canal por omissão nos dois mercados; e as web apps
modernas eliminam a fricção da app store. As três peças que tornavam isto inviável há cinco
anos existem hoje.

**Estado actual.** Produto em produção e em uso real. Falta a peça de monetização: pagamento
MB Way nativo (hoje é um toggle manual do organizador) e os planos free/pro. Notificações
push estão codificadas mas desligadas.

**Modelo de receita.** Freemium por grupo (~€5–10/mês no plano Pro) + comissão sobre
pagamentos processados, escalando depois para reservas de campo, eventos corporativos,
patrocínios e licenciamento B2B.

**O pedido.** Capital de arranque modesto para cobrir 12 meses de infraestrutura, integração
de pagamentos e a primeira contratação part-time — ou uma parceria de distribuição com um
operador de campos. O plano não depende de ronda de investimento para chegar a receita.

---

## 2 — Descrição da empresa

**Missão.** Garantir que o jogo semanal acontece. Tudo o resto — estatísticas, fantasy, feed,
reservas — existe para tornar esse jogo mais fácil de organizar e mais difícil de abandonar.

**Forma legal e operação**

- **Estrutura** — sociedade unipessoal ou por quotas sediada em Portugal; expansão ao Brasil
  por entidade local ou parceiro de *merchant of record*, apenas depois de PT validar retenção.
- **Operação** — 100% remota e digital. Sem inventário, sem loja, sem armazém. O único activo
  físico eventual é o PITCH Club, na Fase 5, e só se o software o financiar.
- **Stack e custos fixos** — hospedagem serverless (Vercel), Supabase gerido e domínio: dezenas
  de euros por mês em fase inicial, escalando com o uso.
- **Pagamentos** — sempre através de processador licenciado (Easypay/SIBS em PT, Stripe/Pix no
  BR). A PITCH nunca detém fundos de terceiros.

**Despesas de arranque (12 meses)**

| Rubrica | Natureza | Ano 1 |
|---|---|---:|
| Infraestrutura (hosting, BD, domínio, e-mail) | Fixo | €600 |
| Integração e taxas de processador de pagamentos | Variável | €400 |
| Contabilidade, constituição e taxas legais | Fixo | €700 |
| Design, marca e conteúdo | Pontual | €300 |
| **Total** | | **≈ €2 000** |

O trabalho de desenvolvimento é feito internamente e não está monetizado nesta tabela. É o
principal custo de oportunidade do projecto e deve ser declarado como tal a qualquer investidor.

---

## 3 — O que já existe

| Módulo | Estado |
|---|---|
| **Grelha de confirmações** — 10 vagas, WhatsApp, pagamento por jogador, lista de espera automática | Em produção |
| **Sorteio de equipas** — equilibrado por posição, edição manual, equipas nomeadas | Em produção |
| **Matchday ao vivo** — golos, assistências, defesas, guarda-redes rotativo, campeonato e eliminatórias | Em produção |
| **Quadro tático** — arrastar jogadores, formações, notas por jogador | Em produção |
| **Stats e conquistas** — época, histórico, badges, MVP por votação, cartão FUT com avaliação de pares | Em produção |
| **Pitch Manager (Fantasy)** — liga interna com mercado, trocas, formações e pontuação real | Em produção |
| **Feed social** — posts, fotos e vídeo, Golo da Semana, amizades entre grupos | Em produção |
| **Identidade cross-group** — um jogador em vários grupos, stats próprias em cada um | Em produção |
| **Ferramentas de organizador** — auxiliares, remover/banir, cancelar e reagendar, reservas | Em produção |
| **Link mágico (sem login)** — confirmação por WhatsApp num toque | Em produção |
| **Notificações push** — fila automática pronta, falta activar | Código pronto |
| **Pagamento real (MB Way)** — hoje é um toggle manual | **Por fazer** |

---

## 4 — Roteiro de produto

**Fase 0 — Fundação: o organizador de bolso** *(concluída)*
O *wedge*: resolver por completo o jogo semanal de um grupo de amigos, sem exigir que ninguém
mude de app para participar.
`Confirmações` `Sorteio` `Matchday` `Stats` `Fantasy` `Social` `Multi-grupo`

**Fase 1 — Activar monetização e automação** *(0–6 meses)*
Ligar o que já existe mas está desligado, e construir o que falta para o organizador deixar de
fazer trabalho manual. É onde nasce a subscrição paga.
`MB Way real` `Push automático` `Lembretes agendados` `Jogo recorrente` `Planos free/pro`

**Fase 2 — Efeitos de rede** *(6–12 meses)*
Sair de "uma app por grupo isolado" para "uma rede de grupos". A identidade cross-group já
está construída — esta fase dá-lhe uso.
`"Falta 1 jogador"` `Rankings locais` `Seletor de grupos` `Convites com incentivo`

**Fase 3 — Reservas e eventos** *(12–18 meses)*
Entrar na transação que já acontece hoje por fora — reservar campo, cobrar aos jogadores — e
torná-la nativa, com operadores de campo como parceiros, não concorrentes.
`Marketplace de reservas` `Pacotes corporativos` `Torneios entre grupos`

**Fase 4 — Captura automática e conteúdo** *(18–24 meses)*
A aposta de maior risco técnico. Reconhecimento de golo por vídeo é o negócio inteiro de outras
empresas — começar pelo mais barato: integrações via OAuth.
`Strava / Garmin` `Vídeo destaques` `Golo da Semana com prémio`

**Fase 5 — PITCH Club & PITCH OS** *(24+ meses)*
O software financia e valida a marca antes de qualquer investimento físico. Só depois: um
espaço próprio, e a mesma plataforma licenciada a outros operadores.
`Campo físico (Porto/Matosinhos)` `PITCH OS white-label` `CRM para operadores`

---

## 5 — Produto e serviços: preçário

| Plano | Preço | Inclui |
|---|---|---|
| **Free** | €0 | 1 grupo, confirmações, sorteio, matchday e stats base. Sem limite de jogadores. O objectivo é que o grupo nunca tenha razão para sair. |
| **Pro** *(Fase 1)* | €5–10/mês por grupo | Cobrança automática MB Way, push e lembretes, jogo recorrente, fantasy completo, histórico ilimitado e exportação. |
| **Empresas** | Por evento ou anual | Torneios internos, marca da empresa, relatório de participação para RH. Já validado organicamente com um grupo real (Ziar Imóveis). |

---

## 6 — Análise de mercado

### Cliente-alvo

- **Comprador: o organizador.** 25–45 anos, urbano. Abre o grupo, conta os confirmados, adianta
  o dinheiro do campo e persegue quem não pagou. Compra tempo e paz de espírito — não compra
  *features*.
- **Utilizador: o jogador.** Quer confirmar em dois segundos e ver as suas estatísticas. Não
  instala nada. É por isso que o link mágico existe: a adopção não pode depender dele.
- **Segmento secundário: empresas.** RH e equipas que usam o futebol como actividade de coesão.
  Ticket maior, ciclo de venda mais longo, mas com orçamento real.
- **Segmento terciário: operadores de campo.** Complexos de futebol 5/7 que hoje gerem reservas
  por telefone e caderno. Cliente de Fase 3–5, tanto canal de distribuição como comprador.

### TAM · SAM · SOM (Portugal + Brasil)

| | Grupos | O que é |
|---|---:|---|
| **TAM** | ≈ 645 000 | Grupos que jogam com regularidade semanal ou quinzenal em PT + BR |
| **SAM** | ≈ 225 000 | Subconjunto digitalmente alcançável, já a pagar campo (35% do TAM) |
| **SOM** | ≈ 3 500 | Meta realista a 3–5 anos (≈1,6% do SAM), sem aquisição paga relevante |

> ⚠ **Metodologia — estimativa, não pesquisa primária.** Portugal ≈10,4M hab.; Brasil ≈213M.
> Assume-se que ≈7% da população portuguesa e ≈4% da brasileira joga futebol recreativo com
> regularidade semanal/quinzenal em grupo organizado (~700k jogadores em PT, ~8,5M no BR),
> divididos por grupos de ~15 pessoas → ~47k grupos em PT + ~570k no BR ≈ 645k. O SAM assume
> 35%. O SOM assume captação essencialmente orgânica.
> **Estes rácios devem ser substituídos por dados primários antes de qualquer utilização
> externa** — um inquérito a organizadores e dados de ocupação de operadores de campo são as
> duas fontes mais rápidas de obter.

---

## 7 — Avaliação competitiva

O concorrente real não é uma app. É o status quo gratuito.

| Categoria | O que resolve | Onde falha para o nosso cliente |
|---|---|---|
| **WhatsApp + folha de cálculo** *(o status quo, >90% do mercado)* | Toda a gente já lá está. Custo zero. | Trabalho manual todo em cima de uma pessoa; sem histórico, sem cobrança, sem lista de espera. O grupo morre quando o organizador desiste. |
| **Apps de gestão de equipa** *(Spond, TeamSnap, Heja)* | Presenças e comunicação para equipas federadas e desporto juvenil. | Desenhadas para uma equipa fixa com treinador, não para o jogo aberto entre amigos. Obrigam toda a gente a instalar e criar conta — a barreira que mata a adopção num grupo casual. |
| **Marketplaces de reserva** *(Playtomic, Matchi)* | Encontrar e reservar campo, sobretudo padel/ténis. | Resolvem o campo, não o grupo. Nada de sorteio, stats, fantasy ou vida do grupo entre jogos. Parceiro natural na Fase 3, não concorrente frontal. |
| **Captura de vídeo** *(Veo, Trace)* | Gravação e análise automática de jogos. | Hardware caro, orientado a clubes com orçamento. Fora do alcance de um grupo de amigos. Por isso a Fase 4 começa por OAuth e não por visão computacional própria. |

### Vantagem defensável

- **Fricção zero no lado do jogador.** Link mágico sem instalação nem conta. Nenhum concorrente
  de gestão de equipa faz isto, porque o modelo deles depende de contas.
- **Dados acumulados por grupo.** Histórico, ratings de pares e ligas fantasy criam custo de
  mudança que cresce todas as semanas e não se replica.
- **Identidade cross-group já construída.** A base técnica do "falta 1 jogador" — o efeito de
  rede real — existe antes de haver rede.
- **Amplitude do fluxo completo.** Confirmação → cobrança → sorteio → jogo → stats → fantasy num
  só sítio; os concorrentes cobrem um pedaço cada.

---

## 8 — Modelo de negócio: as 8 vias de receita

| # | Via | Fase | Base de cobrança |
|---:|---|---|---|
| 1 | Subscrição do organizador | 1 | Freemium; Pro ~€5–10/mês por grupo |
| 2 | Comissão em pagamentos | 1 | ~1,5–3% do valor processado |
| 3 | Marketplace "falta 1 jogador" | 2 | Taxa de matchmaking por vaga preenchida |
| 4 | Comissão em reservas de campo | 3 | % por reserva em campo parceiro |
| 5 | Eventos corporativos e torneios | sinal real hoje | Por evento ou contrato anual |
| 6 | Brand deals e patrocínios | 2–4 | Naming, skins, prémios patrocinados |
| 7 | PITCH OS — licenciamento B2B | 5 | Licença mensal por operador (white-label) |
| 8 | PITCH Club — receita física | 5 | Aluguer de campo, bar/F&B, eventos |

---

## 9 — Plano financeiro

### Cenário-base ilustrativo (3 anos)

| Ano | Grupos pagantes | Receita | Custos | Resultado | Principais fontes |
|---|---:|---:|---:|---:|---|
| Ano 1 | ≈ 50 | €5 600 | €2 000 | +€3 600 | Subscrições iniciais + 1.º piloto de brand deal |
| Ano 2 | ≈ 500 | €55 000 | €26 000 | +€29 000 | Subscrições + 1.º pacote corporativo + brand deal |
| Ano 3 | ≈ 3 000 | €304 000 | €155 000 | +€149 000 | Subscrições PT+BR, comissões, 2 pilotos B2B SaaS |

> ⚠ **Premissas.** Preço médio *blended* ≈€6–7/mês por grupo (mistura free/pro e PT/BR). O ano 2
> inclui a primeira contratação part-time (~€18k); o ano 3 inclui equipa de 2–3 pessoas (~€90k) e
> entrada operacional no Brasil (~€15k). Exclui capital de arranque e o custo de oportunidade da
> equipa fundadora.
> **O salto de 500 para 3 000 grupos no ano 3 é a premissa mais frágil de todo o plano** e depende
> inteiramente de o efeito de rede da Fase 2 funcionar.

### Modelo interativo

A página `/roadmap` inclui uma calculadora onde qualquer visitante substitui as nossas premissas
pelas dele. Implementação em [`src/components/RoadmapCalculator.jsx`](../src/components/RoadmapCalculator.jsx);
valores iniciais editáveis em `/admin` → Roadmap → *Calculadora*.

**Fórmulas (anuais, estado estável):**

```
subscrições    = grupos × preço × 12
volume na app  = grupos × jogadores × valor × jogos × 12 × (adopção / 100)
comissão       = volume na app × (comissão % / 100)
receita        = subscrições + comissão
custos         = fixos × 12 + grupos × variável × 12

contribuição por grupo = preço × 12
                       + jogadores × valor × jogos × 12 × (adopção/100) × (comissão%/100)
                       − variável × 12

break-even (nº de grupos) = ⌈ (fixos × 12) ÷ contribuição por grupo ⌉
```

**Cenário Base — calibrado para reproduzir a tabela acima:**

| Parâmetro | Valor |
|---|---:|
| Preço médio / grupo / mês | €7 |
| Jogadores por jogo | 14 |
| Valor por jogador / jogo | €5 |
| Jogos por mês | 4 |
| Pagamentos feitos dentro da app | 40% |
| Comissão retida | 2,0% |
| Custos fixos / mês | €1 800 |
| Custo variável / grupo / mês | €0,45 |

Com estes valores: 50 grupos → ≈€5,5k · 500 grupos → ≈€55k · 3 000 grupos → ≈€333k.
Break-even a **205 grupos pagantes**.

> **Limitações.** Modelo de estado estável: assume o número de grupos constante ao longo de doze
> meses e não modela crescimento, *churn* nem sazonalidade. Serve para testar ordem de grandeza e
> sensibilidade ao preço — não substitui uma projecção mensal de tesouraria.
>
> O parâmetro **"pagamentos feitos dentro da app"** é o mais optimista do modelo. Sem ele o
> cálculo assumiria que 100% do dinheiro do grupo passa pela PITCH, o que inflaciona a receita de
> comissões em ~2,5×.

---

## 10 — Marketing e vendas

**Proposta de valor:** *"Deixas de ser o secretário do grupo. O jogo organiza-se sozinho — e
ninguém tem de instalar nada."*

1. **Orgânico, liderado pelo produto.** O convite de grupo está embutido no ciclo central: cada
   jogo espalha o link por 10–15 pessoas. O cartão FUT e o Golo da Semana são naturalmente
   partilháveis; o "Wrapped" de época é o gancho sazonal.
2. **Parcerias de distribuição.** Co-marketing com operadores de futebol 5/7: eles já têm os
   grupos, nós damos-lhes uma ferramenta que reduz no-shows. Maior alavancagem por euro investido.
3. **Conteúdo e criadores.** Micro-criadores de "pelada" e futebol de rua em PT e BR — audiências
   pequenas, altíssima afinidade, custo baixo por parceria.
4. **Canal corporativo.** O caso Ziar Imóveis como *case study* para vender a RH de outras
   empresas. Venda directa, ticket maior, sem depender de viralidade.

### Parcerias-alvo

| Categoria | Quem | Porquê |
|---|---|---|
| Distribuição | Operadores de campos e complexos desportivos | Já têm os grupos; a app reduz-lhes no-shows |
| Pagamentos | Easypay / SIBS (PT) · Stripe / Pix (BR) | Processador licenciado — nunca detemos fundos |
| Mensageria | WhatsApp Business API | Quando o volume justificar o custo por mensagem |
| Corporativo | Departamentos de RH e bem-estar | Orçamento real, ticket maior |
| Wearables | Strava / Garmin (OAuth) | Caminho barato para a Fase 4 |
| Comunidade | Associações universitárias e ligas informais | Densidade de grupos por metro quadrado |

### Brand deals

Equipamento desportivo · bebidas isotónicas (naming do Golo da Semana) · torneios com nome
patrocinado · clínicas e fisioterapia (geolocalizado por campo) · apps complementares
(cross-promo Strava/Garmin) · cartão de jogador premium com skins de marca, sempre *opt-in* e
nunca *pay-to-win*.

---

## 11 — Plano de gestão

**Hoje.** Equipa fundadora, acumulando produto, engenharia e apoio ao cliente. É simultaneamente
a maior força do projecto — ciclo de iteração muito curto, custo próximo de zero — e o seu maior
risco de concentração.

| Quando | Função | Gatilho | Custo anual |
|---|---|---|---:|
| Ano 1 | — (só fundadores) | Validar que grupos pagam antes de somar custo fixo | €0 |
| Ano 2 | Suporte e comunidade (part-time) | ~200 grupos pagantes; o suporte deixa de caber no tempo dos fundadores | ≈ €18 000 |
| Ano 3 | Engenharia + parcerias/vendas (2–3 pessoas) | Entrada no Brasil e abertura dos canais de reservas e corporativo | ≈ €90 000 |
| Ano 3 | Operação Brasil (parceiro local) | Entidade, fiscalidade e Pix; só após PT provar retenção | ≈ €15 000 |

**Aconselhamento externo.** Contabilista certificado (PT), apoio jurídico pontual para termos,
RGPD e contratos de parceria, e — idealmente — um mentor com experiência em marketplaces ou
operação desportiva. Um operador de campos no *advisory board* vale mais do que capital.

---

## 12 — Riscos e mitigação

| Risco | Mitigação |
|---|---|
| **"O WhatsApp grátis chega."** | Fricção zero de entrada: o valor aparece mesmo com adopção parcial do grupo, e o link mágico convive com o WhatsApp em vez de o substituir. |
| **Vão pagar por algo já resolvido de graça?** | Freemium: o grátis resolve o jogo, o pago vende tempo poupado ao organizador — cobrança automática e zero perseguição de pagamentos. |
| **Equipa muito pequena** | Stack simples e barato, roteiro faseado, e nenhuma contratação antes do gatilho de receita correspondente. |
| **Brasil não validado** | O TAM inclui o Brasil por dimensão, mas a entrada só acontece depois de Portugal provar retenção. Nenhum custo brasileiro entra antes do ano 3. |
| **Risco regulatório de pagamentos** | Sempre via processador licenciado, nunca fluxo directo. A PITCH não detém nem transfere fundos de terceiros. |
| **Visão computacional é terreno de players maiores** | Adiada para a Fase 4 e reduzida ao mínimo: integrações OAuth em vez de reconhecimento de golo próprio. |
| **Concentração no fundador** | Documentar operação e automatizar suporte antes de escalar; a contratação do ano 2 existe precisamente para reduzir este risco. |

---

## 13 — Próximos passos

1. **Substituir as estimativas de mercado por dados primários.** Um inquérito a 50–100
   organizadores em PT dá TAM e disposição a pagar reais em poucas semanas.
2. **Medir retenção nos grupos activos.** Percentagem de grupos que continuam a marcar jogo ao
   fim de 4, 8 e 12 semanas — é a métrica que decide tudo o resto.
3. **Fechar a integração MB Way.** Sem ela não há via 1 nem via 2, e o plano financeiro é
   hipotético.
4. **Formalizar o caso Ziar Imóveis.** Transformar o sinal orgânico num *case study* com números
   de participação.
5. **Assinar um operador de campos piloto.** Valida em simultâneo o canal de distribuição e a via
   de receita 4.

**Documentos a anexar numa versão formal:** currículo da equipa fundadora · demonstração do
produto ou capturas de ecrã · dados de utilização actuais · contrato-modelo com operador de
campos · termos e política de privacidade (RGPD) · orçamento do processador de pagamentos ·
projecção mensal de tesouraria a 24 meses.

---

## Anexo A — Onde vive cada coisa no código

| Peça | Ficheiro |
|---|---|
| Página pública `/roadmap` | `src/components/RoadmapPage.jsx` |
| Calculadora interativa | `src/components/RoadmapCalculator.jsx` |
| Editor em `/admin` → Roadmap | `src/components/admin/AdminRoadmapTab.jsx` |
| Leitura/escrita do documento | `fetchRoadmapContent` / `saveRoadmapContent` em `src/hooks/useCloud.js` |
| Armazenamento | Supabase, tabela `roadmap_content`, coluna `data` (JSONB), `id = 1` |
| Seed inicial | `docs/roadmap-seed.json` |

**Esquema do documento** (todas as chaves opcionais — um documento antigo continua a renderizar):

```jsonc
{
  "hero":        { "tagline": "", "stats": [{ "value": "", "label": "" }] },
  "execSummary": [{ "title": "", "desc": "" }],
  "company":     { "mission": "", "operations": [{ "title": "", "desc": "" }],
                   "startupCosts": [{ "item": "", "kind": "", "amount": 0 }], "costsNote": "" },
  "today":       [{ "title": "", "desc": "", "status": "done|beta" }],
  "phases":      [{ "num": 0, "when": "", "title": "", "desc": "", "tags": [] }],
  "pricing":     [{ "name": "", "price": "", "desc": "", "highlight": "" }],
  "tam":         { "tam": { "value": 0, "label": "" }, "sam": {}, "som": {}, "assumptions": "" },
  "competitors": [{ "category": "", "examples": "", "solves": "", "fails": "" }],
  "advantages":  [{ "title": "", "desc": "" }],
  "revenueStreams": [{ "title": "", "desc": "", "statusLabel": "", "statusKind": "live|next|later" }],
  "financials":  { "rows": [{ "year": "", "groups": "", "revenue": 0, "costs": 0, "sources": "" }],
                   "assumptions": "" },
  "calculator":  { "groups": 0, "price": 0, "players": 0, "fee": 0, "games": 0,
                   "adoption": 0, "take": 0, "fixedMonthly": 0, "variablePerGroup": 0 },
  "calculatorNote": "",
  "marketing":   [{ "title": "", "desc": "" }],
  "partnerships":[{ "category": "", "name": "", "why": "" }],
  "brandDeals":  [{ "title": "", "desc": "" }],
  "management":  { "now": "", "hires": [{ "when": "", "role": "", "trigger": "", "cost": 0 }],
                   "advisors": "" },
  "risks":       [{ "risk": "", "mitigation": "" }],
  "nextSteps":   [{ "title": "", "desc": "" }],
  "appendixNote": ""
}
```
