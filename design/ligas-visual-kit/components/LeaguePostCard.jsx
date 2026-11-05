import { PitchButton } from './PitchButton.jsx';

export function LeaguePostCard({ post, onOpen }) {
  return <article className="pl-post-card"><div className="pl-post-art" aria-hidden="true"><span>{post.visualLabel || 'PELA LIGA'}</span></div>
    <div className="pl-post-copy"><p className="pl-eyebrow">{post.category} · <time dateTime={post.date}>{post.dateLabel}</time></p>
      <h2>{post.title}</h2><p>{post.excerpt}</p>{onOpen && <PitchButton variant="ghost" onClick={() => onOpen(post)} aria-label={`Ler: ${post.title}`}>Ler publicação ↗</PitchButton>}
    </div>
  </article>;
}
