# Componentes visuais isolados — PITCH Ligas

Estado: primeira biblioteca de apresentação preparada, sem importação pelo app e sem alterações nas features.

## Base confirmada

- Repositório: `Capellavini/PitchFC`.
- Base acordada: `763e385`.
- Branch criada: `codex/pitch-ligas-redesign`.
- Cópia isolada: `work/pitch-ligas-redesign`, neste workspace.
- O `origin/main` observado já avançou além da base indicada; a cópia do redesign foi fixada deliberadamente em `763e385` para não incorporar mudanças concorrentes por acaso.

As features existentes não foram editadas ou importadas pela galeria. Os checkouts principal e do Claude foram preservados.

## O que foi construído

20 componentes React, cada um no seu próprio arquivo em `components/`:

| Grupo | Componentes |
|---|---|
| Tema e estrutura | PitchSurface, PageHeading, SectionHeading |
| Controles | PitchButton, FilterBar, SelectField, FormField |
| Futebol | LeagueCrest, StatusBadge, Scoreboard, MatchCard |
| Organização e números | StatStrip, TaskGroup, StandingsTable, PlayerRanking |
| Feedback e camadas | Notice, EmptyState, LoadingState, PitchDialog |
| Conteúdo público | LeaguePostCard |

`components/index.jsx` exporta a API. As dependências entre componentes são diretas, sem ciclos pelo arquivo de exportações.

## Limites de responsabilidade

- Os componentes recebem dados e callbacks; não importam hooks, rotas, estado global, serviços ou regras do PITCH.
- Scoreboard não escolhe vencedor nem homologa resultados. Recebe placar, desempate e `winnerTeamId` explicitamente.
- StandingsTable recebe linhas já calculadas e ordenadas. Não recalcula classificação ou desempates.
- FilterBar é controlado por `value` e `onChange`.
- FormField fornece rótulo, ajuda e erro acessíveis. Não cria contas, autentica usuários ou publica conteúdo.
- LeaguePostCard renderiza texto simples escapado. Editor rico, upload, permissões e persistência continuam sendo decisões da feature editorial.
- PitchDialog é controlado por `open`/`onClose` e usa o diálogo nativo, com Escape e gestão de foco.
- A prévia tem estado apenas em memória e usa dados fictícios próprios. Não grava ou envia dados do app.

## Integração básica

```jsx
import { PitchSurface, MatchCard } from './components/index.jsx';
import './components/styles.css';

<PitchSurface appearance="app">
  <MatchCard match={presentationMatch} onOpen={handleOpen} />
</PitchSurface>

<PitchSurface appearance="public" leagueColor={leagueColor}>
  {publicContent}
</PitchSurface>
```

Os caminhos serão adaptados ao destino definitivo. A camada global `C` do app não deve ser substituída diretamente por estes tokens. O isolamento permite preservar o visual das demais áreas do produto.

O modelo de apresentação usa `scheduled`, `live`, `provisional`, `official`, `review`, `postponed` e `cancelled`. A integração deve mapear os estados reais existentes do domínio para essas chaves; não mudar o domínio para caber na UI.

## Prévia executável

A galeria demonstra Painel, Jogos, Classificação, página pública/blog e formulários/estados. Permite alternar gestão/pública, cores da liga e larguras de PC, 390 e 320 px.

Para recompilar usando dependências já instaladas, sem downloads:

```powershell
node scripts/build.mjs --deps "C:/caminho/para/node_modules"
node --test preview/dist/components.test.cjs
```

A pasta de dependências deve disponibilizar React, React DOM e esbuild. A compilação produz `preview/pitch-ligas-componentes.html`, com os recursos incorporados para abrir a prévia sem servidor.

## Verificações

Sete testes automatizados cobrem os comportamentos abaixo:

1. Placar 0–0 preservado e penáltis separados do resultado.
2. Nenhum vencedor inventado quando o chamador não informa um.
3. Nomes completos e pontos recebidos preservados na tabela.
4. Relação acessível entre rótulo, campo, ajuda e erro.
5. Ação pendente desabilitada e com `aria-busy`.
6. Contraste das paletas públicas e isolamento da identidade PITCH.
7. Conteúdo editorial escapado, sem injeção de HTML.

Isso não substitui os testes do aplicativo nem a validação visual e de teclado em navegador. A conferência visual desta entrega ainda depende de uma sessão estável do Chrome; a conexão de controle apresentou falhas. Não está declarada aprovação visual final de PC/celular.

## Próxima integração com a base do Claude

O commit-base contém, entre outras, `LeagueManageSeason`, `LeagueManageImport`, `LeaguePlayerRequests`, `LeagueSeasonArchive` e `landing/LeagueLanding`. O redesign deve incluir essas superfícies e preservar os contratos novos de `playerRequests`, `seasons`, `athletePool` e o retorno `requested`, conforme o alinhamento trazido pelo usuário.

Não foram implementados nesta etapa os backends de login do adepto, Fantasy ou blog. O trabalho é a camada visual que poderá ser conectada a essas features.
