import { useEffect, useMemo, useState } from "react"
import { supabase } from "./supabase"
import LandingPage from "./components/LandingPage"
import logo from "./assets/hoodflylog-logo.jpg"
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
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field, value) {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  async function saveCatch() {
    const cleanedCatch = Object.fromEntries(
      Object.entries(formData).map(([key, value]) => [key, value.trim()])
    )

    if (!cleanedCatch.species && !cleanedCatch.location && !cleanedCatch.fly && !cleanedCatch.notes) {
      setErrorMessage("Add at least a species, location, fly, or note before saving.")
      return
    }

    setErrorMessage("")
    setIsSaving(true)

    const saved = await onSaveCatch(cleanedCatch)

    setIsSaving(false)

    if (!saved) {
      setErrorMessage("That catch stayed on this device, but cloud saving failed.")
      return
    }

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
          {isSaving ? "Saving..." : "Save Catch"}
        </button>
        {errorMessage && <p className="formMessage fullWidth">{errorMessage}</p>}
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
  const [catches, setCatches] = useState(() => {
    const saved = localStorage.getItem("hoodflylog-catches")
    return saved ? JSON.parse(saved) : []
  })
  const [viewMode, setViewMode] = useState("public")
  const [loadStatus, setLoadStatus] = useState("Loading catch log...")
  
  useEffect(() => {
    localStorage.setItem("hoodflylog-catches", JSON.stringify(catches))
  }, [catches])

  useEffect(() => {
    async function loadCatches() {
      const { data, error } = await supabase
        .from("catches")
        .select("*")
        .order("date", { ascending: false })

      if (error) {
        console.error(error)
        setLoadStatus("Using catches saved on this device.")
        return
      }

      setCatches(data || [])
      setLoadStatus("")
    }

    loadCatches()
  }, [])

  const dashboardStats = useMemo(() => {
    const total = catches.length
    const biggest = catches.reduce((largest, fish) => {
      const length = Number.parseFloat(String(fish.length || "").replace(/[^0-9.]/g, ""))
      return Number.isFinite(length) && length > largest ? length : largest
    }, 0)
    const favoriteWater = mostCommon(catches, "location")
    const topFly = mostCommon(catches, "fly")

    return {
      total,
      favoriteWater: favoriteWater || "-",
      biggest: biggest ? `${biggest}"` : "-",
      topFly: topFly || "-",
    }
  }, [catches])

  if (viewMode === "public") {
    return <LandingPage onEnterApp={() => setViewMode("app")} />
  }

  const navItems = [
    { id: "dashboard", label: "Home", icon: "🏠" },
    { id: "history", label: "Journal", icon: "📖" },
    { id: "log", label: "Log Catch", icon: "📸", primary: true },
    { id: "knots", label: "Knots", icon: "🪢" },
    { id: "flytying", label: "Fly Tying", icon: "🪰" },
  ]

async function handleSaveCatch(newCatch) {
  const catchToSave = {
    ...newCatch,
  }

  const fallbackCatch = {
    id: crypto.randomUUID(),
    ...catchToSave,
  }

  const { data, error } = await supabase
    .from("catches")
    .insert([catchToSave])
    .select()
    .single()

  if (error) {
    console.error(error)
    setCatches((currentCatches) => [fallbackCatch, ...currentCatches])
    setLoadStatus("Cloud save failed. This catch is saved on this device.")
    setActivePage("history")
    return true
  }

  setCatches((currentCatches) => [data || fallbackCatch, ...currentCatches])
  setActivePage("history")
  return true
}

function exportCatches() {
  if (catches.length === 0) {
    alert("No catches to export yet.")
    return
  }

  const fields = ["date", "time", "species", "length", "location", "fly", "setup", "water", "notes"]
  const rows = catches.map((fish) =>
    fields.map((field) => csvCell(fish[field] || "")).join(",")
  )
  const csv = [fields.join(","), ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `hoodflylog-catches-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

  return (
    <div className="app">
      <aside className="sideNav">
        <img src={logo} alt="HoodFlyLog" className="sideLogo" />
        <div className="sideNavLinks">
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
        </div>
        <div className="conditionsCard">
          <strong>Today's Conditions</strong>
          <p>Use GPS + Weather later to attach temperature, pressure, and water notes.</p>
        </div>
      </aside>

      <div className="appMain">
      <header className="topbar">
        <div>
          <h1>Dashboard 🎣</h1>
          <p>Welcome back, Hood! Tight lines.</p>
        </div>
        <button
  className="primaryBtn"
  onClick={() => setViewMode("app")}
>
  Jul 7, 2026
</button>
      </header>

     <main className="dashboard">
  {activePage === "dashboard" && (
    <>
      <section className="heroCard">
        <div>
          <p className="eyebrow">Mobile ready</p>
          <h2>New Catch</h2>
          <p>
            Fast field notes for species, water, fly, setup, and the details you will want later.
          </p>
          <button className="heroBtn" onClick={() => setActivePage("log")}>Log a Catch</button>
        </div>
      </section>

        <section className="quickGrid">
          <div className="statCard">
            <span>🎣</span>
            <p>Total Catches</p>
            <h3>{dashboardStats.total}</h3>
          </div>

          <div className="statCard">
            <span>📍</span>
            <p>Favorite Water</p>
            <h3>{dashboardStats.favoriteWater}</h3>
          </div>

          <div className="statCard">
            <span>🏆</span>
            <p>Biggest Fish</p>
            <h3>{dashboardStats.biggest}</h3>
          </div>

          <div className="statCard">
            <span>🪰</span>
            <p>Top Fly</p>
            <h3>{dashboardStats.topFly}</h3>
          </div>
        </section>

        <section className="contentGrid">
          <div className="panel">
            <h2>Recent Catches</h2>
            {loadStatus && <p>{loadStatus}</p>}
            {catches.length === 0 ? (
              <div className="emptyState">
                <span>🐟</span>
                <h3>No catches logged yet</h3>
                <p>Your latest catches will show up here after your first save.</p>
              </div>
            ) : (
              <div className="catchList compact">
                {catches.slice(0, 3).map((fish) => (
                  <div className="catchCard" key={fish.id}>
                    <h3>🎣 {fish.species || "Unknown Fish"}</h3>
                    <p>📍 {fish.location || "No location"}</p>
                    <p>🪰 {fish.fly || "No fly listed"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Quick Tools</h2>
            <button className="toolBtn" onClick={() => setActivePage("knots")}>🪢 Open Knots Library</button>
            <button className="toolBtn" onClick={() => setActivePage("flytying")}>🪰 Open Fly Tying Library</button>
            <button className="toolBtn">🗺️ View Fishing Map</button>
            <button className="toolBtn" onClick={exportCatches}>📤 Export Catch Log</button>
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
    </div>
  )
}

export default App

function mostCommon(items, field) {
  const counts = items.reduce((acc, item) => {
    const value = item[field]?.trim()
    if (!value) return acc
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}
