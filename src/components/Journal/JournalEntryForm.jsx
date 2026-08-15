import { useMemo, useState } from "react"

const TEXT_FIELDS = [
  ["fishing_partners", "Fishing partners", "Who joined you?"],
  ["weather_summary", "Weather summary", "Temperature, wind, clouds, pressure, or changing weather"],
  ["water_conditions", "Water conditions", "Clarity, flow, level, temperature, tides, or structure"],
  ["hatch_activity_observations", "Hatch / activity observations", "Hatches, bait activity, rises, feeding windows, or insect activity"],
  ["wildlife_observations", "Wildlife observations", "Birds, mammals, reptiles, or anything memorable nearby"],
  ["flies_lures_used", "Flies / lures used", "Patterns, colors, sizes, retrieves, and what worked"],
  ["gear_used", "Gear used", "Rod, reel, line, leader, tippet, boat, waders, or other equipment"],
  ["main_notes", "Main notes", "Tell the story of the day or trip"],
  ["lessons_learned", "Lessons learned", "What would you repeat or change?"],
  ["things_to_bring_next_time", "Things to bring next time", "Gear, flies, food, clothing, tools, or supplies"],
  ["favorite_moment", "Favorite moment", "The moment you most want to remember"],
]

function JournalEntryForm({ entry, catches, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(entry)
  const [message, setMessage] = useState("")
  const tripCatches = useMemo(
    () => catches.filter((fish) => fish.date === form.date),
    [catches, form.date],
  )

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setMessage("")
  }

  function submit(event) {
    event.preventDefault()
    if (!form.date) {
      setMessage("Choose a date before saving this journal entry.")
      return
    }
    const saved = onSave(form)
    setForm(saved)
    setMessage("Journal entry saved on this device.")
  }

  function confirmDelete() {
    const label = form.title?.trim() || "this journal entry"
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return
    onDelete(form.id)
  }

  return (
    <form className="journalEntryForm" onSubmit={submit}>
      <div className="journalFormHeader">
        <div>
          <p className="eyebrow">Daily / trip journal</p>
          <h2>{form.created_at ? "Edit Journal Entry" : "New Journal Entry"}</h2>
        </div>
        <button className="journalSecondaryBtn" onClick={onClose} type="button">Back to Journal</button>
      </div>

      <section className="journalFormSection">
        <h3>Trip details</h3>
        <div className="journalFieldGrid">
          <label>
            Date
            <input required type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} />
          </label>
          <label>
            Title
            <input placeholder="Morning on the Guadalupe" value={form.title} onChange={(event) => updateField("title", event.target.value)} />
          </label>
          <label className="journalFullWidth">
            Location
            <input placeholder="River, lake, park, access point, or general area" value={form.location} onChange={(event) => updateField("location", event.target.value)} />
          </label>
          <label>
            Start time
            <input type="time" value={form.start_time} onChange={(event) => updateField("start_time", event.target.value)} />
          </label>
          <label>
            End time
            <input type="time" value={form.end_time} onChange={(event) => updateField("end_time", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="journalFormSection">
        <h3>Conditions, observations, and notes</h3>
        <div className="journalTextareaGrid">
          {TEXT_FIELDS.map(([field, label, placeholder]) => (
            <label className={field === "main_notes" ? "journalFeaturedField" : ""} key={field}>
              {label}
              <textarea
                placeholder={placeholder}
                rows={field === "main_notes" ? 7 : 4}
                value={form[field]}
                onChange={(event) => updateField(field, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="journalFormSection journalTripCatches">
        <div className="journalSectionHeading">
          <div>
            <h3>Catches From This Trip</h3>
            <p>Catches are matched by date and remain in your existing catch history.</p>
          </div>
          <span>{tripCatches.length} {tripCatches.length === 1 ? "catch" : "catches"}</span>
        </div>
        {tripCatches.length === 0 ? (
          <div className="journalEmptyCatches">No catches are logged for {form.date || "this date"} yet.</div>
        ) : (
          <div className="journalCatchGrid">
            {tripCatches.map((fish) => (
              <article className="journalCatchCard" key={fish.id}>
                {fish.photo_url && <img src={fish.photo_url} alt={fish.species || "Trip catch"} />}
                <div>
                  <h4>🎣 {fish.species || "Unknown Fish"}</h4>
                  <p>📍 {fish.location || "No location"}</p>
                  <p>📏 {fish.length || "No length"}</p>
                  <p>🪰 {fish.fly || "No fly or lure listed"}</p>
                  {fish.notes && <p className="journalCatchNotes">{fish.notes}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {message && <p className="journalFormMessage" role="status">{message}</p>}
      <div className="journalFormActions">
        <button className="heroBtn" type="submit">Save Journal Entry</button>
        {form.created_at && <button className="dangerBtn" onClick={confirmDelete} type="button">Delete Entry</button>}
      </div>
    </form>
  )
}

export default JournalEntryForm
