import { useMemo, useState } from "react"
import JournalEntryCard from "./JournalEntryCard"
import JournalEntryForm from "./JournalEntryForm"
import CatchHistoryCard from "./CatchHistoryCard"
import "./Journal.css"

function JournalPage({ entries, catches, onSaveEntry, onDeleteEntry, onChooseCatchPhoto, uploadingCatchId, onSaveCatch, onDeleteCatch }) {
  const [openEntry, setOpenEntry] = useState(null)
  const today = localDateValue()
  const sortedEntries = useMemo(() => [...entries].sort((left, right) => {
    if (left.date === today && right.date !== today) return -1
    if (right.date === today && left.date !== today) return 1
    return String(right.date || "").localeCompare(String(left.date || ""))
      || String(right.updated_at || "").localeCompare(String(left.updated_at || ""))
  }), [entries, today])

  function createEntry() {
    setOpenEntry(createJournalDraft(today))
  }

  function openExisting(id) {
    const entry = entries.find((item) => item.id === id)
    if (entry) setOpenEntry({ ...entry })
  }

  function saveEntry(entry) {
    const saved = onSaveEntry(entry)
    setOpenEntry(saved)
    return saved
  }

  function deleteEntry(id) {
    onDeleteEntry(id)
    setOpenEntry(null)
  }

  if (openEntry) {
    return (
      <div className="panel journalPanel">
        <JournalEntryForm
          key={openEntry.id}
          entry={openEntry}
          catches={catches}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onClose={() => setOpenEntry(null)}
        />
      </div>
    )
  }

  return (
    <div className="panel journalPanel">
      <div className="journalPageHeader">
        <div>
          <p className="eyebrow">Your days on the water</p>
          <h2>📖 Fishing Journal</h2>
          <p>Keep trip notes, conditions, observations, lessons, and favorite moments separate from your catch log.</p>
        </div>
        <button className="heroBtn" onClick={createEntry} type="button">New Journal Entry</button>
      </div>

      {sortedEntries.length === 0 ? (
        <div className="journalEmptyState">
          <span>📖</span>
          <h3>Start your first journal entry</h3>
          <p>Record the whole fishing day—even when you do not log a catch.</p>
          <button className="journalSecondaryBtn" onClick={createEntry} type="button">Create Today&apos;s Entry</button>
        </div>
      ) : (
        <div className="journalEntryList">
          {sortedEntries.map((entry) => (
            <JournalEntryCard
              entry={entry}
              isToday={entry.date === today}
              key={entry.id}
              onOpen={openExisting}
            />
          ))}
        </div>
      )}

      <section className="journalCatchHistory">
        <div className="journalSectionHeading">
          <div>
            <h3>Catch History</h3>
            <p>Your existing catch records remain separate from journal entries.</p>
          </div>
          <span>{catches.length} {catches.length === 1 ? "catch" : "catches"}</span>
        </div>
        {catches.length === 0 ? (
          <div className="journalEmptyCatches">Your logged catches will continue to appear here.</div>
        ) : (
          <div className="journalCatchGrid">
            {catches.map((fish) => (
              <CatchHistoryCard
                fish={fish}
                key={fish.id}
                uploading={uploadingCatchId === fish.id}
                onChoosePhoto={onChooseCatchPhoto}
                onSave={onSaveCatch}
                onDelete={onDeleteCatch}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function createJournalDraft(date) {
  return {
    id: crypto.randomUUID(),
    date,
    title: "",
    location: "",
    start_time: "",
    end_time: "",
    fishing_partners: "",
    weather_summary: "",
    water_conditions: "",
    hatch_activity_observations: "",
    wildlife_observations: "",
    flies_lures_used: "",
    gear_used: "",
    main_notes: "",
    lessons_learned: "",
    things_to_bring_next_time: "",
    favorite_moment: "",
    created_at: "",
    updated_at: "",
  }
}

function localDateValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default JournalPage
