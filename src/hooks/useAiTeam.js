import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { validateEntry } from '../lib/aiTeam';
export default function useAiTeam() {
  const [rows,setRows]=useState([]), [error,setError]=useState(''), [loading,setLoading]=useState(true);
  const [connections,setConnections]=useState([]);
  const refresh=useCallback(async()=>{
    try {
      const {data,error}=await supabase.from('ai_team_entries').select('*').order('created_at',{ascending:false}).limit(500);
      if(error) throw error;
      setRows(data || []); setError('');
      const {data:session}=await supabase.auth.getSession();
      if(session.session?.access_token){try{const response=await fetch('/api/ai-team?connection=1',{headers:{Authorization:`Bearer ${session.session.access_token}`},signal:AbortSignal.timeout(8000)});if(response.ok)setConnections((await response.json()).agents||[]);}catch{setConnections([]);}}
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  },[]);
  useEffect(()=>{ refresh(); const timer=setInterval(refresh,15000); return ()=>clearInterval(timer); },[refresh]);
  const publish=async(input)=>{
    const entry=validateEntry(input,'vinicius');
    const {error}=await supabase.from('ai_team_entries').insert(entry);
    if(error) throw error; await refresh();
  };
  const changeStatus=async(id,status)=>{
    const {error}=await supabase.from('ai_team_entries').update({status}).eq('id',id);
    if(error) throw error; await refresh();
  };
  return {rows,error,loading,refresh,publish,changeStatus,connections};
}
