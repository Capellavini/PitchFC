import {fanPath} from '../../lib/leagueCommunity';
export default function LeagueFantasyAccess({ctx}) {
  const slug=ctx.store?.slug;
  return <section className="lb-manager"><span className="pl-eyebrow">PITCH MANAGER · ADEPTOS</span><h1>O Fantasy da tua liga.</h1><p>Os adeptos criam a sua equipa, escolhem capitão e vice-capitão e pontuam com as jornadas oficiais. Cada conta guarda a sua própria equipa.</p>{slug?<div className="lb-actions"><a className="lf-public-cta" style={{background:'#c8ff00',color:'#0a0f18'}} href={fanPath(slug)}>Abrir Fantasy da liga →</a></div>:<p>Publica a página da liga para abrir o Fantasy aos adeptos.</p>}<p>Aceitar novas equipas: Gerir → Página. Para anunciar novidades, usa Gerir → Blog da liga.</p></section>;
}
