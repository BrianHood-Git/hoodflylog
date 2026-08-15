import { useCallback, useEffect, useState } from "react"
import CommunityFlyPatternCard from "./CommunityFlyPatternCard"
import CommunityFlyPatternForm from "./CommunityFlyPatternForm"
import { loadCommunityPatterns, moderateCommunityPattern, moderatorDeleteCommunityPattern, saveCommunityPattern } from "./communityFlyApi"

function CommunityFlyModeration({ currentUser }) {
  const [patterns, setPatterns] = useState([])
  const [filter, setFilter] = useState("pending")
  const [editing, setEditing] = useState(null)
  const [status, setStatus] = useState("Loading fly-pattern submissions...")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setPatterns(await loadCommunityPatterns())
      setStatus("")
    } catch (error) { setStatus(error.message || "Fly-pattern submissions could not be loaded.") }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  async function decide(pattern, decision) {
    const reason = decision === "rejected" ? window.prompt("Explain what the contributor should correct:")?.trim() : null
    if (decision === "rejected" && !reason) return
    setBusy(true)
    try {
      await moderateCommunityPattern(pattern.id, decision, reason)
      setStatus(`Pattern ${decision}.`)
      await refresh()
    } catch (error) { setStatus(error.message || "Moderation failed.") }
    setBusy(false)
  }

  async function remove(pattern) {
    if (!window.confirm(`Permanently delete ${pattern.name}?`)) return
    const reason = window.prompt("Optional deletion reason:")?.trim() || ""
    setBusy(true)
    try {
      await moderatorDeleteCommunityPattern(pattern, reason)
      setStatus("Pattern deleted.")
      await refresh()
    } catch (error) { setStatus(error.message || "Delete failed.") }
    setBusy(false)
  }

  async function save(form) {
    await saveCommunityPattern({ form, userId: currentUser.id, isModerator: true })
    setEditing(null)
    setStatus("Moderator edits saved and audited.")
    await refresh()
  }

  if (editing) return <section className="panel moderatorPanel"><CommunityFlyPatternForm pattern={editing} onSave={save} onCancel={() => setEditing(null)} /></section>

  const visible = filter === "all" ? patterns : patterns.filter((pattern) => pattern.status === filter)
  const pending = patterns.filter((pattern) => pattern.status === "pending").length
  return (
    <section className="panel moderatorPanel">
      <div className="pageHeader compactHeader"><div><p className="eyebrow">Community library</p><h2>🪰 Fly Pattern Moderation</h2><p>Edit, publish, reject, or delete community submissions.</p></div><span className="customBadge">{pending} pending</span></div>
      {status && <p className="formMessage" role="status">{status}</p>}
      <div className="moderationFilters">{["pending", "published", "rejected", "all"].map((value) => <button className={filter === value ? "active" : ""} type="button" key={value} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <div className="communityPatternGrid moderatorCommunityGrid">
        {visible.map((pattern) => <div className="moderatorPatternWrap" key={pattern.id}>
          <CommunityFlyPatternCard pattern={pattern} canEdit={false} />
          <div className="communityPatternActions">
            <button className="heroBtn" disabled={busy} type="button" onClick={() => decide(pattern, "published")}>Publish</button>
            <button className="secondaryBtn" disabled={busy} type="button" onClick={() => decide(pattern, "rejected")}>Reject</button>
            <button className="secondaryBtn" disabled={busy} type="button" onClick={() => setEditing(pattern)}>Edit</button>
            <button className="dangerBtn" disabled={busy} type="button" onClick={() => remove(pattern)}>Delete</button>
          </div>
        </div>)}
      </div>
      {!status && visible.length === 0 && <p>No {filter === "all" ? "" : filter} community patterns found.</p>}
    </section>
  )
}

export default CommunityFlyModeration
