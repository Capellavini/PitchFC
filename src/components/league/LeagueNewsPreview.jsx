import {useEffect,useState} from 'react';
import {communityApi} from '../../lib/leagueCommunityApi';
import {blogPath} from '../../lib/leagueCommunity';
import LeagueArticleCard from './LeagueArticleCard';
export default function LeagueNewsPreview({slug}){
 const [posts,setPosts]=useState(null),[error,setError]=useState(false);
 useEffect(()=>{let alive=true;communityApi.articles(slug).then(r=>{if(alive){setError(Boolean(r.error));setPosts(r.data?.articles?.slice(0,3)||[])}});return()=>{alive=false}},[slug]);
 return <section id="noticias" className="lb-preview"><div className="lb-section-heading"><div><span className="pl-eyebrow">A VOZ DA LIGA</span><h2>Notícias e histórias</h2></div><a href={blogPath(slug)}>Todas as publicações ↗</a></div>{posts===null?<p role="status">A abrir as notícias…</p>:error?<p role="status">As notícias não estão disponíveis neste momento.</p>:posts.length?<div className="lb-grid">{posts.map(p=><LeagueArticleCard key={p.id} slug={slug} post={p}/>)}</div>:<p className="lb-empty">As primeiras histórias desta liga estão a caminho.</p>}</section>;
}
