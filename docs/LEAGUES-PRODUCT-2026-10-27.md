# PITCH Leagues — primeira versão da central de produto

**Adjunto, WhatsApp e Matchday:** a atualização posterior de 27/10 muda o nome público para Adjunto (Auxiliar técnico em PT-BR), acrescenta chat guiado local e acesso opcional ao Matchday, e mapeia receção de fichas pelo WhatsApp com acesso limitado e confirmação do remetente. Ver [plano e estado da integração](ADJUNTO-LIGAS-WHATSAPP-MATCHDAY.md). Referências a Copilot abaixo e em identificadores internos representam o nome anterior. O envio do chat à Anthropic foi autorizado em 27/10 e conectado no código para gestores; ativação e validação real no ambiente continuam pendentes. WhatsApp de Liga ainda não está ativo.

**Complemento AFPCE:** em 27/10 foi acrescentado o modelo específico de boletim de participantes fornecido pelo utilizador, com leitura estruturada por clube, efetivos/suplentes, licenças, equipa técnica, observações e pré-preenchimento para impressão. Ver `../../afpce-boletim-2026-10-27/BOLETIM-AFPCE-ESCOPO.md`. Total atualizado: 62 testes selecionados e 12 verificações adicionais de navegador para o boletim; a precisão de OCR em fichas preenchidas continua pendente.

27/10/2026 · Base `origin/main` em `52faad9`, numa cópia isolada. Alterações anteriores de identidade e prévia de confrontos preservadas. Não publicado e sem alterações no banco de produção.

## Decisões vindas das reuniões

O chat **Resumir reuniões do Read AI** foi consultado em 27/10. AFPCE: direção opera no primeiro ano; papel e Excel ainda são a fonte; prioridade a fichas, inscrição, cartões, homologação e divulgação. O piloto comercial mais recente proposto é gratuito por uma época e uma taça, com acompanhamento nos primeiros jogos e rotina semanal. Substitui a hipótese antiga de quatro jornadas. Não é contratação aceita pelo cliente.

Coimbra: consulta direta da Liga, resultados/classificação atualizados rapidamente, MVP oficial do árbitro e jogos organizados pelas equipas. Histórico dos jogadores/épocas é complemento. Modalidade e quantidade de equipas precisam ser confirmadas. Leitura das fichas por IA precisa de desenvolvimento e validação real; a apresentação comercial não certifica a implementação.

Tournify: adotar a clareza do percurso operacional e o planejamento por competição/rodada; acrescentar alertas de calendário e manter a governança oficial do Pitch. Diferenciar identidade da Liga de domínio próprio/app próprio. A central respeita os conceitos e funções já existentes em L1–L8.

## Implementação desta entrega

### Central em PC e telemóvel

`src/components/league/operations/` contém os componentes reais, não screenshots. Layout com navegação lateral e duas colunas em desktop; navegação inferior com deslocamento horizontal, cartões e formulários adaptados em mobile. Paleta vem de `C`, com navy/lima Pitch, estados semânticos e alvos de 44 px. Foco visível, labels, carregamento e erros explícitos. Texto novo em PT-PT; tradução integral para EN/PT-BR ainda pendente.

Áreas:

- **Visão geral:** fichas pendentes, resultados oficiais, clubes, atletas distintos, progresso e atalhos.
- **Fechar jornada:** filtro por jornada, fichas por validar e resultados homologados. Abre a ficha de jogo existente para a operação oficial.
- **Calendário:** busca, filtro, exportação CSV e detecção de possíveis sobreposições de local, descanso e árbitro. Usa duração da competição e descanso ajustável. Local é tratado como campo; nomes distintos são necessários para múltiplos campos no mesmo recinto. A demonstração permite alterar horário/local e recalcula os alertas; no modo conectado abre a gestão existente do jogo.
- **Clubes e atletas:** pesquisa, plantéis homologados, perfil com estatísticas por competição e CSV. Não expõe contatos ou inventa minutos de jogo.
- **Classificação:** reutiliza `LeagueCloudTable` no modo conectado, incluindo suas ações e estatísticas existentes; prévia local é calculada somente com placares homologados.
- **Disciplina:** reutiliza `LeagueCloudDiscipline`; no exemplo sem cartões, mostra estado vazio e distingue registo de sanção.
- **Copilot:** fotografia, conferência, rascunho e abertura da ficha oficial; análise determinística de pendências; resumo generativo opcional.
- **Comunicação:** resumos determinísticos só com resultados oficiais, modelos de aviso, revisão de público pretendido, rascunhos de sessão e exportação. Sem envio/publicação ainda.
- **Página da Liga:** prévia com identidade ou marca Pitch; edição existente de nome/descrição/emblema/cor em modo conectado. Não modifica visibilidade. Não implementa domínio, app próprio, patrocinadores ou anexos.
- **Implantação:** checklist de regulamento, plantéis, calendário, ficha, privacidade, formação e acompanhamento; exportação Markdown. Checklist local, não representa configuração do banco.

### Integração real e demonstração

Em `/league/<slug>`, owner/manager vê **Abrir central da Liga**. O endereço usa `?view=workspace`, preservando a chave privada quando existe. A central carrega competição, equipas, jogos de staff e estatísticas pelas funções existentes de `useLeagues`. Não cria outra base de resultados. Carregamento incompleto gera erro, sem mostrar zeros como se fossem dados válidos.

A ficha oficial abre na rota existente da competição com `?jogo=<id>`; lances, escalas, correções, MVP, homologação e histórico continuam nessa implementação. A nova conferência de OCR **não importa eventos automaticamente**. O rascunho pode ser exportado, e os dados são conferidos/introduzidos na ficha existente. Essa decisão evita simular integração que ainda não foi provada.

Demonstração dentro do app: `/league/demo?central=1`, com a mesma proteção de demo local/admin já existente. O seletor de perfis existe exclusivamente nessa demonstração. Não altera a conta nem concede permissões reais. Os dados e a homologação simulados só existem na sessão.

Prévia portátil gerada de `LeagueOperationsDemo` por `scripts/build-league-review.mjs`, em `review/league-operations/`. Para revisar: iniciar `node scripts/serve-league-review.mjs` e abrir `http://127.0.0.1:5257`. A prévia não tem chamadas de IA ou de produção.

## IA: o que foi desenvolvido

`api/league-copilot.js` prepara dois trabalhos: `sheet` e `recap`. Reutiliza o fornecedor Anthropic já presente no projeto, sem chave no cliente. Nenhuma chamada paga foi feita nesta implementação.

Ordem do serviço:

1. POST com Bearer, feature configurada e input limitado.
2. Fotografia JPG/PNG/WebP até 2,5 MB, base64 validado e assinatura básica do arquivo conferida.
3. Sessão validada no servidor com `getUser`.
4. Competição lida com JWT do chamador; papel de gestor conferido no servidor.
5. Para foto, jogo deve pertencer à competição. Para resumo, só resultados homologados entram no contexto; acima de 100, a versão exige recorte menor em vez de truncar silenciosamente.
6. Cota durável de 30 tentativas por utilizador/dia UTC, compartilhada entre competições. Sem RPC de cota disponível, a IA não é chamada.
7. Resposta por ferramenta estruturada; valores ilegíveis ficam nulos, alertas e nomes para conferência. Sem publicação, homologação ou escrita oficial.
8. Falha/timeout mantém transcrição manual. Logs não recebem imagem, nome ou texto da ficha.

Configuração necessária para ativar após revisão:

- `LEAGUE_COPILOT_ENABLED=true` no servidor.
- `ANTHROPIC_API_KEY` existente; modelo opcional `LEAGUE_COPILOT_MODEL`, padrão `claude-haiku-4-5`.
- URL/chave pública de Supabase no servidor, nos nomes já usados no projeto.
- Migração `20261027083112_league_copilot_quota.sql`, gerada pela CLI e preparada neste checkout. Aplicar somente pelo processo Git/CI do projeto. Não aplicada durante esta entrega.

O endpoint não utiliza `service_role`. A tabela de cota tem RLS e não concede acesso direto a anon/authenticated. A função de cota é `security definer`, com search_path fechado, `auth.uid` e autorização de gestor; execução pública/anônima revogada. Falta validação da migração em ambiente de teste antes do CI de produção. Consumo/retention da tabela de cota deve entrar na operação; a tabela não guarda documentos.

### Copilot da equipa

Primeira interação demonstrável com disponibilidade por atleta, exclusão de não confirmados, exigência de guarda-redes e quantidade em campo. Sugestão considera produção por ficha apenas a partir de três fichas. Bloqueio de suspensos está previsto na função pura e testado, mas ainda não conectado à tela de demonstração ou à área real da equipa. Não existe publicação de convocatória nova nesse fluxo.

Correlação jogador/vitória, pares e sugestões táticas baseadas em minutos não são calculadas com plantéis ou totais agregados. A tela informa insuficiência de dados. Sem atribuir causalidade, inferir posição desconhecida ou inventar histórico. Próxima integração deve usar disponibilidade, suspensão efetiva, convocatória e participação real com escopo da própria equipa.

## Validação

- **52 testes selecionados passaram**: regras de liga, acesso, homologação, calendário, identidade, sugestões e serviço de IA. Os 16 testes novos incluem bloqueio de acesso/cota, isolamento de competição, placar oficial no resumo, proteção de CSV e filtros de disponibilidade. Endpoint testado com dependências simuladas, sem fornecedor/banco real.
- **24 checagens de navegador passaram**, sem exceções JS, usando a prévia local: revisão obrigatória antes de homologação simulada, indicadores e tabela atualizados, conflitos e alteração de campo que os resolve, busca de atleta, rascunho manual, revisão, resumo sem placar provisório, perfis e sugestão de equipa. Sem overflow de página em 320, 390 e 768 px. Capturas também em 1440 px.
- Build Vite passou. Aviso de bundle grande já existia; o novo código ainda deve ser separado por carregamento de rota antes de ampliar o rollout.
- Migração nova, OCR real, consumo do modelo e escrita oficial em produção **não foram exercitados**.

## Próximos blocos, por dependência

1. Rever central com Vinicius/Claude e uma ficha real anonimizada. Validar o regulamento e modalidade de cada piloto.
2. Ambiente de teste: aplicar/verificar cota e autorização, testar OCR com fichas boas/ruins, nomes repetidos, rasuras, orientação e dados ausentes. Medir erro por campo e custo por ficha. Provar separação entre rascunho e oficial.
3. Importação de rascunho à ficha oficial: identificação explícita dos jogadores, diferença contra eventos existentes, revisão de alterações, idempotência, seq e audit log. Nenhuma reescrita em massa por IA.
4. Disponibilidade/convocatória por equipa ligada ao backend existente e isolamento por papel. Depois, estatísticas de participação e histórico de temporadas.
5. Comunicados com persistência e destinatários, aprovação/publicação e trilha de envio. Patrocinadores e documentos autorizados na LP.
6. Motor de taça/grupos necessário ao regulamento contratado. O calendário atual de pontos corridos não cobre qualquer formato do Tournify.
7. Exportações conferidas, teste de duas contas simultâneas, acessibilidade por teclado/leitor e celular físico; fechamento de jornada com cliente.

Não publicar nem prometer paridade integral com Tournify a partir da prévia. O material visual, o código conectado, o banco aplicado e o fluxo operacional validado são evidências diferentes.
