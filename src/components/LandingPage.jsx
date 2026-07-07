import "./LandingPage.css"
import logo from "../assets/hoodflylog-logo.jpg"

function LandingPage({ catches = [], onEnterApp }) {
  const navLinks = [
    { label: "Explore", sectionId: "public-catches" },
    { label: "Leaderboard", sectionId: "leaderboard" },
    { label: "About", sectionId: "about" },
    { label: "Contact", sectionId: "contact" },
  ]
  const publicCatches = catches.filter((fish) => fish.is_public !== false)
  const recentCatches = publicCatches.slice(0, 3)
  const fallbackCatches = [
    { id: "sample-1", species: "Largemouth Bass", location: "Crescent Bend Nature Park", fly: "Olive Woolly Bugger" },
    { id: "sample-2", species: "Bluegill", location: "Cibolo Creek", fly: "Zebra Midge" },
    { id: "sample-3", species: "Rainbow Trout", location: "Guadalupe River", fly: "Pheasant Tail" },
  ]
  const catchesToShow = recentCatches.length > 0 ? recentCatches : fallbackCatches
  const watersTracked = countUnique(publicCatches, "location")
  const speciesLogged = countUnique(publicCatches, "species")
  const leaderboard = buildLeaderboard(publicCatches)

  function scrollToSection(id) {
    const section = document.getElementById(id)
    if (!section) return

    section.scrollIntoView({ behavior: "smooth", block: "start" })
    window.history.replaceState(null, "", `#${id}`)
  }

  return (
    <div className="landingPage">
      <header className="landingTopbar">
        <div className="landingLogo">
          <img src={logo} alt="HoodFlyLog" className="landingLogoImage" />
        </div>

        <div className="landingMenu">
          {navLinks.map((link) => (
            <button
              aria-controls={link.sectionId}
              className="navBtn"
              key={link.sectionId}
              onClick={() => scrollToSection(link.sectionId)}
              type="button"
            >
              {link.label}
            </button>
          ))}
          <button className="heroBtn" onClick={onEnterApp} type="button">Login / Sign Up</button>
        </div>
      </header>

      <section className="heroSection">
        <div className="heroContent">
          <p className="eyebrow">THE COMMUNITY FISHING JOURNAL</p>
          <h1>
            Track Every Cast.
            <br />
            Share Every Adventure.
          </h1>
          <p>
            Log catches, organize your tackle, build your fishing history,
            and share as much or as little as you want with the community.
          </p>

          <div className="heroButtons">
            <button className="heroBtn" onClick={onEnterApp} type="button">Join Free</button>
            <button className="primaryBtn" onClick={() => scrollToSection("public-catches")} type="button">Explore Public Catches</button>
          </div>
        </div>
      </section>

      <section className="statsSection" aria-label="HoodFlyLog stats">
        <div className="statBox">
          <h3>{publicCatches.length}</h3>
          <p>Catches Logged</p>
        </div>

        <div className="statBox">
          <h3>{watersTracked}</h3>
          <p>Waters Tracked</p>
        </div>

        <div className="statBox">
          <h3>1</h3>
          <p>Anglers Joined</p>
        </div>

        <div className="statBox">
          <h3>{speciesLogged}</h3>
          <p>Species Logged</p>
        </div>
      </section>

      <section className="recentCatchesSection" id="public-catches">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Community feed</p>
            <h2>Recent Public Catches</h2>
          </div>
          <button className="primaryBtn" onClick={onEnterApp} type="button">Explore All</button>
        </div>

        <div className="catchPreviewGrid">
          {catchesToShow.map((fish) => (
            <article className="catchPreviewCard" key={fish.id}>
              {fish.photo_url ? (
                <img src={fish.photo_url} alt={fish.species || "Recent catch"} />
              ) : (
                <span>🎣</span>
              )}
              <h3>{fish.species || "Unknown Fish"}</h3>
              <p>📍 {fish.location || "No location yet"}</p>
              <p>🪰 {fish.fly || "No fly listed"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="leaderboardSection" id="leaderboard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Top catches</p>
            <h2>Leaderboard</h2>
          </div>
          <button className="primaryBtn" onClick={onEnterApp} type="button">Log a Catch</button>
        </div>

        <div className="leaderboardList">
          {leaderboard.map((row, index) => (
            <div className="leaderboardRow" key={row.label}>
              <span>{["🥇", "🥈", "🥉"][index]}</span>
              <strong>{row.label}</strong>
              <p>{row.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="infoSection" id="about">
        <p className="eyebrow">About HoodFlyLog</p>
        <h2>Built for quick logs on real water</h2>
        <p>
          HoodFlyLog keeps catch photos, flies, locations, weather notes, and journal details together
          so every trip is easier to remember and learn from.
        </p>
      </section>

      <section className="infoSection" id="contact">
        <p className="eyebrow">Contact</p>
        <h2>Have an idea for the log?</h2>
        <p>Keep sending feedback from the water. The best features are the ones that make logging easier when a fish is still in hand.</p>
      </section>
    </div>
  )
}

export default LandingPage

function countUnique(items, field) {
  return new Set(items.map((item) => item[field]?.trim()).filter(Boolean)).size
}

function buildLeaderboard(catches) {
  const biggestFish = catches.reduce((winner, fish) => {
    const length = Number.parseFloat(String(fish.length || "").replace(/[^0-9.]/g, ""))
    if (!Number.isFinite(length)) return winner
    return length > winner.length ? { length, fish } : winner
  }, { length: 0, fish: null })

  const topWater = mostCommon(catches, "location")
  const topFly = mostCommon(catches, "fly")

  return [
    {
      label: "Biggest Fish",
      value: biggestFish.fish ? `${biggestFish.fish.species || "Unknown Fish"} - ${biggestFish.length}"` : "Waiting on a measured catch",
    },
    {
      label: "Top Water",
      value: topWater || "Popular waters will show here",
    },
    {
      label: "Most Productive Fly",
      value: topFly || "Top flies will show here",
    },
  ]
}

function mostCommon(items, field) {
  const counts = items.reduce((acc, item) => {
    const value = item[field]?.trim()
    if (!value) return acc
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
}
