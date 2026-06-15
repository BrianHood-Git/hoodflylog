import { useState } from "react"
import { supabase } from "./supabase"
import "./App.css"
function LogCatch({ onSaveCatch }) {
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    species: "",
    length: "",
    location: "",
    fly: "",
    setup: "",
    water: "",
    notes: "",
  })

  function updateField(field, value) {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  function saveCatch() {
    onSaveCatch({
      id: Date.now(),
      ...formData,
    })

    setFormData({
      date: "",
      time: "",
      species: "",
      length: "",
      location: "",
      fly: "",
      setup: "",
      water: "",
      notes: "",
    })
  }

  return (
    <div className="panel">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">New entry</p>
          <h2>🎣 Log Catch</h2>
        </div>
      </div>

      <form className="catchForm">
        <label>
          Date
          <input type="date" value={formData.date} onChange={(e) => updateField("date", e.target.value)} />
        </label>

        <label>
          Time
          <input type="time" value={formData.time} onChange={(e) => updateField("time", e.target.value)} />
        </label>

        <label>
          Species
          <input type="text" placeholder="Largemouth Bass, Bluegill..." value={formData.species} onChange={(e) => updateField("species", e.target.value)} />
        </label>

        <label>
          Length
          <input type="text" placeholder='14.5"' value={formData.length} onChange={(e) => updateField("length", e.target.value)} />
        </label>

        <label>
          Location
          <input type="text" placeholder="Crescent Bend Nature Park" value={formData.location} onChange={(e) => updateField("location", e.target.value)} />
        </label>

        <label>
          Fly Used
          <input type="text" placeholder="Olive Woolly Bugger" value={formData.fly} onChange={(e) => updateField("fly", e.target.value)} />
        </label>

        <label>
          Rod / Setup
          <input type="text" placeholder="4wt, floating line, 10 lb mono" value={formData.setup} onChange={(e) => updateField("setup", e.target.value)} />
        </label>

        <label>
          Water Conditions
          <input type="text" placeholder="Clear, stained, muddy..." value={formData.water} onChange={(e) => updateField("water", e.target.value)} />
        </label>

        <label className="fullWidth">
          Notes
          <textarea placeholder="What worked, where fish were holding, weather, retrieve speed..." value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} />
        </label>

        <button type="button" className="heroBtn fullWidth" onClick={saveCatch}>
          Save Catch
        </button>
      </form>
    </div>
  )
}

function Journal({ catches }) {
  return (
    <div className="panel">
      <h2>📖 Journal</h2>

      {catches.length === 0 ? (
        <p>Your saved catches will appear here.</p>
      ) : (
        <div className="catchList">
          {catches.map((fish) => (
            <div className="catchCard" key={fish.id}>
              <h3>🎣 {fish.species || "Unknown Fish"}</h3>
              <p>📍 {fish.location || "No location"}</p>
              <p>📏 {fish.length || "No length"}</p>
              <p>🪰 {fish.fly || "No fly listed"}</p>
              <p>🗓️ {fish.date || "No date"} {fish.time || ""}</p>
              {fish.notes && <p>📝 {fish.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Knots() {
  return (
    <div className="panel">
      <h2>🪢 Knots Library</h2>
      <p>Fishing knot tutorials will live here.</p>
    </div>
  )
}

function FlyTying() {
  return (
    <div className="panel">
      <h2>🪰 Fly Tying Library</h2>
      <p>Fly tying tutorials will live here.</p>
    </div>
  )
} 
function App() {
  const [activePage, setActivePage] = useState("dashboard")
  const [catches, setCatches] = useState([])

  const navItems = [
    { id: "dashboard", label: "Home", icon: "🏠" },
    { id: "log", label: "Log Catch", icon: "🎣" },
    { id: "history", label: "Journal", icon: "📖" },
    { id: "knots", label: "Knots", icon: "🪢" },
    { id: "flytying", label: "Fly Tying", icon: "🪰" },
  ]

 async function handleSaveCatch(newCatch) {
  const { error } = await supabase
    .from("catches")
    .insert([newCatch])

  if (error) {
    console.error(error)
    alert("Failed to save catch.")
    return
  }

  setCatches([newCatch, ...catches])
  setActivePage("history")
}

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fly fishing journal</p>
          <h1>HoodFlyLog</h1>
        </div>
        <button className="primaryBtn">+ Log Catch</button>
      </header>

     <main className="dashboard">
  {activePage === "dashboard" && (
    <>
      <section className="heroCard">
        <div>
          <p className="eyebrow">Today on the water</p>
          <h2>Ready to log your next catch?</h2>
          <p>
            Track the water, fly, weather, photos, and notes from every trip.
          </p>
          <button className="heroBtn">Log a Catch</button>
        </div>
      </section>

        <section className="quickGrid">
          <div className="statCard">
            <span>🎣</span>
            <p>Total Catches</p>
            <h3>0</h3>
          </div>

          <div className="statCard">
            <span>📍</span>
            <p>Favorite Water</p>
            <h3>—</h3>
          </div>

          <div className="statCard">
            <span>🏆</span>
            <p>Biggest Fish</p>
            <h3>0"</h3>
          </div>

          <div className="statCard">
            <span>🪰</span>
            <p>Top Fly</p>
            <h3>—</h3>
          </div>
        </section>

        <section className="contentGrid">
          <div className="panel">
            <h2>Recent Catches</h2>
            <div className="emptyState">
              <span>🐟</span>
              <h3>No catches logged yet</h3>
              <p>Your latest catches will show up here once we connect the log form.</p>
            </div>
          </div>

          <div className="panel">
            <h2>Quick Tools</h2>
            <button className="toolBtn">🪢 Open Knots Library</button>
            <button className="toolBtn">🪰 Open Fly Tying Library</button>
            <button className="toolBtn">🗺️ View Fishing Map</button>
            <button className="toolBtn">📤 Export Catch Log</button>
          </div>
        </section>
              </>
    )}

   {activePage === "log" && <LogCatch onSaveCatch={handleSaveCatch} />}
{activePage === "history" && <Journal catches={catches} />}
    {activePage === "knots" && <Knots />}
    {activePage === "flytying" && <FlyTying />}
      </main>

      <nav className="bottomNav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={activePage === item.id ? "active" : ""}
            onClick={() => setActivePage(item.id)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App