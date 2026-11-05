import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PitchSurface, PitchButton, StatusBadge, LeagueCrest, PageHeading, SectionHeading, MatchCard,
  FilterBar, SelectField, FormField, StatStrip, TaskGroup, StandingsTable, PlayerRanking,
  Notice, EmptyState, LoadingState, PitchDialog, LeaguePostCard, Scoreboard,
} from '../components/index.jsx';
import { matches, standings, players, finalMatch, post } from './demo-data.mjs';
import '../components/styles.css';
import './preview.css';

function Preview() {
  const [page, setPage] = useState('panel');
  const [appearance, setAppearance] = useState('app');
  const [device, setDevice] = useState('pc');
  const [color, setColor] = useState('#355BC4');
  const [filter, setFilter] = useState('all');
  const [competition, setCompetition] = useState('league');
  const [dialog, setDialog] = useState(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draftTitle, setDraftTitle] = useState(post.title);
  const [draftText, setDraftText] = useState(post.excerpt);
  const provisional = matches.filter(match => match.state === 'provisional');
  const scheduled = matches.filter(match => match.state === 'scheduled');
  const choosePage = next => { setPage(next); setAppearance(next === 'public' ? 'public' : 'app'); };
  const review = () => { setPage('games'); setCompetition('league'); setFilter('provisional'); };
  const openMatch = match => setDialog({ title:match.state === 'scheduled' ? 'Próximo encontro' : 'Ficha do jogo', match });
  const actions = <SelectField label="Competição" value={competition} onChange={event => setCompetition(event.target.value)}
    options={[{value:'league',label:'Liga Piloto'},{value:'cup',label:'Taça Piloto'}]} />;
  const matchContent = dialog?.match ? <><Scoreboard {...dialog.match} kickoffLabel={dialog.match.timeLabel} />
    <p>{dialog.match.dateLabel} · {dialog.match.venue}</p>
    <p>Prévia visual. Resultado e estado são recebidos do aplicativo; nenhuma homologação é executada aqui.</p></> : <p>{dialog?.body}</p>;

  return <div className="pl-demo" data-device={device}>
    <header className="pl-demo-toolbar"><div><b>PITCH LIGAS</b><span>Componentes isolados · dados fictícios</span></div>
      <div className="pl-demo-controls"><label>Tamanho<select value={device} onChange={event=>setDevice(event.target.value)}><option value="pc">PC</option><option value="mobile">Celular · 390 px</option><option value="small">Celular · 320 px</option></select></label>
        <label>Superfície<select value={appearance} onChange={event=>setAppearance(event.target.value)}><option value="app">Gestão · PITCH</option><option value="public">Pública · liga</option></select></label>
        {appearance === 'public' && <label>Cor da liga<select value={color} onChange={event=>setColor(event.target.value)}><option value="#355BC4">Azul</option><option value="#983956">Bordô</option><option value="#21775C">Verde</option><option value="#FFFF00">Amarelo claro</option></select></label>}
      </div>
    </header>
    <div className="pl-demo-stage"><div className="pl-demo-frame"><PitchSurface appearance={appearance} leagueColor={color}>
      <header className="pl-demo-mast"><div className="pl-demo-wordmark">PITCH<small>LIGAS</small></div><span>Liga Piloto · 2026/27</span></header>
      <nav className="pl-demo-nav" aria-label="Navegação da prévia">{[
        ['panel','Painel'],['games','Jogos'],['table','Classificação'],['public','Pública e blog'],['states','Formulários e estados'],
      ].map(([id,label])=><button key={id} type="button" aria-current={page===id?'page':undefined} onClick={()=>choosePage(id)}>{label}</button>)}</nav>
      <main className="pl-demo-content">
        {page==='panel' && <>
          <PageHeading eyebrow="Liga Piloto · jornada 11" title="Dia de jogo." description="Os encontros em campo e as decisões da direção." actions={actions} />
          <div className="pl-demo-columns"><MatchCard match={matches[2]} onOpen={openMatch} featured />
            <section className="pl-demo-pending"><span>02</span><h2>Resultados para rever.</h2><p>Confere as fichas antes de os tornar oficiais.</p><PitchButton onClick={review}>Rever fichas →</PitchButton></section></div>
          <StatStrip items={[{label:'Jogos nesta prévia',value:matches.length},{label:'Por homologar',value:provisional.length},{label:'Próximos jogos',value:scheduled.length}]} />
          <div className="pl-demo-columns"><TaskGroup title="Na secretaria" items={[
            {id:'results',title:'Resultados por homologar',description:'Fichas recebidas · jornada 11',count:provisional.length,onClick:review},
            {id:'callups',title:'Convocatórias por completar',description:'Agrupadas por jogo',count:4,onClick:()=>setDialog({title:'Convocatórias',body:'Área de convocatórias agrupadas. O comportamento real será conectado ao fluxo existente do PITCH Ligas.'})},
          ]}/><section><SectionHeading title="Na frente" aside={<PitchButton variant="ghost" onClick={()=>choosePage('table')}>Ver tabela ↗</PitchButton>} /><StandingsTable rows={standings.slice(0,4)} caption="Primeiras quatro equipas · J10" /></section></div>
        </>}
        {page==='games' && <>
          <PageHeading eyebrow="Liga Piloto · jogos" title="Todos a jogo." description="Calendário, resultados e desempates legíveis." actions={actions} />
          {competition==='cup' ? <MatchCard match={finalMatch} onOpen={openMatch} featured /> : <>
            <FilterBar value={filter} onChange={setFilter} options={[
              {value:'all',label:'Todos',count:matches.length},{value:'provisional',label:'Por homologar',count:provisional.length},{value:'scheduled',label:'Próximos',count:scheduled.length},
            ]}/><div className="pl-demo-match-grid" aria-live="polite">{matches.filter(match=>filter==='all'||match.state===filter).map(match=><MatchCard key={match.id} match={match} onOpen={openMatch} />)}</div>
          </>}
        </>}
        {page==='table' && <>
          <PageHeading eyebrow="Liga Piloto · oficial" title="A luta pelo topo." description="Nomes reconhecíveis e pontos sempre visíveis." actions={actions} />
          {competition==='cup' ? <MatchCard match={finalMatch} onOpen={openMatch} featured /> : <div className="pl-demo-table-layout"><StandingsTable rows={standings} caption="Classificação oficial · após a jornada 10" onTeamSelect={team=>setDialog({title:team.name,body:'Ponto de integração para a ficha da equipa.'})}/><PlayerRanking players={players}/></div>}
        </>}
        {page==='public' && <>
          <PageHeading eyebrow="Cidade Teste · Liga Piloto" title="A tua liga. Todo o jogo." description="Resultados, próximos encontros e histórias da liga." />
          <div className="pl-demo-columns"><MatchCard match={matches[2]} featured onOpen={openMatch}/><PlayerRanking players={players} title="O golo tem nome" /></div>
          <div className="pl-demo-section"><SectionHeading title="Pela liga"/><div className="pl-demo-columns"><LeaguePostCard post={post} onOpen={p=>setDialog({title:p.title,body:p.excerpt})}/><section className="pl-demo-stack"><SectionHeading title="Na taça"/><MatchCard match={finalMatch} onOpen={openMatch}/><Notice title="Conta do adepto">A entrada no Fantasy terá cadastro, login e retorno à liga. Aqui estamos a preparar apenas a apresentação visual.</Notice></section></div></div>
        </>}
        {page==='states' && <>
          <PageHeading eyebrow="PITCH Ligas · base visual" title="Em todos os estados." description="Formulários, feedback e ações preparados para integração." />
          <div className="pl-demo-stack"><section><SectionHeading title="Ações e estados"/><div className="pl-demo-actions"><PitchButton onClick={()=>setDialog({title:'Ação principal',body:'Esta ação é demonstrativa; não altera o app.'})}>Ação principal</PitchButton><PitchButton variant="secondary">Secundária</PitchButton><PitchButton disabled>Desativado</PitchButton><PitchButton loading>A guardar</PitchButton><PitchButton variant="danger">Remover</PitchButton></div><div className="pl-demo-actions" style={{marginTop:18}}>{['scheduled','live','provisional','official','review','postponed','cancelled'].map(state=><StatusBadge key={state} state={state}/>)}</div></section>
            <div className="pl-demo-columns"><section className="pl-demo-form-panel"><SectionHeading title="Conta do adepto"/>
              <form noValidate onSubmit={event=>{event.preventDefault();setSubmitted(true)}} className="pl-demo-stack">
                <FormField label="Nome" autoComplete="off" required value={formName} onChange={event=>setFormName(event.target.value)} error={submitted&&!formName.trim()?'Indica o teu nome.':undefined}/>
                <FormField label="E-mail" type="email" autoComplete="off" required value={formEmail} onChange={event=>setFormEmail(event.target.value)} hint="Usado para entrar e recuperar o acesso à conta." error={submitted&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)?'Indica um endereço de e-mail válido.':undefined}/>
                <PitchButton type="submit">Pré-visualizar validação</PitchButton>
                {submitted&&formName.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)&&<Notice tone="success" title="Campos válidos">Demonstração local. Nenhuma conta foi criada.</Notice>}
              </form></section><section className="pl-demo-form-panel"><SectionHeading title="Publicação da liga"/><form onSubmit={event=>{event.preventDefault();setSaved(true)}} className="pl-demo-stack">
                <FormField label="Título" required value={draftTitle} onChange={event=>{setDraftTitle(event.target.value);setSaved(false)}}/>
                <FormField label="Texto" multiline required value={draftText} onChange={event=>{setDraftText(event.target.value);setSaved(false)}} hint="Prévia de campos; edição e persistência serão ligadas à feature editorial."/>
                <PitchButton variant="secondary" type="submit">Simular guardar rascunho</PitchButton>{saved&&<Notice tone="success" title="Prévia atualizada">O texto foi mantido apenas nesta sessão da demonstração.</Notice>}
              </form></section></div>
            <Notice tone="error" title="Não foi possível carregar">Exemplo de erro com uma ação de recuperação.</Notice>
            <Notice tone="warning" title="Resultado provisório">Este jogo só entra na tabela depois da homologação.</Notice>
            <EmptyState title="Ainda não há jogos nesta fase." description="O calendário aparece aqui quando os encontros forem adicionados." action={<PitchButton variant="secondary" onClick={()=>choosePage('games')}>Ver exemplo com jogos</PitchButton>}/>
            <LoadingState />
          </div>
        </>}
      </main>
      <footer className="pl-demo-footer"><span>PITCH Ligas · preparação visual</span><span>Sem ligação às features ou aos dados do app</span></footer>
      <PitchDialog open={Boolean(dialog)} title={dialog?.title || 'Detalhe'} onClose={()=>setDialog(null)} actions={<PitchButton variant="secondary" onClick={()=>setDialog(null)}>Fechar</PitchButton>}>{matchContent}</PitchDialog>
    </PitchSurface></div></div>
  </div>;
}

createRoot(document.getElementById('root')).render(<Preview />);
