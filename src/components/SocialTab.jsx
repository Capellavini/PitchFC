import { useState } from "react";
import { Play, MessageCircle, Share2, Trophy, ImagePlus, Send } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { EXTERNAL_PLAYERS } from "../data";
import { playerColor, fileToDataUrl, ini } from "../lib/helpers";
import { openWhatsApp, sharePostMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";

/** Football social feed — cross-group: posts also come from players
 *  outside your group (mock community until the backend lands). */
export default function SocialTab({ group, posts, setPosts, meId }) {
  const [draft, setDraft] = useState("");
  const [draftPhoto, setDraftPhoto] = useState(null);
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});

  const me = group.find((p) => p.id === meId) ?? group.find((p) => p.isMe);

  const findAuthor = (id) =>
    group.find((p) => p.id === id) ?? EXTERNAL_PLAYERS.find((p) => p.id === id);

  const toggleLike = (postId) =>
    setPosts((ps) => ps.map((p) => p.id !== postId ? p : {
      ...p,
      likes: p.likes.includes(me.id) ? p.likes.filter((id) => id !== me.id) : [...p.likes, me.id],
    }));

  const voteGotw = (postId) =>
    setPosts((ps) => ps.map((p) => {
      if (!p.gotw) return p;
      const votes = p.gotwVotes.filter((id) => id !== me.id);
      return { ...p, gotwVotes: p.id === postId && !p.gotwVotes.includes(me.id) ? [...votes, me.id] : votes };
    }));

  const addComment = (postId) => {
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    setPosts((ps) => ps.map((p) => p.id !== postId ? p : {
      ...p, comments: [...p.comments, { id: Date.now(), authorId: me.id, text }],
    }));
    setCommentDrafts((d) => ({ ...d, [postId]: "" }));
  };

  const publish = () => {
    const text = draft.trim();
    if (!text && !draftPhoto) return;
    setPosts((ps) => [{
      id: Date.now(), authorId: me.id, time: "agora", type: draftPhoto ? "photo" : "text",
      text, photo: draftPhoto, likes: [], comments: [], gotw: false, gotwVotes: [],
    }, ...ps]);
    setDraft("");
    setDraftPhoto(null);
  };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (file) setDraftPhoto(await fileToDataUrl(file, 640));
    e.target.value = "";
  };

  const gotwCandidates = [...posts.filter((p) => p.gotw)].sort((a, b) => b.gotwVotes.length - a.gotwVotes.length);
  const myGotwVote = gotwCandidates.find((p) => p.gotwVotes.includes(me.id))?.id ?? null;

  const authorChip = (author) => {
    const isExternal = !group.includes(author);
    const color = isExternal ? C.blue : playerColor(group, author);
    return { color, sub: isExternal ? `${author.groupName} · ${author.club}` : `${me.id === author.id ? "tu · " : ""}${author.club}` };
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>Social ⚽</div>
        <div style={{ fontSize: 13, color: C.text2 }}>A comunidade de futebol do PITCH</div>
      </div>

      {/* Composer */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Avatar name={me.name} color={playerColor(group, me)} size={34} fontSize={11} isMe photo={me.photo} />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Partilha um momento, um golo, uma jogada…"
            rows={2}
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.text1, outline: "none", resize: "none", fontFamily: "inherit" }}
          />
        </div>
        {draftPhoto && (
          <div style={{ position: "relative", marginTop: 10 }}>
            <img src={draftPhoto} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover" }} />
            <button onClick={() => setDraftPhoto(null)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", color: C.text1, border: "none", borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Remover</button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.text2, cursor: "pointer" }}>
            <ImagePlus size={15} /> Foto
            <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
          </label>
          <button onClick={publish} disabled={!draft.trim() && !draftPhoto} style={{ background: draft.trim() || draftPhoto ? C.accent : C.accentDim, color: draft.trim() || draftPhoto ? C.bg : C.text3, border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            Publicar
          </button>
        </div>
      </div>

      {/* Golo da Semana */}
      {gotwCandidates.length > 0 && (
        <div style={{ background: `linear-gradient(135deg, ${C.card} 0%, ${C.goldDim} 100%)`, border: `1px solid ${C.gold}44`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <Trophy size={14} color={C.gold} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, letterSpacing: "0.06em" }}>GOLO DA SEMANA</span>
          </div>
          <div style={{ fontSize: 12, color: C.text2, marginBottom: 12 }}>Vota no melhor golo — fecha domingo à noite</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gotwCandidates.map((p, idx) => {
              const author = findAuthor(p.authorId);
              const voted = myGotwVote === p.id;
              const maxVotes = gotwCandidates[0].gotwVotes.length || 1;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...displayFont, width: 18, fontSize: 14, color: idx === 0 ? C.gold : C.text3 }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {author?.nick} <span style={{ color: C.text3, fontWeight: 400 }}>· {p.videoLabel}</span>
                    </div>
                    <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 4 }}>
                      <div style={{ height: "100%", borderRadius: 2, background: C.gold, width: `${(p.gotwVotes.length / maxVotes) * 100}%`, transition: "width 0.3s" }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text2 }}>{p.gotwVotes.length}</span>
                  <button onClick={() => voteGotw(p.id)} style={{ background: voted ? C.gold : "transparent", color: voted ? C.bg : C.gold, border: `1px solid ${C.gold}66`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                    {voted ? "Votado ✓" : "Votar"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed */}
      <SectionLabel>FEED</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {posts.map((post) => {
          const author = findAuthor(post.authorId);
          if (!author) return null;
          const { color, sub } = authorChip(author);
          const liked = post.likes.includes(me.id);
          const commentsOpen = openComments[post.id];
          return (
            <div key={post.id} style={{ ...cardStyle, padding: 14 }}>
              {/* author row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <Avatar name={author.name} color={color} size={36} fontSize={12} photo={author.photo} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{author.nick}</div>
                  <div style={{ fontSize: 11, color: C.text2 }}>{sub} · {post.time}</div>
                </div>
                {post.gotw && <Trophy size={13} color={C.gold} />}
              </div>

              {post.text && <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>{post.text}</div>}

              {/* media */}
              {post.type === "video" && (
                <div style={{ position: "relative", background: `linear-gradient(135deg, ${C.grassDim}, ${C.surface})`, border: `1px solid ${C.border}`, borderRadius: 12, height: 150, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: "rgba(0,0,0,0.55)", border: `1.5px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Play size={20} color={C.accent} fill={C.accent} />
                  </div>
                  <span style={{ position: "absolute", bottom: 8, right: 10, background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{post.videoLabel}</span>
                  <span style={{ position: "absolute", top: 8, left: 10, fontSize: 10, color: C.text2 }}>🎬 highlight</span>
                </div>
              )}
              {post.type === "photo" && post.photo && (
                <img src={post.photo} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 260, objectFit: "cover", marginBottom: 10 }} />
              )}

              {/* actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleLike(post.id)} style={{ background: liked ? C.accentDim : "transparent", color: liked ? C.accent : C.text2, border: `1px solid ${liked ? C.accentBorder : C.border}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  ⚽ Golaço {post.likes.length > 0 && post.likes.length}
                </button>
                <button onClick={() => setOpenComments((o) => ({ ...o, [post.id]: !o[post.id] }))} style={{ background: "transparent", color: C.text2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <MessageCircle size={13} /> {post.comments.length || "Comentar"}
                </button>
                <button onClick={() => openWhatsApp(sharePostMessage(author.nick, post.text))} style={{ background: "transparent", color: C.text2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 10px", fontSize: 12, cursor: "pointer", marginLeft: "auto", display: "flex", alignItems: "center" }}>
                  <Share2 size={13} />
                </button>
              </div>

              {/* comments */}
              {commentsOpen && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
                    {post.comments.map((c) => {
                      const cAuthor = findAuthor(c.authorId);
                      return (
                        <div key={c.id} style={{ display: "flex", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: C.text2, flexShrink: 0 }}>
                            {ini(cAuthor?.name ?? "?")}
                          </div>
                          <div style={{ flex: 1, background: C.surface, borderRadius: 10, padding: "7px 10px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>{cAuthor?.nick} </span>
                            <span style={{ fontSize: 12 }}>{c.text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={commentDrafts[post.id] ?? ""}
                      onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addComment(post.id)}
                      placeholder="Escreve um comentário…"
                      style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: C.text1, outline: "none" }}
                    />
                    <button onClick={() => addComment(post.id)} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
