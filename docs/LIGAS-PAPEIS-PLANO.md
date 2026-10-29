# PITCH Ligas — papéis (capitão, atleta, adepto, co-gestor)

29/10/2026. Pedido do Vinicius: versão total, mesma linha de design da app de Ligas atual.

## 1. Ponto de partida

Numa conta real só existe o **gestor**. Capitão, atleta e adepto são vistas da demonstração («Ver como»). A liga é um documento por conta (`league_workspaces`), acessível só pelo dono. O WhatsApp só conhece o gestor. Na base relacional existem `league_members` e `league_invites`, mas só com `owner/manager/scorer/referee` e não estão ligados à app nova.

## 2. Decisão de arquitetura

Os papéis assentam **no documento da liga que já existe**, com tabelas de pertença e funções que dão a cada pessoa só a sua parte. Não esperam pela migração relacional (B1–B5): a vista de cada papel e os convites não mudam quando a base mudar por baixo. O que cada papel vê e escreve passa sempre por funções no servidor, nunca pelo cliente.

| Papel | Entra por | Vê | Escreve |
|---|---|---|---|
| **Gestor** (dono) | Conta de liga | Tudo | Tudo |
| **Capitão** | Convite por link, por equipa | Liga pública + o plantel completo da sua equipa | O plantel da sua equipa (nome, número, posição, capitão) |
| **Atleta** | Convite por link (da equipa ou do atleta) | Liga pública + o seu registo | O seu perfil (fase R5) |
| **Adepto** | Página pública sem login; conta opcional para seguir | Página pública | Equipa que apoia, a quem segue, votos (fase R5) |
| **Co-gestor / mesa** | Convite do dono | Tudo / o jogo | Tudo / lances (fase R6) |

## 3. Decisões por defeito (podem mudar)

1. **Atletas só com conta aos 18+.** Menores ficam geridos pelo capitão e pela direção, sem email nem telefone próprios. Data de nascimento nunca é pública e serve só para escalões.
2. **O capitão não mexe em resultados.** Só no plantel da própria equipa. Resultados e súmula ficam com o gestor (ou, mais tarde, com a mesa).
3. **Um link, uma pessoa.** Convite de capitão: 1 uso. Convite de atleta ligado a um registo do plantel: 1 uso. Convite de atleta da equipa (sem registo): até 60 usos, e o atleta escolhe-se no plantel.
4. **Convites expiram em 14 dias** e o gestor pode revogá-los.
5. **Apagar um atleta com historial é recusado** (golos, cartões, jogos), para não partir os lances já registados.

## 4. Fases (cada uma entra na main, testada, e é visível para o utilizador)

| Fase | Entrega | Estado |
|---|---|---|
| **R1** | Servidor: tabelas de pertença e convites, criar/ver/aceitar/revogar convites, «as minhas ligas», estado visto por cada papel, capitão grava o plantel, atleta escolhe quem é | **Feito** (PR #18) |
| **R2** | App: gestor cria convites por equipa (Gerir → Acessos), página de convite `/l/convite/<token>`, a app do gestor deixa de ficar presa em «conflito» quando um capitão grava (confirma a versão de 15 em 15 s) | **Feito** (PR #18) |
| **R3** | App: «As minhas ligas», vista do capitão (Equipa, jogos, classificação e plantel editável em «Eu») e do atleta (escolhe quem é, vê jogos e o seu registo), no design atual | **Feito, falta ver em produção** (PR #18). O capitão ainda não faz a convocatória nem contesta resultados: isso é R4 |
| **R4** | Perfil do atleta: email, telefone, data de nascimento (privados), escalão, convocatória | |
| **R5** | Adepto com conta: equipa que apoia, seguir, votos e notificações guardados por pessoa | |
| **R6** | Co-gestor e mesa (marcador de lances) com permissões finas | |
| **R7** | WhatsApp para capitães (convocatória, confirmação de plantel) e mensagens proativas (exige o bot 24 h, já na Fly) | |
| **B1–B5** | Migração do documento para as tabelas relacionais, sem mudar a experiência | Depois dos papéis |

## 5. Riscos conhecidos

- **Conflito entre gestor e capitão.** O capitão grava no mesmo documento. Um gestor com a app aberta ficaria em «conflito» na próxima alteração. A R2 faz a app do gestor confirmar a versão de tempos a tempos e recarregar sozinha quando não há alterações por guardar.
- **Menores.** A decisão 1 é conservadora de propósito. Falta confirmar com a AFPCE o consentimento exigido para menores antes de recolher dados de atletas com menos de 18 anos.
- **Identificação do atleta.** Reivindicar um registo do plantel por link é confiança no link. Mitigação: um uso por registo e o gestor vê quem aceitou e pode remover.
