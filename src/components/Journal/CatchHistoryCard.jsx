import { useState } from "react"

const EDITABLE_FIELDS = [
  ["date", "Date", "date"],
  ["time", "Time", "time"],
  ["species", "Species", "text"],
  ["length", "Length", "text"],
  ["location", "Location", "text"],
  ["fly", "Fly / lure", "text"],
  ["setup", "Rod / setup", "text"],
  ["water", "Water conditions", "text"],
]

function CatchHistoryCard({ fish, onChoosePhoto, uploading, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => catchFormFrom(fish))
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)

  function beginEditing() {
    setForm(catchFormFrom(fish))
    setStatus("")
    setEditing(true)
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setStatus("")
  }

  async function saveChanges(event) {
    event.preventDefault()
    setSaving(true)
    const result = await onSave(fish.id, form)
    setSaving(false)
    if (!result.ok) {
      setStatus(result.error || "Catch changes could not be saved.")
      return
    }
    setEditing(false)
  }

  async function confirmDelete() {
    const label = fish.species || "this catch"
    if (!window.confirm(`Delete ${label}? This removes the catch from your catch history and cannot be undone.`)) return
    setSaving(true)
    const result = await onDelete(fish)
    setSaving(false)
    if (!result.ok) setStatus(result.error || "The catch could not be deleted.")
  }

  if (editing) {
    return (
      <form className="journalCatchEditForm" onSubmit={saveChanges}>
        <div className="journalCatchEditHeading">
          <h4>Edit Catch</h4>
          <span>{fish.moderation_status || "pending"}</span>
        </div>
        <div className="journalCatchEditGrid">
          {EDITABLE_FIELDS.map(([field, label, type]) => (
            <label key={field}>
              {label}
              <input type={type} value={form[field]} onChange={(event) => updateField(field, event.target.value)} />
            </label>
          ))}
          <label className="journalFullWidth">
            Notes
            <textarea rows="5" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </label>
          <label className="journalCatchCheckbox journalFullWidth">
            <input type="checkbox" checked={form.is_public} onChange={(event) => updateField("is_public", event.target.checked)} />
            Show this catch publicly after moderator approval
          </label>
        </div>
        {status && <p className="journalCatchError" role="alert">{status}</p>}
        <div className="journalCatchActions">
          <button className="heroBtn" disabled={saving} type="submit">{saving ? "Saving..." : "Save Changes"}</button>
          <button className="journalSecondaryBtn" disabled={saving} onClick={() => setEditing(false)} type="button">Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <article className="journalCatchCard">
      {fish.photo_url && <img src={fish.photo_url} alt={fish.species || "Saved catch"} />}
      <div>
        <h4>🎣 {fish.species || "Unknown Fish"}</h4>
        <p>🗓️ {fish.date || "No date"} {fish.time || ""}</p>
        <p>📍 {fish.location || "No location"}</p>
        <p>📏 {fish.length || "No length"}</p>
        <p>🪰 {fish.fly || "No fly or lure listed"}</p>
        {fish.notes && <p className="journalCatchNotes">{fish.notes}</p>}
        {status && <p className="journalCatchError" role="alert">{status}</p>}
        <div className="journalCatchActions">
          <button className="journalSecondaryBtn" onClick={beginEditing} type="button">Edit Catch</button>
          <button className="photoActionBtn" disabled={uploading} onClick={() => onChoosePhoto(fish)} type="button">
            {uploading ? "Uploading..." : fish.photo_url ? "📸 Replace Photo" : "📸 Add Photo"}
          </button>
          <button className="journalDeleteCatchBtn" disabled={saving} onClick={confirmDelete} type="button">Delete</button>
        </div>
      </div>
    </article>
  )
}

function catchFormFrom(fish) {
  return {
    date: fish.date || "",
    time: fish.time || "",
    species: fish.species || "",
    length: fish.length || "",
    location: fish.location || "",
    fly: fish.fly || "",
    setup: fish.setup || "",
    water: fish.water || "",
    notes: fish.notes || "",
    is_public: fish.is_public !== false,
  }
}

export default CatchHistoryCard
