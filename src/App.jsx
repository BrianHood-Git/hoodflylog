function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b1f14",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif"
    }}>
      <header style={{
        background: "#133322",
        padding: "20px",
        borderBottom: "2px solid #2f6b44"
      }}>
        <h1>🎣 HoodFlyLog</h1>
      </header>

      <div style={{
        display: "flex",
        minHeight: "calc(100vh - 80px)"
      }}>
        <aside style={{
          width: "250px",
          background: "#11281b",
          padding: "20px"
        }}>
          <h3>Navigation</h3>

          <p>📊 Dashboard</p>
          <p>🎣 Log Catch</p>
          <p>📖 Catch History</p>
          <p>🗺️ Maps</p>
          <p>🪢 Knots</p>
          <p>🪰 Fly Tying</p>
          <p>📝 Reports</p>
        </aside>

        <main style={{
          flex: 1,
          padding: "30px"
        }}>
          <h2>Dashboard</h2>

          <div style={{
            display: "flex",
            gap: "20px",
            flexWrap: "wrap"
          }}>
            <div style={{
              background: "#163726",
              padding: "20px",
              borderRadius: "10px",
              minWidth: "200px"
            }}>
              <h3>Total Catches</h3>
              <h1>0</h1>
            </div>

            <div style={{
              background: "#163726",
              padding: "20px",
              borderRadius: "10px",
              minWidth: "200px"
            }}>
              <h3>Favorite Water</h3>
              <h1>--</h1>
            </div>

            <div style={{
              background: "#163726",
              padding: "20px",
              borderRadius: "10px",
              minWidth: "200px"
            }}>
              <h3>Biggest Fish</h3>
              <h1>0"</h1>
            </div>
          </div>

          <div style={{
            marginTop: "30px",
            background: "#163726",
            padding: "20px",
            borderRadius: "10px"
          }}>
            <h3>Recent Catches</h3>
            <p>No catches logged yet.</p>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App