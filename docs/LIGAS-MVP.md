# PITCH Ligas — o que falta para um MVP com a AFPCE e Coimbra

28/10/2026. Complementa `docs/LIGAS-APP-V1.md`. Honesto sobre o estado de hoje.

## 1. Veredito

- **Para a reunião de quinta (AFPCE, 29/10 17:30): quase.** Falta a semente com a estrutura deles (1.ª e 2.ª divisão com folga, Taça da Associação, Taça da Cidade, Supertaça, Taça Fair Play, patrocinador titular). O resto da demonstração já conta a história: Painel, resultado provisório → oficial, castigos, Adjunto.
- **Para operar uma época real: não.** A app nova ainda corre sobre dados de demonstração no browser. O backend de ligas (contas, inscrições, calendário, eventos, homologação, disciplina, classificação) existe e está em produção, mas o ecrã novo ainda não o lê.
- **Ordem sensata:** AFPCE começa a época só no fim de novembro/início de dezembro, e a direção opera sozinha no primeiro ano. Coimbra já está em época (set–mai) e a dor deles é **publicar a tempo**. Logo: Coimbra entra primeiro como **publicação ao minuto** (resultados, classificação, castigos), a AFPCE entra na época nova como **operação completa**.

## 2. Coerência dos dados (auditoria de 28/10)

A liga é um **registo de eventos único**; tudo o resto é derivado dele. Os testes em `src/lib/leagueFlow.test.js` seguem um jogo do princípio ao fim e confirmam:

| Momento | O que muda, ao mesmo tempo |
|---|---|
| Resultado provisório | Aparece marcado como provisório nas estatísticas e na classificação provisória; **não** entra nos números oficiais; entra na fila do Gestor ("por homologar") e no resumo do Adjunto |
| Homologação | Golos e assistências entram no histórico do atleta; a jornada de cada jogo conta; a classificação oficial sobe; o cartão fica na disciplina; os pontos de Fantasy mexem; a fila do Gestor esvazia; a Equipa do capitão mostra o resultado; o adepto vê o marcador nos destaques |
| Correção depois de homologado | O jogo reabre (com motivo), o golo errado é substituído (nunca apagado), a estatística recalcula sem duplicar e fica o histórico de quem reabriu e homologou de novo |
| Craque oficial | Passa para o registo do atleta |

**Falha encontrada e corrigida:** a fila do Gestor só olhava para a jornada atual de cada competição, por isso um jogo de recuperação de uma jornada posterior, terminado enquanto a anterior continuava aberta, ficava **escondido**. Agora tudo o que espera decisão (contestação, resultado por homologar, jogo a decorrer) aparece, seja de que jornada for.

**Não está ligado (e deve estar):**
- Avisos: ninguém é avisado quando o resultado é homologado, quando uma convocatória falta ou quando um atleta fica suspenso. Hoje o aviso é o resumo por WhatsApp (`wa.me`), preparado e enviado à mão.
- A Taça Fair Play (amarelos × 1 + vermelhos × 3, decidida pelo Conselho de Disciplina) ainda não é calculada.
- As regras de castigo são as de demonstração (3 amarelos = 1 jogo, vermelho = 1 jogo). A regra real de cada liga tem de ser configurável.

## 3. Estamos com funcionalidades a mais?

Sim, para estas duas ligas. O que pediram é **menos trabalho para a direção**; boa parte do que existe é de produto de torcida e de jogador.

| Manter (núcleo) | Esconder por defeito (módulo por competição) |
|---|---|
| Calendário e conflitos, ficha de jogo, resultado provisório e oficial, homologação, classificação, castigos e Fair Play, plantéis com foto e número, página pública, Adjunto, resumo por WhatsApp | Fantasy, voto de craque dos adeptos, quadro tático e formações, comparar atletas, VAR, cartão OVR/FUT do atleta |

Razões: na AFPCE, no primeiro ano, **os clubes não mexem em nada** e o Fantasy é "gradualmente"; em Coimbra os adeptos são poucos. O OVR vem das avaliações dos colegas, que é um conceito do PITCH jogador e não existe numa liga. O atleta de liga deve ver **os seus jogos, golos, cartões e épocas**, não um cartão de atributos. Recomendação: ligar cada módulo por competição, todos desligados no arranque.

## 4. O que falta, por prioridade

### P0 — sem isto não há época real

1. **Ligar a app nova aos dados reais.** Um adaptador que faça o ecrã novo ler as chamadas que já existem (`competition_matches`, `match_page`, `competition_standings`, `record_match_event`, `homologate_match`…) em vez da semente. É o trabalho mais pesado. Alternativa de curto prazo: operar a primeira liga real com as telas de nuvem existentes e só depois mudar de pele.
2. **Importar plantéis e calendário (Excel).** A AFPCE tem ~700 atletas e 176 jogos: inserir à mão não é aceitável.
3. **Motor de competições na interface.** N voltas, folga em número ímpar, taça eliminatória, taça por grupos, jogo único (Supertaça, Taça de Honra). O backend tem criação de fases e calendários; falta confirmar folga e grupos e dar-lhes ecrã.
4. **Lançar o resultado depressa.** Caminho manual rápido para a direção (golos, cartões, minutos) e, depois, leitura do boletim por fotografia. O Adjunto com IA só acelera isto; **não pode ser a única via**.
5. **Castigos por regulamento.** Regras configuráveis por liga, lista de castigos publicada, alerta quando um suspenso aparece numa convocatória e decisão do Conselho de Disciplina registada (a AFPCE desclassifica por artigo; o PITCH propõe, a direção decide).
6. **Página pública da liga no modelo novo**, com logótipo, cor, nome e patrocinador, e entrada direta `/l/<slug>`. É o que resolve a dor de Coimbra ("publicar a tempo"). Hoje a página de nuvem existe, mas no estilo antigo.
7. **Permissões da direção.** Vários operadores por liga (dono, gestor, mesa). O backend já tem os papéis e os convites; falta a experiência.
8. **Legal e dados pessoais.** Aviso de privacidade e termos para ligas, consentimento para fotos e dados de atletas, menores só com iniciais (decisão já tomada). Não tratamos de seguros.
9. **Acompanhamento do piloto.** Aprovação do pedido de acesso, criação assistida da primeira liga (feita por nós com a direção, a partir do Excel) e um canal de suporte.

### P1 — logo a seguir

- Adjunto com IA: leitura de boletim por fotografia (só direção), cota diária, números verificados. Precisa de `ANTHROPIC_API_KEY` e `LEAGUE_COPILOT_ENABLED=true` no Vercel.
- Avisos reais (WhatsApp da liga, só direção).
- Taça Fair Play calculada; classificação por divisão.
- Plantéis públicos com atleta não inscrito sinalizado.
- Cartão da jornada para partilhar.

### P2 — só a pedido

- Importação do histórico de épocas (o Excel de Coimbra: 17–18 anos de jogos e golos).
- Fantasy e voto de craque nas ligas que o quiserem.
- Domínio próprio, widgets para incorporar no site da liga.
- Pagamentos e inscrições de clubes.

## 5. Onboarding

**Primeira liga (concierge, não autoatendimento).** O organizador cria conta em `/league/entrar`, pede acesso de piloto, nós aprovamos e fazemos com ele, numa sessão de 45 minutos: marca da liga → competições (divisões, taças, voltas) → clubes e plantéis a partir do Excel → calendário → regras de castigo. A pessoa sai com a época montada. Depois disso o Painel diz-lhe o que fazer cada semana.

**Primeira visita de cada papel (já feito na demo).** Cartão de boas-vindas com três linhas por papel (Gestor, capitão, atleta, adepto), dispensável para sempre.

**Painel de "primeiros passos" do Gestor (a fazer com os dados reais).** Lista curta que se calcula do estado: competição criada, clubes inscritos, plantéis entregues, calendário publicado, primeiro resultado homologado, página publicada. Desaparece quando está tudo feito.

## 6. Plano proposto

| Quando | O quê |
|---|---|
| Qua 28 | Polimento, coerência dos dados, este documento |
| **Qua 28–qui 29** | **Semente AFPCE** (estrutura deles) e ensaio da demonstração |
| Qui 29 17:30 | Reunião AFPCE: perguntar regras de castigo, legenda do boletim, operadores, licenças, autorização para logótipos |
| 30/10–03/11 | Para Coimbra: página pública ao minuto com os dados deles (calendário e plantéis importados) |
| Novembro | P0 até estar pronto para a época AFPCE |

## 7. Riscos

- **Dois mundos no código:** a app nova (demo) e as telas de nuvem (reais). Cada semana sem as juntar é dívida.
- **A IA não pode ser caminho crítico:** o boletim é escrito à mão e há campos ilegíveis. O fluxo manual tem de funcionar sozinho.
- **Escopo:** cada módulo de torcida que fica ligado por defeito dilui a mensagem "menos trabalho para a direção".
- **Isolamento de contas:** hoje é feito no ecrã; falta uma regra no servidor para que uma conta de liga não escreva em tabelas de outros produtos.

## 8. Atualização de 28/10 (noite): plataforma limpa e modular

- **Começa vazia.** Nenhum dado fictício na plataforma: a liga inventada passou para `src/lib/leagueExample.js` (só testes e o modo `/demo` de apresentações). Estados antigos guardados no browser são descartados e a liga arranca vazia.
- **Monta-se à mão.** O Gestor cria a liga, as competições (campeonato com 1–4 voltas, ou taça), as equipas, cola os plantéis (um atleta por linha, também do Excel), gera o calendário (com folga em número ímpar) e adiciona jogos soltos. O Painel mostra «Montar a liga» até estar tudo feito. Lógica pura em `src/lib/leagueSetup.js`, com testes.
- **Modular.** `src/lib/leagueModules.js` é o registo: Adjunto, Taça Fair Play, patrocinadores e área do adepto (leves), e voto dos adeptos, Fantasy, quadro tático, comparar, VAR e cartão OVR (desligados por defeito). Liga-se em Gerir → «Liga e módulos». Desligar esconde; os dados ficam.
- **Várias classificações.** `deriveLeague` calcula uma tabela por competição (1.ª e 2.ª Divisão lado a lado); as taças mostram as fases.
- **Ainda local.** Tudo isto vive no browser (como a demo). Guardar os módulos e a liga na nuvem faz parte do adaptador da app nova aos dados reais (P0 #1): não foi criada nenhuma migração.
- **AFPCE:** maquetes em PPT com os resultados públicos de 2025/26 (as classificações da 1.ª e 2.ª Divisão batem com as do site). A AFPCE não está carregada na plataforma.
