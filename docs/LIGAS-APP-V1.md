# PITCH Ligas — a app (v1), a partir das reuniões com AFPCE e Coimbra

27/10/2026 · Base de código: `feat/ligas-app` (origem `52faad9` + base do GPT importada sem alterações no commit `18b4c3b`). Complementa `docs/LIGAS-ADJUNTO-LP-PLANO.md` (Adjunto, boletim, Página da Liga). Fontes: transcrições Read AI de 23/10 (AFPCE) e 26/10 (Coimbra).

## 1. Datas que mandam

| Data | O quê |
|---|---|
| **Quinta 29/10, 17:30** | Reunião presencial na sede da AFPCE (Espinho) com o vice-presidente e o presidente. Levar uma demonstração com **a estrutura deles**. |
| **Terça 03/11, 12:00** | Reunião com Coimbra (Ricardo Goucha e Pinto Nunes), local a combinar. |
| Fim de nov/início de dez | Arranque da época AFPCE (agora estão em inscrições de atletas e seguros). |

## 2. O que as duas ligas dizem (e o que isso muda)

**AFPCE (Espinho)**: direção nova, a reestruturar; 17 clubes (19 no próximo ano), ~700 atletas, 1ª e 2ª divisão, Taça da Associação, Taça da Cidade de Espinho e Supertaça; 176 jogos na época; 8 por fim de semana (4+4), sábado e domingo; duas voltas (era três); uma divisão é ímpar, logo há folga. Hoje: ficha de jogo em papel entregue à liga, e à **segunda-feira** a direção digitaliza tudo (minutos, convocados, amarelos, vermelhos) no Excel. Contar cartões é "burocracia que custa tempo". Querem **transparência total**: portal com nome e foto de cada atleta, para um clube ver quem está inscrito e saber se um adversário usou um atleta não inscrito. O site é antigo e querem-no alimentado automaticamente. **Primeiro ano: só a direção opera; os clubes não mexem em nada** ("fase embrionária"; o risco é alguém sem prática estragar dados). Fantasy e voto de craque: "gradualmente", depois do modelo básico.

**Coimbra**: 18 anos, setembro a maio, ~300 atletas (mais de 2000 já passaram por lá). Taça de Honra, duas ligas (1ª com 3 equipas? e 2ª com 6, a confirmar), Taça da Liga (grupos) e Taça (eliminatórias). Árbitro faz a ficha e envia; a organização publica no **blog oficial** (fichas, calendários, castigos, classificações) e trata a estatística em **Excel**. A dor número 1 não é a estatística: é **publicar a tempo**. Os resultados e a classificação chegam dias depois e "a malta chateia". Querem **classificação e resultados "ao minuto"**. Têm um Excel com **todas as épocas** (jogos e golos por jogador, 17-18 anos) e os atletas adoram ver os totais. As equipas organizam os próprios jogos (a equipa da casa define hora e recinto); a liga lança o calendário e as condições. Adeptos: poucos; seguem sobretudo jogadores e organizadores de equipa. Entram em dúvida com "demasiados passos": **a app deve levar direto à competição**.

### Consequências de produto

1. **O produto é "menos trabalho para a direção", não "mais funcionalidades".** O resultado tem de sair no domingo de manhã e a segunda-feira de digitalização tem de desaparecer.
2. **Duas velocidades de verdade.** *Resultado provisório* imediato (mesa/árbitro/direção, por link ou WhatsApp) e *oficial* depois da conferência e homologação pela direção. A classificação mostra a oficial e, com um interruptor, a provisória (marcada como tal).
3. **Perfil de operação por liga** (configuração, não código):
   - **Direção opera tudo** (AFPCE, ano 1): clubes e atletas só consultam; só a direção regista, importa e homologa.
   - **Equipas participam** (Coimbra): a equipa da casa marca hora e recinto; capitães confirmam convocatória; árbitros ou mesa enviam o resultado provisório.
4. **Castigos automáticos**: contagem de amarelos/vermelhos e suspensões por regra da liga, com lista publicada ("castigos" é uma secção do blog de Coimbra) e alerta quando um suspenso aparece numa convocatória.
5. **Inscrição e transparência**: plantel por clube com foto, número, licença e **seguro** (estado/validade); página pública do plantel; o Adjunto assinala atleta **não inscrito** na ficha.
6. **Histórico de carreira**: importar o Excel de épocas anteriores para o PITCH ID. Atletas veem jogos, golos e épocas na liga (é o gancho que Coimbra descreveu).
7. **A página pública substitui o blog/site** (e liga-se ao site existente): classificação, calendário, resultados, fichas, castigos, plantéis, e **widgets/feed incorporáveis** para o site atual da AFPCE. Cartão da jornada para Facebook/Instagram (Coimbra publica no Facebook).
8. **Motor de competições real**: liga a N voltas com folga, taça eliminatória, taça por grupos, jogo único (Supertaça/Taça de Honra). Sem isto não cobre nenhuma das duas.
9. **Entrada direta**: `/l/<slug>` abre a competição, sem passar por "grupos" nem por escolhas. Quem já tem PITCH fica no mesmo login.
10. **Adeptos, Fantasy e voto**: ficam como módulos **desligados por defeito**, ligados por competição (decisão: entram na v1, mas a mensagem a estas ligas é a operação, não a torcida).

## 3. Arquitetura (decisão)

Há dois mundos no repositório que não se falam:

- **A app de ligas PITCH** (`LeagueContextApp`): estilo PITCH, 4 papéis (Torcedor, Atleta, Capitão, Gestor), 5 abas, estado e regras puras em `lib/core/league.js` sobre a semente de `leagueDemo.js`.
- **A Central do GPT** (`league/operations/*`): operação da direção (conferência de fichas, calendário com conflitos, Adjunto, boletim AFPCE, comunicação, implantação) com **semente e estilo próprios**.

**Decisão:** uma só app. A app PITCH é a casca; a Central passa a ser o **Início e a área "Gerir" do Gestor**, a correr sobre o **mesmo estado** (`leagueDemo` + `core/league`), no estilo PITCH (componentes `Chip`, `SectionLabel`, `BtnPrimary`, `cardStyle`, tokens `C/S/T`, navegação inferior em 5 abas). O que a Central tem de bom (regras puras testadas, boletim, conflitos, Adjunto, CSV) é reaproveitado como biblioteca; o que é puramente visual é refeito.

Navegação por papel (inferior, máximo 5):

| Papel | Abas |
|---|---|
| Gestor | **Hoje** · Jornada · Calendário · Clubes · Mais (Adjunto, Comunicação, Página, Regulamento) |
| Capitão/Clube | Início · Jogos · Equipa · Classificação · Mais |
| Atleta | Início · Jogos · Classificação · Perfil (PITCH ID) · Mais |
| Adepto | Início · Jogos · Classificação · Fantasy (se ligado) · Mais |

**"Hoje" do Gestor** é uma fila de trabalho, não um painel de números: o que precisa de ação agora (fichas por ler, por conferir e por homologar; fichas em falta; atletas sem inscrição ou suspensos em jogos desta jornada; conflitos de calendário; comunicados a aprovar), cada item com **um botão** que resolve ou abre o passo certo. O Adjunto vive aqui.

## 4. Âmbito da demonstração de quinta (AFPCE) — v0

Uma liga fictícia com a **estrutura da AFPCE** (1ª e 2ª divisão, folga em número ímpar, 2 voltas, Taça + Supertaça; clubes e atletas fictícios), no estilo PITCH, em telemóvel e portátil:

1. **Hoje** (fila de trabalho) com a semana de jogos.
2. **Ficha → resultado**: foto do boletim (exemplo) → leitura → conferência → homologar → classificação, castigos e página pública atualizam.
3. **Castigos** gerados por cartões, com alerta numa convocatória.
4. **Plantéis** com foto/licença/seguro e um atleta não inscrito sinalizado.
5. **Página da Liga** (marca da AFPCE: logo e cor a pedido deles) com destaques e cartão da jornada; ligação ao site deles (widget).
6. **Adjunto** no WhatsApp/chat: resumo de segunda-feira e "peço as fichas em falta?".
7. Fora de âmbito na quinta: pagamentos, formação de clubes, Fantasy (mostrar só como "módulo a ligar depois").

## 5. Ordem de construção (fatias verticais)

1. **Casca PITCH + "Hoje" do Gestor** sobre o estado único; remover o seletor de perfis do GPT (mantê-lo só como "ver como" da demo PITCH, que já existe).
2. **Motor de competições**: voltas, folga, taça, grupos, jogo único. Semente AFPCE.
3. **Ficha ↔ resultado** com provisório/oficial; classificação com interruptor.
4. **Castigos por regra** + alertas.
5. **Plantéis/inscrição/seguro** + histórico (importação).
6. **Página da Liga** v2 (tokens de marca, destaques, widgets, cartão da jornada).
7. **Adjunto das Ligas** (boletim por foto, delegado, números verificados) — o plano já existe.
8. **Importadores** (Excel de plantéis, calendário e épocas anteriores).

## 6. Decisões já tomadas (27/10, Vinicius)

- Reutilizar o **número de WhatsApp existente** do bot.
- O boletim por WhatsApp é **só para a direção** (não para delegados) nesta fase.
- **Marca da Liga** (white label) entra na v1; domínio próprio fica para depois.
- **Voto de adeptos** entra na v1 (módulo ligável).

## 7. Perguntas para as reuniões

**AFPCE (29/10):** quantas divisões e equipas por divisão e como se fazem as voltas; datas de arranque; regras de cartões e suspensões; legenda das colunas do boletim; n.º máximo de suplentes; como registam seguros e licenças; quem vai operar (que papéis); e **autorização para usar logótipos e nomes de clubes** do site deles.
**Coimbra (03/11):** n.º de equipas das duas ligas; formato exato das taças; quem lança o resultado hoje (árbitro vs direção); como querem receber a ficha; o Excel histórico (formato, anonimização); e se o blog é para manter ou substituir.
