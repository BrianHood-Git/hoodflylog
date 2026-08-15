import { useState } from "react"

function CommunityFlyPatternForm({ pattern, onSave, onCancel }) {
  const [form, setForm] = useState(() => patternToForm(pattern))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setMessage("")
  }

  function updateList(collection, index, field, value) {
    setForm((current) => ({
      ...current,
      [collection]: current[collection].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }))
  }

  function move(collection, index, direction) {
    setForm((current) => {
      const items = [...current[collection]]
      const target = index + direction
      if (target < 0 || target >= items.length) return current
      ;[items[index], items[target]] = [items[target], items[index]]
      return { ...current, [collection]: items }
    })
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) return setMessage("Give the pattern a name before saving.")
    setSaving(true)
    setMessage("Saving draft...")
    try {
      await onSave(form)
    } catch (error) {
      setMessage(error.message || "The pattern could not be saved.")
      setSaving(false)
    }
  }

  return (
    <form className="communityPatternForm" onSubmit={submit}>
      <div className="communityFormHeader"><div><p className="eyebrow">Community contribution</p><h3>{form.id ? "Edit Fly Pattern" : "New Fly Pattern"}</h3></div><button className="secondaryBtn" type="button" onClick={onCancel}>Cancel</button></div>
      <p className="communityFormHint">Save a private draft first. Submit it when the materials and tying steps are ready for moderator review.</p>
      <div className="communityFieldGrid">
        <label>Pattern name<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Bead Head Woolly Bugger" /></label>
        <label>Category<input value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="Streamer, nymph, dry fly..." /></label>
        <label className="fullWidth">Summary<textarea rows="3" value={form.summary} onChange={(event) => update("summary", event.target.value)} placeholder="What distinguishes this pattern?" /></label>
        <label>Best for<input value={form.best_for} onChange={(event) => update("best_for", event.target.value)} placeholder="Bass, trout, panfish" /></label>
        <label>Video URL<input type="url" value={form.video_url} onChange={(event) => update("video_url", event.target.value)} placeholder="YouTube or Vimeo URL" /></label>
        <label className="fullWidth">Fishing notes<textarea rows="3" value={form.fishing_notes} onChange={(event) => update("fishing_notes", event.target.value)} placeholder="When and how to fish it" /></label>
        <label className="fullWidth communityFileLabel">Cover image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => update("cover_file", event.target.files?.[0] || null)} /><span>{form.cover_file?.name || (form.cover_image_path ? "Current cover image will be kept" : "JPEG, PNG, or WebP up to 5 MB")}</span></label>
      </div>

      <section className="communityRepeater">
        <div className="communityRepeaterHeading"><h4>Ordered materials</h4><button className="secondaryBtn" type="button" onClick={() => update("materials", [...form.materials, blankMaterial()])}>Add material</button></div>
        {form.materials.map((item, index) => <div className="communityRepeaterRow material" key={item.local_id}>
          <span className="communityOrder">{index + 1}</span>
          <input aria-label={`Material ${index + 1}`} value={item.name} onChange={(event) => updateList("materials", index, "name", event.target.value)} placeholder="Material" />
          <input aria-label={`Quantity ${index + 1}`} value={item.quantity} onChange={(event) => updateList("materials", index, "quantity", event.target.value)} placeholder="Size / quantity" />
          <input aria-label={`Material notes ${index + 1}`} value={item.notes} onChange={(event) => updateList("materials", index, "notes", event.target.value)} placeholder="Notes" />
          <RowButtons onMove={(direction) => move("materials", index, direction)} onRemove={() => update("materials", form.materials.filter((_, itemIndex) => itemIndex !== index))} />
        </div>)}
      </section>

      <section className="communityRepeater">
        <div className="communityRepeaterHeading"><h4>Ordered tying steps</h4><button className="secondaryBtn" type="button" onClick={() => update("steps", [...form.steps, blankStep()])}>Add step</button></div>
        {form.steps.map((step, index) => <div className="communityRepeaterRow step" key={step.local_id}>
          <span className="communityOrder">{index + 1}</span>
          <textarea rows="3" aria-label={`Step ${index + 1}`} value={step.instruction} onChange={(event) => updateList("steps", index, "instruction", event.target.value)} placeholder="Describe this tying step" />
          <label className="communityStepImage">Optional image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => updateList("steps", index, "image_file", event.target.files?.[0] || null)} /><span>{step.image_file?.name || (step.image_path ? "Current image kept" : "No image")}</span></label>
          <input aria-label={`Step image description ${index + 1}`} value={step.image_alt_text} onChange={(event) => updateList("steps", index, "image_alt_text", event.target.value)} placeholder="Image description" />
          <RowButtons onMove={(direction) => move("steps", index, direction)} onRemove={() => update("steps", form.steps.filter((_, itemIndex) => itemIndex !== index))} />
        </div>)}
      </section>

      {message && <p className="formMessage" role="status">{message}</p>}
      <div className="communityFormActions"><button className="heroBtn" disabled={saving} type="submit">{saving ? "Saving..." : "Save Draft"}</button><button className="secondaryBtn" disabled={saving} type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}

function RowButtons({ onMove, onRemove }) {
  return <div className="communityRowActions"><button type="button" title="Move up" onClick={() => onMove(-1)}>↑</button><button type="button" title="Move down" onClick={() => onMove(1)}>↓</button><button type="button" title="Remove" onClick={onRemove}>×</button></div>
}

function patternToForm(pattern) {
  return {
    id: pattern?.id || "",
    owner_id: pattern?.owner_id || "",
    name: pattern?.name || "",
    category: pattern?.category || "",
    summary: pattern?.summary || "",
    best_for: pattern?.best_for || "",
    fishing_notes: pattern?.fishing_notes || "",
    video_url: pattern?.video_url || "",
    cover_image_path: pattern?.cover_image_path || "",
    original_step_image_paths: (pattern?.steps || []).map((step) => step.image_path).filter(Boolean),
    cover_file: null,
    materials: pattern?.materials?.length ? pattern.materials.map((item) => ({ ...item, local_id: crypto.randomUUID(), quantity: item.quantity || "", notes: item.notes || "" })) : [blankMaterial()],
    steps: pattern?.steps?.length ? pattern.steps.map((step) => ({ ...step, local_id: crypto.randomUUID(), image_alt_text: step.image_alt_text || "", image_file: null })) : [blankStep()],
  }
}

function blankMaterial() { return { local_id: crypto.randomUUID(), name: "", quantity: "", notes: "" } }
function blankStep() { return { local_id: crypto.randomUUID(), id: crypto.randomUUID(), instruction: "", image_path: "", image_alt_text: "", image_file: null } }

export default CommunityFlyPatternForm
