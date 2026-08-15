import { useCallback, useEffect, useMemo, useState } from "react"
import CommunityFlyPatternCard from "./CommunityFlyPatternCard"
import CommunityFlyPatternForm from "./CommunityFlyPatternForm"
import { deleteCommunityDraft, loadCommunityPatterns, saveCommunityPattern, submitCommunityPattern } from "./communityFlyApi"
import "./CommunityFlyLibrary.css"

function CommunityFlyLibrary({ user, isModerator, query = "", onPatternsLoaded }) {
  const [patterns, setPatterns] = useState([])
  const [editing, setEditing] = useState(null)
  const [status, setStatus] = useState("Loading community patterns...")
  const [tab, setTab] = useState("published")

  const refresh = useCallback(async () => {
    try {
      const loaded = await loadCommunityPatterns()
      setPatterns(loaded)
      onPatternsLoaded?.(loaded.filter((pattern) => pattern.status === "published"))
      setStatus("")
    } catch (error) {
      console.error(error)
      setStatus(error.message || "Community patterns could not be loaded.")
    }
  }, [onPatternsLoaded])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return patterns.filter((pattern) => {
      const correctTab = tab === "mine" ? pattern.owner_id === user.id : pattern.status === "published"
      const matches = !normalized || [pattern.name, pattern.category, pattern.summary, pattern.best_for, ...pattern.materials.map((item) => item.name)].some((value) => String(value || "").toLowerCase().includes(normalized))
      return correctTab && matches
    })
  }, [patterns, query, tab, user.id])

  async function save(form) {
    await saveCommunityPattern({ form, userId: user.id, isModerator })
    setEditing(null)
    setTab("mine")
    setStatus("Draft saved.")
    await refresh()
  }

  async function submit(pattern) {
    if (!window.confirm(`Submit ${pattern.name} for moderator review? You cannot edit it while it is pending.`)) return
    try {
      await submitCommunityPattern(pattern.id)
      setStatus("Pattern submitted for review.")
      await refresh()
    } catch (error) { setStatus(error.message || "Submission failed.") }
  }

  async function remove(pattern) {
    if (!window.confirm(`Delete ${pattern.name}? This cannot be undone.`)) return
    try {
      await deleteCommunityDraft(pattern)
      setStatus("Draft deleted.")
      await refresh()
    } catch (error) { setStatus(error.message || "Delete failed.") }
  }

  if (editing) return <section className="communityFlySection"><CommunityFlyPatternForm pattern={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} /></section>

  return (
    <section className="communityFlySection">
      <div className="communityLibraryHeader"><div><p className="eyebrow">Shared and moderator-reviewed</p><h3>Community Fly Patterns</h3><p>Published recipes are visible to everyone. Your drafts stay private until approved.</p></div><button className="heroBtn" type="button" onClick={() => setEditing("new")}>Add Community Pattern</button></div>
      <div className="communityTabs"><button className={tab === "published" ? "active" : ""} type="button" onClick={() => setTab("published")}>Published</button><button className={tab === "mine" ? "active" : ""} type="button" onClick={() => setTab("mine")}>My Drafts & Submissions</button></div>
      {status && <p className="formMessage" role="status">{status}</p>}
      <div className="communityPatternGrid">
        {visible.map((pattern) => <CommunityFlyPatternCard
          key={pattern.id}
          pattern={pattern}
          canEdit={pattern.owner_id === user.id && ["draft", "rejected"].includes(pattern.status)}
          onEdit={setEditing}
          onSubmit={submit}
          onDelete={remove}
        />)}
      </div>
      {!status && visible.length === 0 && <div className="communityEmpty"><strong>{tab === "mine" ? "No community drafts yet." : "No published community patterns yet."}</strong><p>{tab === "mine" ? "Create one and submit it for review." : "Approved patterns will appear here."}</p></div>}
    </section>
  )
}

export default CommunityFlyLibrary
