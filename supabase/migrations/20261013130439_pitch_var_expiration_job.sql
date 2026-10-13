-- Authentication secret lives in Vault, provisioned separately (never committed).
create extension if not exists pg_net with schema extensions;
select cron.schedule('pitch-var-expire','*/10 * * * *',$job$select net.http_post(url:='https://zfjhdgvdvbqkycjaencz.supabase.co/functions/v1/pitch-var-cleanup',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='pitch_var_cleanup')),body:='{}'::jsonb);$job$);
