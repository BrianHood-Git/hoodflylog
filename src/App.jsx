import { useState } from "react"
import "./App.css"

function App() {
  const [activePage, setActivePage] = useState("dashboard")

  const navItems = [
    { id: "dashboard", label: "Home", icon: "🏠" },
    { id: "log", label: "Log Catch", icon: "🎣" },
    { id: "history", label: "Journal", icon: "📖" },
    { id: "knots", label: "Knots", icon: "🪢" },
    { id: "flytying", label: "Fly Tying", icon: "🪰" },
  ]

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