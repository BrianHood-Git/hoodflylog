import "./LandingPage.css"
import logo from "../assets/hoodflylog-logo.jpg"

function LandingPage({ onEnterApp }) {
  return (
    <div className="landingPage">

      <header className="landingTopbar">

        <div className="landingLogo">
        <img src={logo} alt="HoodFlyLog" className="landingLogoImage" />
        </div>

        <div className="landingMenu">
          <button className="primaryBtn">
            Explore Catches
          </button>

          <button
            className="heroBtn"
            onClick={onEnterApp}
          >
            Login / Sign Up
          </button>
        </div>

      </header>

      <section className="heroSection">

        <div className="heroContent">

          <p className="eyebrow">
            THE COMMUNITY FISHING JOURNAL
          </p>

          <h1>
            Track Every Cast.
            <br />
            Share Every Adventure.
          </h1>

          <p>
            Log catches, organize your tackle, build your fishing history,
            and share as much—or as little—as you want with the community.
          </p>

          <div className="heroButtons">

            <button
              className="heroBtn"
              onClick={onEnterApp}
            >
              Join Free
            </button>

            <button className="primaryBtn">
              Explore Public Catches
            </button>

          </div>

        </div>

      </section>
<section className="statsSection">
  <div className="statBox">
    <h3>0</h3>
    <p>Catches Logged</p>
  </div>

  <div className="statBox">
    <h3>0</h3>
    <p>Waters Tracked</p>
  </div>

  <div className="statBox">
    <h3>0</h3>
    <p>Anglers Joined</p>
  </div>

  <div className="statBox">
    <h3>0</h3>
    <p>Species Logged</p>
  </div>

</section>
<section className="recentCatchesSection">
  <div className="sectionHeader">
    <div>
      <p className="eyebrow">Community feed</p>
      <h2>Recent Public Catches</h2>
    </div>
    <button className="primaryBtn">Explore All</button>
  </div>

  <div className="catchPreviewGrid">
    <div className="catchPreviewCard">
      <span>🐟</span>
      <h3>Largemouth Bass</h3>
      <p>📍 Crescent Bend Nature Park</p>
      <p>🪰 Olive Woolly Bugger</p>
    </div>

    <div className="catchPreviewCard">
      <span>🐠</span>
      <h3>Bluegill</h3>
      <p>📍 Cibolo Creek</p>
      <p>🪰 Zebra Midge</p>
    </div>

    <div className="catchPreviewCard">
      <span>🎣</span>
      <h3>Rainbow Trout</h3>
      <p>📍 Guadalupe River</p>
      <p>🪰 Pheasant Tail</p>
    </div>
  </div>
</section>
<section className="leaderboardSection">
  <div className="sectionHeader">
    <div>
      <p className="eyebrow">Top anglers</p>
      <h2>Leaderboard</h2>
    </div>
    <button className="primaryBtn">View Rankings</button>
  </div>

  <div className="leaderboardList">
    <div className="leaderboardRow">
      <span>🥇</span>
      <strong>Biggest Bass</strong>
      <p>Waiting on the first public catch</p>
    </div>

    <div className="leaderboardRow">
      <span>🥈</span>
      <strong>Most Active Angler</strong>
      <p>Start logging to claim the board</p>
    </div>

    <div className="leaderboardRow">
      <span>🥉</span>
      <strong>Top Water</strong>
      <p>Popular fishing locations will show here</p>
    </div>
  </div>
</section>

    </div>
  )
}

export default LandingPage