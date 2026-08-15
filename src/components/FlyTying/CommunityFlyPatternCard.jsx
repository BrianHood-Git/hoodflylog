function CommunityFlyPatternCard({ pattern, canEdit, onEdit, onSubmit, onDelete }) {
  const video = embedVideo(pattern.video_url)
  return (
    <article className="communityPatternCard">
      {pattern.cover_image_url && <img className="communityPatternCover" src={pattern.cover_image_url} alt={`${pattern.name} fly pattern`} />}
      <div className="communityPatternBody">
        <div className="communityPatternTitleRow">
          <div><p className="eyebrow">{pattern.category}</p><h3>{pattern.name}</h3></div>
          <span className={`communityStatus ${pattern.status}`}>{pattern.status}</span>
        </div>
        {pattern.summary && <p>{pattern.summary}</p>}
        {pattern.best_for && <p><strong>Best for:</strong> {pattern.best_for}</p>}
        {pattern.materials.length > 0 && <details><summary>Materials ({pattern.materials.length})</summary><ol>{pattern.materials.map((item) => <li key={item.id}><strong>{item.name}</strong>{item.quantity ? ` — ${item.quantity}` : ""}{item.notes ? ` · ${item.notes}` : ""}</li>)}</ol></details>}
        {pattern.steps.length > 0 && <details><summary>Tying steps ({pattern.steps.length})</summary><ol className="communityStepList">{pattern.steps.map((step) => <li key={step.id}>{step.image_url && <img src={step.image_url} alt={step.image_alt_text || `Step ${step.position}`} />}<span>{step.instruction}</span></li>)}</ol></details>}
        {pattern.fishing_notes && <p><strong>Fishing notes:</strong> {pattern.fishing_notes}</p>}
        {video && <div className="communityVideo"><iframe src={video} title={`${pattern.name} tying video`} allowFullScreen /></div>}
        {pattern.status === "rejected" && pattern.rejection_reason && <p className="communityRejectReason"><strong>Moderator note:</strong> {pattern.rejection_reason}</p>}
        {canEdit && <div className="communityPatternActions">
          <button className="secondaryBtn" type="button" onClick={() => onEdit(pattern)}>Edit</button>
          {pattern.status !== "published" && <button className="heroBtn" type="button" onClick={() => onSubmit(pattern)}>Submit for review</button>}
          <button className="dangerBtn" type="button" onClick={() => onDelete(pattern)}>Delete</button>
        </div>}
      </div>
    </article>
  )
}

function embedVideo(value) {
  if (!value) return ""
  try {
    const url = new URL(value)
    if (url.hostname.includes("youtu.be")) return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`
    if (url.hostname.includes("youtube.com")) {
      const id = url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : url.searchParams.get("v")
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : ""
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop()
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : ""
    }
  } catch { return "" }
  return ""
}

export default CommunityFlyPatternCard
