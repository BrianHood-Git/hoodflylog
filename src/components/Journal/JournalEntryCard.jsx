function JournalEntryCard({ entry, onOpen, isToday }) {
  const notes = entry.main_notes?.trim() || "No notes added yet."
  const preview = notes.length > 150 ? `${notes.slice(0, 147).trimEnd()}...` : notes

  return (
    <button className="journalEntryCard" onClick={() => onOpen(entry.id)} type="button">
      <div className="journalEntryCardHeader">
        <div>
          <span className="journalEntryDate">{formatJournalDate(entry.date)}</span>
          {isToday && <span className="journalTodayBadge">Today</span>}
        </div>
        <span aria-hidden="true">›</span>
      </div>
      <h3>{entry.title?.trim() || "Untitled fishing day"}</h3>
      <p className="journalEntryLocation">📍 {entry.location?.trim() || "No location added"}</p>
      <p className="journalEntryPreview">{preview}</p>
    </button>
  )
}

function formatJournalDate(value) {
  if (!value) return "No date"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export default JournalEntryCard
