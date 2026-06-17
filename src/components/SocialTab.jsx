import { useState } from "react";
import { Users, Building2, UserPlus, MessageCircle, Send, ImagePlus, Video, Trash2, Check, X } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { ini } from "../lib/helpers";
import { openWhatsApp, sharePostMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";

const SCOPES = [
  { id: "grupo", Icon: Users,      label: "Grupo"  },
  { id: "clube", Icon: Building2,  label: "Clube"  },
  { id: "amigos", Icon: UserPlus,  label: "Amigos" },
];

// Stable colour from an id/nick so each author has a consistent tint.
const PALETTE = [C.accent, C.blue, C.orange, "#A78BFA", "#FF6B9D", "#2DD4BF", "#34D399", "#60A5FA"];
const colorFor = (key = "") => PALETTE[[...String(key)].reduce((h, c) => (h + c.charCodeAt(0)) % PALETTE.length, 0)];

/** Football social feed — three scopes (grupo / clube / amigos) with a
 *  friends graph. Cloud-backed when logged in; same UI for the local
 *  demo (fed normalized data by PitchApp). */
export default function SocialTab({ social }) {
  const [scope, setScope] = useState("clube");
  const [draft, setDraft] = useState("");
  const [draftMedia, setDraftMedia] = useState(null); // { url, kind: 'photo' | 'video' }
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [addOpen, setAddOpen] = useState(false);

  const { meId, myGroupId, posts, friendIds, friends, requests, candidates, sentPending, friendshipIdOf } = social;

  const visible = posts.filter((p) => {
    if (scope === "clube") return true;
    if (scope === "grupo") return p.author.groupId === myGroupId;
    return p.author.id === meId || friendIds.includes(p.author.id); // amigos
  });

  const publish = () => {
    const text = draft.trim();
    if (!text && !draftMedia) return;
    social.onCreatePost({ type: draftMedia ? draftMedia.kind : "text", body: text, media_url: draftMedia?.url ?? null });
    setDraft(""); setDraftMedia(null); setUploadErr(null);
  };
  const pickMedia = async (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadErr(null); setUploading(true);
    const res = await social.uploadMedia(file);
    setUploading(false);
    if (res?.error) { setUploadErr(res.error); return; }
    setDraftMedia({ url: res.url, kind });
  };
  const submitComment = (postId) => {
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    social.onAddComment(postId, text);
    setCommentDrafts((d) => ({ ...d, [postId]: "" }));
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>Social ⚽</div>
        <div style={{ fontSize: 13, color: C.text2 }}>A comunidade de futebol do PITCH</div>
      </div>

      {/* scope tabs */}
      <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 4, marginBottom: 14, gap: 4 }}>
        {SCOPES.map(({ id, Icon, label }) => {
          const active = scope === id;
          return (
            <button key={id} onClick={() => setScope(id)} style={{ flex: 1, background: active ? C.accent : "transparent", color: active ? C.bg : C.text2, border: "none", borderRadius: 10, padding: "9px 4px", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>

      {/* composer */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Partilha um momento, um golo, uma jogada…" rows={2}
          style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.text1, outline: "none", resize: "none", fontFamily: "inherit" }} />
        {draftMedia && (
          <div style={{ position: "relative", marginTop: 10 }}>
            {draftMedia.kind === "video"
              ? <video src={draftMedia.url} controls playsInline style={{ width: "100%", borderRadius: 12, maxHeight: 280, background: "#000" }} />
              : <img src={draftMedia.url} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 240, objectFit: "cover" }} />}
            <button onClick={() => setDraftMedia(null)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", color: C.text1, border: "none", borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Remover</button>
          </div>
        )}
        {uploading && <div style={{ fontSize: 12, color: C.text2, marginTop: 10 }}>A carregar ficheiro…</div>}
        {uploadErr && <div style={{ fontSize: 12, color: C.red, marginTop: 10 }}>Falha no upload: {uploadErr}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: uploading ? C.text3 : C.text2, cursor: uploading ? "default" : "pointer" }}>
              <ImagePlus size={15} /> Foto
              <input type="file" accept="image/*" disabled={uploading} onChange={(e) => pickMedia(e, "photo")} style={{ display: "none" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: uploading ? C.text3 : C.text2, cursor: uploading ? "default" : "pointer" }}>
              <Video size={15} /> Vídeo
              <input type="file" accept="video/*" disabled={uploading} onChange={(e) => pickMedia(e, "video")} style={{ display: "none" }} />
            </label>
          </div>
          <button onClick={publish} disabled={uploading || (!draft.trim() && !draftMedia)} style={{ background: (draft.trim() || draftMedia) && !uploading ? C.accent : C.accentDim, color: (draft.trim() || draftMedia) && !uploading ? C.bg : C.text3, border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 800, cursor: uploading ? "default" : "pointer" }}>
            Publicar
          </button>
        </div>
      </div>

      {/* friends management (amigos scope) */}
      {scope === "amigos" && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: requests.length || addOpen || friends.length ? 12 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Amigos {friends.length > 0 && <span style={{ color: C.text3, fontWeight: 400 }}>({friends.length})</span>}</span>
            <button onClick={() => setAddOpen((v) => !v)} style={{ background: addOpen ? C.surface : C.accentDim, color: addOpen ? C.text2 : C.accent, border: `1px solid ${addOpen ? C.border : C.accentBorder}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <UserPlus size={13} /> Adicionar amigo
            </button>
          </div>

          {/* incoming requests */}
          {requests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SectionLabel style={{ marginBottom: 8 }}>PEDIDOS</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {requests.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={r.player.name} color={colorFor(r.player.id)} size={32} fontSize={11} photo={r.player.photo_url} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{r.player.nick}</span>
                    <button onClick={() => social.onRespondFriend(r.id, true)} style={{ background: C.greenDim, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Check size={12} /> Aceitar</button>
                    <button onClick={() => social.onRespondFriend(r.id, false)} style={{ background: "none", color: C.text3, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 11, cursor: "pointer", display: "flex" }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* add-friend candidate list */}
          {addOpen && (
            <div style={{ marginBottom: 12 }}>
              <SectionLabel style={{ marginBottom: 8 }}>MEMBROS DO CLUBE</SectionLabel>
              {candidates.length === 0 ? (
                <div style={{ fontSize: 12, color: C.text3 }}>Sem ninguém para adicionar por agora.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                  {candidates.map((c) => {
                    const sent = sentPending.includes(c.id);
                    return (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={c.name} color={colorFor(c.id)} size={32} fontSize={11} photo={c.photo_url} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nick}</div>
                          <div style={{ fontSize: 10, color: C.text3 }}>{c.groups?.name ?? "Sem grupo"}</div>
                        </div>
                        <button onClick={() => !sent && social.onSendFriend(c.id)} disabled={sent} style={{ background: sent ? C.surface : C.accentDim, color: sent ? C.text3 : C.accent, border: `1px solid ${sent ? C.border : C.accentBorder}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: sent ? "default" : "pointer" }}>
                          {sent ? "Pedido enviado" : "Adicionar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* my friends */}
          {friends.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {friends.map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={f.name} color={colorFor(f.id)} size={30} fontSize={11} photo={f.photo_url} />
                  <span style={{ flex: 1, fontSize: 13 }}>{f.nick}</span>
                  <button onClick={() => social.onRemoveFriend(friendshipIdOf(f.id))} style={{ background: "none", color: C.text3, border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Remover</button>
                </div>
              ))}
            </div>
          )}

          {friends.length === 0 && requests.length === 0 && !addOpen && (
            <div style={{ fontSize: 12, color: C.text3, marginTop: 10 }}>Ainda não tens amigos por aqui. Toca em "Adicionar amigo" para começar. 🤝</div>
          )}
        </div>
      )}

      {/* feed */}
      <SectionLabel>{scope === "grupo" ? "DO TEU GRUPO" : scope === "amigos" ? "DOS TEUS AMIGOS" : "FEED DO CLUBE"}</SectionLabel>
      {visible.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "28px 20px", color: C.text3, fontSize: 13, marginBottom: 24 }}>
          {scope === "amigos" ? "Sem publicações de amigos ainda." : scope === "grupo" ? "O teu grupo ainda não publicou nada." : "Ainda não há publicações. Sê o primeiro! ⚽"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {visible.map((post) => {
            const liked = post.liked;
            const commentsOpen = openComments[post.id];
            const color = post.mine ? C.accent : colorFor(post.author.id);
            return (
              <div key={post.id} style={{ ...cardStyle, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Avatar name={post.author.name || post.author.nick} color={color} size={36} fontSize={12} isMe={post.mine} photo={post.author.photo} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{post.author.nick}{post.mine && <span style={{ fontSize: 10, color: C.text2, fontWeight: 400 }}> · tu</span>}</div>
                    <div style={{ fontSize: 11, color: C.text2 }}>{post.time}</div>
                  </div>
                  {post.mine && (
                    <button onClick={() => window.confirm("Apagar publicação?") && social.onDeletePost(post.id)} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>
                  )}
                </div>

                {post.text && <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>{post.text}</div>}
                {post.type === "photo" && post.media && (
                  <img src={post.media} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 320, objectFit: "cover", marginBottom: 10 }} />
                )}
                {post.type === "video" && post.media && (
                  <video src={post.media} controls playsInline style={{ width: "100%", borderRadius: 12, maxHeight: 360, background: "#000", marginBottom: 10 }} />
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => social.onToggleLike(post.id, liked)} style={{ background: liked ? C.accentDim : "transparent", color: liked ? C.accent : C.text2, border: `1px solid ${liked ? C.accentBorder : C.border}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ⚽ Golaço {post.likes.length > 0 && post.likes.length}
                  </button>
                  <button onClick={() => setOpenComments((o) => ({ ...o, [post.id]: !o[post.id] }))} style={{ background: "transparent", color: C.text2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <MessageCircle size={13} /> {post.comments.length || "Comentar"}
                  </button>
                  <button onClick={() => openWhatsApp(sharePostMessage(post.author.nick, post.text || "uma publicação"))} style={{ background: "transparent", color: C.text2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 10px", fontSize: 12, cursor: "pointer", marginLeft: "auto" }}>↗</button>
                </div>

                {commentsOpen && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
                      {post.comments.map((c) => (
                        <div key={c.id} style={{ display: "flex", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: C.text2, flexShrink: 0, overflow: "hidden" }}>
                            {c.photo ? <img src={c.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(c.nick || "?")}
                          </div>
                          <div style={{ flex: 1, background: C.surface, borderRadius: 10, padding: "7px 10px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>{c.nick} </span>
                            <span style={{ fontSize: 12 }}>{c.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={commentDrafts[post.id] ?? ""} onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submitComment(post.id)} placeholder="Escreve um comentário…"
                        style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: C.text1, outline: "none" }} />
                      <button onClick={() => submitComment(post.id)} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Send size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
