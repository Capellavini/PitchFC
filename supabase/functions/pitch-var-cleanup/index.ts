import {createClient} from "npm:@supabase/supabase-js@2.108.1";
const EXPECTED_HASH="c49008b0fe93420598d425cb000f6d638a52713a656b853cced7965bc35f59c9";
Deno.serve(async(req:Request)=>{
 const token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))).map(v=>v.toString(16).padStart(2,"0")).join("");
 if(req.method!=="POST"||digest!==EXPECTED_HASH)return new Response("Unauthorized",{status:401});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const {data,error}=await db.from("var_cloud_clips").select("id,object_path").lte("expires_at",new Date().toISOString()).neq("state","deleted").limit(100);
 if(error)return new Response("Cleanup unavailable",{status:500});
 if(!data?.length)return Response.json({removed:0});
 const removed=await db.storage.from("pitch-var").remove(data.map(c=>c.object_path));
 if(removed.error)return new Response("Storage cleanup failed",{status:500});
 const marked=await db.from("var_cloud_clips").update({state:"deleted"}).in("id",data.map(c=>c.id));
 if(marked.error)return new Response("Cleanup acknowledgement failed",{status:500});
 return Response.json({removed:data.length});
});
