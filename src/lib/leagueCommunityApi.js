import {rpc} from './leagueRolesApi';
import {supabase} from './supabase';
import {fanPath} from './leagueCommunity';
import {leagueSignUpMeta} from './leagueAccount';
export const communityApi={
 articles:(slug,id=null,manage=false)=>rpc('league_articles_list',{p_slug:slug,p_id:id,p_manage:manage}),
 saveArticle:(article,version)=>rpc('league_article_save',{p_article:article,p_expected_version:version}),
 join:(slug,name,team,support,consent)=>rpc('league_fantasy_join',{p_slug:slug,p_name:name,p_team_name:team,p_support_team:support||null,p_consent:consent}),
 league:slug=>rpc('league_workspace_public',{p_slug:slug}),
 fantasy:slug=>rpc('league_fantasy_state',{p_slug:slug}),
 saveSquad:(slug,squad,version,round)=>rpc('league_fantasy_save',{p_slug:slug,p_squad:squad,p_expected_version:version,p_round:round}),
 async signUp(slug,{name,email,password}){try{const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+fanPath(slug),data:{...leagueSignUpMeta({name:name.trim()}),pitch_role:'fan',fan_league_slug:slug}}});return error?{error:error.message}:{needsConfirm:!data.session};}catch{return {error:'Não foi possível criar a conta. Verifica a ligação.'};}}
};
