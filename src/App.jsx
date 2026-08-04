import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "./supabase"
import LandingPage from "./components/LandingPage"
import LogCatch from "./components/LogCatch"
import logo from "./assets/hoodflylog-logo.jpg"
import "./App.css"
const OWNER_EMAIL = "nasskater89@gmail.com"

function Journal({ catches, onChooseCatchPhoto, uploadingCatchId }) {
  return (
    <div className="panel">
      <h2>📖 Journal</h2>

      {catches.length === 0 ? (
        <p>Your saved catches will appear here.</p>
      ) : (
        <div className="catchList">
          {catches.map((fish) => (
            <div className="catchCard" key={fish.id}>
              {fish.photo_url && <img src={fish.photo_url} alt={fish.species || "Saved catch"} className="catchPhoto" />}
              <h3>🎣 {fish.species || "Unknown Fish"}</h3>
              <p>📍 {fish.location || "No location"}</p>
              <p>📏 {fish.length || "No length"}</p>
              <p>🪰 {fish.fly || "No fly listed"}</p>
              <p>🗓️ {fish.date || "No date"} {fish.time || ""}</p>
              {fish.notes && <p>📝 {fish.notes}</p>}
              <span className={`moderationBadge ${fish.moderation_status || "pending"}`}>{fish.moderation_status || "pending"}</span>
              <button
                className="photoActionBtn"
                disabled={uploadingCatchId === fish.id}
                onClick={() => onChooseCatchPhoto(fish)}
                type="button"
              >
                {uploadingCatchId === fish.id ? "Uploading..." : fish.photo_url ? "📸 Replace Photo" : "📸 Add Photo"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Leaderboard({ catches, onLogCatch }) {
  const waters = useMemo(() => {
    return [...new Set(catches.map((fish) => fish.location?.trim()).filter(Boolean))].sort()
  }, [catches])
  const [selectedWater, setSelectedWater] = useState("all")
  const filteredCatches = selectedWater === "all"
    ? catches
    : catches.filter((fish) => fish.location?.trim() === selectedWater)
  const rankedCatches = [...filteredCatches]
    .map((fish) => ({
      ...fish,
      measuredLength: parseCatchLength(fish.length),
    }))
    .sort((a, b) => {
      if (b.measuredLength !== a.measuredLength) return b.measuredLength - a.measuredLength
      return new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0)
    })
    .slice(0, 10)
  const topFly = mostCommon(filteredCatches, "fly")
  const topWater = mostCommon(filteredCatches, "location")

  return (
    <div className="panel leaderboardPanel">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Top catches</p>
          <h2>🏆 Leaderboard</h2>
        </div>
        <button className="heroBtn" onClick={onLogCatch} type="button">Log a Catch</button>
      </div>

      <div className="leaderboardFilters">
        <label>
          Waterbody
          <select value={selectedWater} onChange={(event) => setSelectedWater(event.target.value)}>
            <option value="all">All waters</option>
            {waters.map((water) => (
              <option key={water} value={water}>{water}</option>
            ))}
          </select>
        </label>
        <div>
          <span>Top water</span>
          <strong>{topWater || "No water logged yet"}</strong>
        </div>
        <div>
          <span>Top fly</span>
          <strong>{topFly || "No fly logged yet"}</strong>
        </div>
      </div>

      {rankedCatches.length === 0 ? (
        <div className="emptyState">
          <span>🏆</span>
          <h3>No leaderboard catches yet</h3>
          <p>Log a catch with species, water, length, and fly to start ranking trips.</p>
        </div>
      ) : (
        <div className="appLeaderboardList">
          {rankedCatches.map((fish, index) => (
            <article className="appLeaderboardCard" key={fish.id}>
              <div className="leaderboardRank">{index + 1}</div>
              {fish.photo_url ? (
                <img src={fish.photo_url} alt={fish.species || "Leaderboard catch"} />
              ) : (
                <div className="leaderboardThumb">🎣</div>
              )}
              <div>
                <h3>{fish.species || "Unknown Fish"}</h3>
                <p>{fish.measuredLength ? `${fish.measuredLength}"` : "No length"} · {fish.location || "No waterbody"}</p>
                <p>{fish.fly ? `Fly: ${fish.fly}` : "No fly listed"}</p>
                <small>by {fish.angler_name || shortAnglerId(fish.user_id) || "HoodFly angler"}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function Knots({ customKnots, onAddCustomKnot, onRemoveCustomKnot }) {
  const [formData, setFormData] = useState({
    name: "",
    use: "",
    notes: "",
    steps: "",
  })
  const [message, setMessage] = useState("")
  const knots = [
    {
      name: "Improved Clinch Knot",
      use: "Fly to tippet",
      notes: "Fast everyday knot for dries, nymphs, and small streamers. Use 5 to 7 wraps, wet it, and seat it slowly.",
      steps: ["Thread the eye", "Wrap tag around standing line", "Pass tag through loop near eye", "Pass through big loop", "Wet and tighten"],
    },
    {
      name: "Non-Slip Loop Knot",
      use: "Streamers and articulated flies",
      notes: "Leaves a small loop so the fly moves freely. Great for woolly buggers, baitfish, and bass flies.",
      steps: ["Tie overhand loop", "Pass tag through fly eye", "Run tag back through loop", "Wrap tag 4 to 5 times", "Return through loop and tighten"],
    },
    {
      name: "Surgeon's Knot",
      use: "Tippet to tippet",
      notes: "Quick way to add lighter tippet or repair a leader. Good in wind or low light.",
      steps: ["Overlap both lines", "Make a loop with both lines", "Pass tag ends through twice", "Wet and pull all strands evenly"],
    },
    {
      name: "Blood Knot",
      use: "Clean leader sections",
      notes: "Slimmer than a surgeon's knot and passes through guides well. Best with similar line diameters.",
      steps: ["Overlap lines", "Wrap one tag 5 times", "Bring tag to center", "Wrap other tag opposite way", "Wet and pull tight"],
    },
    {
      name: "Perfection Loop",
      use: "Loop at end of leader",
      notes: "Makes a straight, clean loop for loop-to-loop leader connections.",
      steps: ["Form first loop", "Wrap tag behind standing line", "Form second loop", "Pull second loop through first", "Trim tag"],
    },
    {
      name: "Nail Knot",
      use: "Fly line to leader",
      notes: "Classic low-profile connection. A small tube or nail knot tool makes it much easier.",
      steps: ["Lay tube along fly line", "Wrap leader around tube and fly line", "Pass tag through tube", "Remove tube", "Wet and tighten"],
    },
  ]
  const knotLibrary = [...knots, ...customKnots]

  function updateField(field, value) {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  function addKnot(event) {
    event.preventDefault()

    if (!formData.name.trim()) {
      setMessage("Add a knot name before saving.")
      return
    }

    onAddCustomKnot({
      id: crypto.randomUUID(),
      name: formData.name.trim(),
      use: formData.use.trim() || "Custom knot",
      notes: formData.notes.trim() || "Personal knot note.",
      steps: splitListInput(formData.steps),
      custom: true,
    })

    setFormData({ name: "", use: "", notes: "", steps: "" })
    setMessage("Custom knot added.")
  }

  return (
    <div className="panel">
      <h2>🪢 Knots Library</h2>
      <form className="libraryForm" onSubmit={addKnot}>
        <div className="sectionHeader compactHeader">
          <div>
            <p className="eyebrow">Your knots</p>
            <h3>Add a Custom Knot</h3>
          </div>
          <button className="heroBtn" type="submit">Save Knot</button>
        </div>
        <div className="libraryFormGrid">
          <label>
            Knot name
            <input type="text" placeholder="Double Davy" value={formData.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>
          <label>
            Use
            <input type="text" placeholder="Fly to tippet" value={formData.use} onChange={(event) => updateField("use", event.target.value)} />
          </label>
          <label className="fullWidth">
            Notes
            <textarea placeholder="When you like to use it, strengths, reminders..." value={formData.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </label>
          <label className="fullWidth">
            Steps
            <textarea placeholder="One step per line" value={formData.steps} onChange={(event) => updateField("steps", event.target.value)} />
          </label>
        </div>
        {message && <p className="formMessage">{message}</p>}
      </form>
      <div className="libraryGrid">
        {knotLibrary.map((knot) => (
          <article className="libraryCard" key={knot.id || knot.name}>
            <p className="eyebrow">{knot.use}</p>
            <h3>{knot.name}</h3>
            {knot.custom && <span className="customBadge">Custom</span>}
            <p>{knot.notes}</p>
            {knot.steps.length > 0 && (
              <ol>
                {knot.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            {knot.custom && (
              <button className="textBtn" type="button" onClick={() => onRemoveCustomKnot(knot.id)}>Remove</button>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

function FlyTying({ customFlies, onAddCustomFly, onRemoveCustomFly }) {
  const flyCameraRef = useRef(null)
  const flyGalleryRef = useRef(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    bestFor: "",
    materials: "",
    tip: "",
    videoUrl: "",
  })
  const [message, setMessage] = useState("")
  const [query, setQuery] = useState("")
  const [classicPatterns, setClassicPatterns] = useState([])
  const [classicStatus, setClassicStatus] = useState("Loading classic patterns...")
  const [flyPhoto, setFlyPhoto] = useState(null)
  const [flyAnalysis, setFlyAnalysis] = useState(null)
  const [flyAnalysisStatus, setFlyAnalysisStatus] = useState("")
  const [isAnalyzingFly, setIsAnalyzingFly] = useState(false)
  const flies = [
    {
      name: "Woolly Bugger",
      type: "Streamer",
      bestFor: "Bass, trout, panfish",
      materials: "Marabou tail, chenille body, hackle, bead optional",
      tip: "Olive, black, and brown are confidence colors. Strip it slow around structure or swing it in current.",
    },
    {
      name: "Clouser Minnow",
      type: "Baitfish",
      bestFor: "Bass, saltwater, trout",
      materials: "Bucktail, dumbbell eyes, flash, strong hook",
      tip: "Sparse is better. Invert the hook with dumbbell eyes and fish it with short strips.",
    },
    {
      name: "Pheasant Tail Nymph",
      type: "Nymph",
      bestFor: "Trout and panfish",
      materials: "Pheasant tail fibers, copper wire, peacock herl, thread",
      tip: "A great mayfly nymph imitation. Fish under an indicator or as the smaller fly in a two-fly rig.",
    },
    {
      name: "Zebra Midge",
      type: "Midge",
      bestFor: "Trout",
      materials: "Thread body, wire rib, bead",
      tip: "Simple and tiny. Black, red, and olive work well when fish are eating small bugs.",
    },
    {
      name: "Elk Hair Caddis",
      type: "Dry fly",
      bestFor: "Trout and creek fish",
      materials: "Dry fly hackle, dubbing, elk hair wing",
      tip: "Floats well in broken water. Trim the wing clean and use floatant before fishing.",
    },
    {
      name: "Silverman's Caddis Larva",
      type: "Caddis larva nymph",
      bestFor: "Trout in rivers and streams",
      materials: "Suggested approximation: curved caddis/scud hook (#14–16), translucent olive-green segmented body, dark dubbed thorax, and sparse brown soft hackle",
      tip: "Dead drift it below an indicator or as a dropper. Add an occasional subtle twitch when caddis larvae are active.",
      sourceName: "Montana Fly Company pattern — reference from Red's Fly Shop",
      sourceUrl: "https://redsflyfishing.com/products/silvermans-caddis-larva-by-montana-fly-company",
    },
    {
      name: "San Juan Worm",
      type: "Attractor nymph",
      bestFor: "Trout, carp, panfish",
      materials: "Chenille or worm material, thread, bead optional",
      tip: "Excellent after rain or in stained water. Red, pink, wine, and brown are common choices.",
    },
    {
      name: "Chubby Chernobyl",
      type: "Foam terrestrial dry fly",
      bestFor: "Trout, bass, and warmwater fish",
      materials: "2XL terrestrial hook, tying thread, dubbed body, closed-cell foam overbody, polypropylene or synthetic wing, and barred rubber legs",
      steps: ["Start the thread and build a dubbed body.", "Tie in the rear foam overbody and rear rubber legs.", "Add the synthetic wing over the foam.", "Secure the middle and front rubber legs.", "Tie down the front foam head, trim the foam and wing, and finish the thread head."],
      tip: "Fish it tight to banks, under overhanging cover, or as the buoyant top fly in a dry-dropper rig.",
    },
    {
      name: "Stubby Chubby",
      type: "Compact foam terrestrial dry fly",
      bestFor: "Trout and warmwater fish",
      materials: "Terrestrial hook, tying thread, compact dubbed body, closed-cell foam, synthetic wing, and barred rubber legs",
      steps: ["Build a compact dubbed body on the hook shank.", "Tie in the rear foam section and rear legs.", "Secure a sparse synthetic wing over the body.", "Add the remaining rubber legs at the middle and front.", "Fold and secure the front foam head, trim the profile, and finish."],
      tip: "Use it as a compact searching dry or dry-dropper indicator around banks, pocket water, and terrestrial activity.",
    },    {
      name: "Foam Hopper",
      type: "Terrestrial",
      bestFor: "Bass, bluegill, trout",
      materials: "Foam body, rubber legs, elk/deer hair wing optional",
      tip: "Good summer searching fly. Twitch it near banks, grass, and overhanging cover.",
    },
    {
      name: "Bully Bluegill Spider",
      type: "Warmwater bug",
      bestFor: "Bluegill and bass",
      materials: "Foam or chenille body, rubber legs, small hook",
      tip: "Let the rings settle after it lands, then twitch once. Panfish usually tell on themselves.",
    },
  ]
  const flyLibrary = [...flies, ...customFlies]
  const normalizedQuery = query.trim().toLowerCase()
  const matchingFlies = flyLibrary.filter((fly) => !normalizedQuery || [fly.name, fly.type, fly.bestFor, fly.materials, fly.tip, fly.sourceName]
    .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)))
  const matchingClassicPatterns = classicPatterns.filter((pattern) => !normalizedQuery || [pattern.title, pattern.authorName, pattern.bookTitle]
    .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)))
  const displayedClassicPatterns = normalizedQuery ? matchingClassicPatterns.slice(0, 24) : []
  const identificationTerms = flyAnalysis?.suggestions ? [flyAnalysis.suggestions.name, ...(flyAnalysis.suggestions.closeMatches || [])].filter(Boolean) : []
  const identifiedLibraryMatches = flyLibrary.filter((fly) => identificationTerms.some((term) => namesOverlap(fly.name, term))).slice(0, 6)
  const identifiedClassicMatches = classicPatterns.filter((pattern) => identificationTerms.some((term) => namesOverlap(pattern.title, term))).slice(0, 8)

  useEffect(() => {
    const controller = new AbortController()
    async function loadClassicPatterns() {
      try {
        const response = await fetch("/api/fly-patterns", { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Classic patterns could not be loaded.")
        setClassicPatterns(Array.isArray(payload.patterns) ? payload.patterns : [])
        setClassicStatus(payload.patterns?.length ? "" : payload.error || "No classic patterns are available right now.")
      } catch (error) {
        if (error.name !== "AbortError") setClassicStatus("Classic patterns are temporarily unavailable. Your HoodFlyLog patterns still work.")
      }
    }
    loadClassicPatterns()
    return () => controller.abort()
  }, [])

  useEffect(() => () => {
    if (flyPhoto?.previewUrl) URL.revokeObjectURL(flyPhoto.previewUrl)
  }, [flyPhoto])
  function updateField(field, value) {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  function selectFlyPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setFlyPhoto((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return { file, name: file.name, previewUrl: URL.createObjectURL(file) }
    })
    setFlyAnalysis(null)
    setFlyAnalysisStatus("")
  }

  async function analyzeFlyPhoto() {
    if (!flyPhoto?.file) return
    setIsAnalyzingFly(true)
    setFlyAnalysis(null)
    setFlyAnalysisStatus("Analyzing visible materials and searching for close patterns...")
    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) throw new Error("Sign in again before using Fly Identifier.")
      const body = new FormData()
      body.append("photo", await prepareFlyImage(flyPhoto.file), "fly-analysis.jpg")
      body.append("knownPatterns", JSON.stringify(flyLibrary.map((fly) => fly.name).slice(0, 40)))
      const response = await fetch("/api/analyze-fly", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body })
      const payload = await readFlyApiJson(response)
      if (!response.ok) throw new Error(payload.error || "Fly analysis failed.")
      setFlyAnalysis(payload)
      setFlyAnalysisStatus(payload.suggestions?.isFly
        ? "Possible fly matches found. Review the identification and approximation carefully."
        : "A tied fishing fly could not be identified in this photo. Try a closer side-profile image.")
    } catch (error) {
      setFlyAnalysisStatus(error.message || "Fly analysis failed. Try again or search manually.")
    } finally {
      setIsAnalyzingFly(false)
    }
  }

  function useFlySuggestion() {
    const suggestion = flyAnalysis?.suggestions
    if (!suggestion?.name) return
    setFormData((current) => ({
      ...current,
      name: suggestion.name,
      type: suggestion.category,
      materials: suggestion.approximateMaterials.join(", "),
      tip: [suggestion.fishingTip, suggestion.approximateSteps.length ? `${suggestion.recipeStatus === "library" ? "Steps" : "Approximate steps"}: ${suggestion.approximateSteps.join(" ")}` : "", suggestion.recipeStatus === "library" ? "HoodFlyLog library recipe selected." : "AI-generated approximation—verify materials and steps before tying."].filter(Boolean).join(" "),
    }))
    setMessage("Suggestion copied into the editable custom-fly form.")
  }
  function selectFlyMatch(name) {
    const libraryFly = flyLibrary.find((fly) => namesOverlap(fly.name, name))
    setQuery(name)
    if (!libraryFly) {
      setMessage(`${name} selected for library search. No HoodFlyLog recipe is stored yet.`)
      return
    }
    setFlyAnalysis((current) => ({
      ...current,
      suggestions: {
        ...current.suggestions,
        name: libraryFly.name,
        category: libraryFly.type,
        approximateMaterials: libraryFly.materials.split(",").map((material) => material.trim()).filter(Boolean),
        approximateSteps: libraryFly.steps || [],
        fishingTip: libraryFly.tip,
        recipeStatus: "library",
      },
    }))
    setFlyAnalysisStatus(`${libraryFly.name} selected. Instructions updated from the HoodFlyLog library.`)
  }
  function addFly(event) {
    event.preventDefault()
    if (!formData.name.trim()) {
      setMessage("Add a fly name before saving.")
      return
    }

    const videoUrl = normalizeYouTubeUrl(formData.videoUrl)
    if (formData.videoUrl.trim() && !videoUrl) {
      setMessage("Add a valid YouTube video or Shorts link.")
      return
    }

    onAddCustomFly({
      id: crypto.randomUUID(),
      name: formData.name.trim(),
      type: formData.type.trim() || "Custom fly",
      bestFor: formData.bestFor.trim() || "Your waters",
      materials: formData.materials.trim() || "Materials not listed yet.",
      tip: formData.tip.trim() || "Personal tying or fishing note.",
      videoUrl,
      custom: true,
    })

    setFormData({ name: "", type: "", bestFor: "", materials: "", tip: "", videoUrl: "" })
    setMessage("Custom fly added.")
  }

  return (
    <div className="panel">
      <div className="sectionHeader compactHeader">
        <div>
          <p className="eyebrow">Patterns, recipes, and tutorials</p>
          <h2>🪰 Fly Tying Library</h2>
        </div>
      </div>

      <section className="flyIdentifierPanel">
        <div className="sectionHeader compactHeader">
          <div><p className="eyebrow">Photo identification</p><h3>📷 Identify a Fly</h3></div>
        </div>
        <input ref={flyCameraRef} className="hiddenFileInput" type="file" accept="image/*" capture="environment" onChange={selectFlyPhoto} />
        <input ref={flyGalleryRef} className="hiddenFileInput" type="file" accept="image/*" onChange={selectFlyPhoto} />
        <div className="photoButtonRow">
          <button type="button" className="cameraBtn" onClick={() => flyCameraRef.current?.click()}>📸 Take Photo</button>
          <button type="button" className="secondaryBtn" onClick={() => flyGalleryRef.current?.click()}>🖼️ Choose Photo</button>
        </div>
        {flyPhoto && <div className="flyIdentifierPreview"><img src={flyPhoto.previewUrl} alt="Fly to identify" /><span>{flyPhoto.name}</span></div>}
        <button type="button" className="aiAnalyzeBtn" disabled={!flyPhoto || isAnalyzingFly} onClick={analyzeFlyPhoto}>{isAnalyzingFly ? "Identifying fly..." : "✨ Identify Fly + Suggest Tie"}</button>
        <small className="aiPrivacyNote">AI compares visible construction with known pattern names. Results and tying steps may be wrong; generated recipes are always labeled as approximations.</small>
        {flyAnalysisStatus && <p className="formMessage" role="status">{flyAnalysisStatus}</p>}
        {flyAnalysis?.suggestions?.isFly && <div className="flyIdentificationResult">
          <div><span className="customBadge">{flyAnalysis.suggestions.recipeStatus === "library" ? "Library recipe" : "AI approximation"}</span><strong>{flyAnalysis.suggestions.name || "Unknown fly"}</strong></div>
          <p><strong>Confidence:</strong> {formatFlyConfidence(flyAnalysis.suggestions.confidence)} · <strong>Category:</strong> {flyAnalysis.suggestions.category || "Unknown"}</p>
          {flyAnalysis.suggestions.closeMatches.length > 0 && <p><strong>Close matches:</strong> {flyAnalysis.suggestions.closeMatches.map((name, index) => <span key={name}>{index ? ", " : ""}<button className="speciesSuggestionBtn" type="button" onClick={() => selectFlyMatch(name)}>{name}</button></span>)}</p>}
          {flyAnalysis.suggestions.visibleMaterials.length > 0 && <p><strong>Visible construction:</strong> {flyAnalysis.suggestions.visibleMaterials.join(", ")}</p>}
          {flyAnalysis.suggestions.approximateMaterials.length > 0 && <p><strong>{flyAnalysis.suggestions.recipeStatus === "library" ? "Library materials:" : "Suggested materials—not a verified recipe:"}</strong> {flyAnalysis.suggestions.approximateMaterials.join(", ")}</p>}
          {flyAnalysis.suggestions.approximateSteps.length > 0 && <><strong>{flyAnalysis.suggestions.recipeStatus === "library" ? "Library tying sequence:" : "Approximate tying sequence:"}</strong><ol>{flyAnalysis.suggestions.approximateSteps.map((step) => <li key={step}>{step}</li>)}</ol></>}
          {flyAnalysis.suggestions.fishingTip && <p><strong>How to fish it:</strong> {flyAnalysis.suggestions.fishingTip}</p>}
          {flyAnalysis.suggestions.reasoning && <p><strong>Why:</strong> {flyAnalysis.suggestions.reasoning}</p>}
          <div className="flyIdentifierActions"><button type="button" className="secondaryBtn" onClick={() => setQuery(flyAnalysis.suggestions.name)}>Search library</button><button type="button" className="heroBtn" onClick={useFlySuggestion}>Edit and save as custom</button></div>
          {(identifiedLibraryMatches.length > 0 || identifiedClassicMatches.length > 0) && <div className="groundedFlyMatches"><strong>Library matches</strong>{identifiedLibraryMatches.map((fly) => <button type="button" key={fly.id || fly.name} onClick={() => setQuery(fly.name)}>{fly.name}</button>)}{identifiedClassicMatches.map((pattern) => <a key={pattern.url} href={pattern.url} target="_blank" rel="noreferrer">{pattern.title} ↗</a>)}</div>}
        </div>}
      </section>

      <div className="flySearchPanel">
        <label htmlFor="fly-pattern-search">Search flies, materials, species, authors, or books</label>
        <div className="flySearchControls">
          <input id="fly-pattern-search" type="search" placeholder="Try Woolly Bugger, bass, marabou, Kelson..." value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button className="secondaryBtn" type="button" onClick={() => setQuery("")}>Clear</button>}
        </div>
        <p>{normalizedQuery
          ? `${matchingFlies.length} HoodFlyLog pattern${matchingFlies.length === 1 ? "" : "s"} · ${matchingClassicPatterns.length} FlyPattern.org match${matchingClassicPatterns.length === 1 ? "" : "es"}`
          : `Searches ${flyLibrary.length} HoodFlyLog patterns and ${classicPatterns.length || "1,193"} classic FlyPattern.org records.`}</p>
      </div>



      <div className="sectionHeader flyLibraryHeading">
        <div><p className="eyebrow">Modern and personal</p><h3>HoodFlyLog Patterns</h3></div>
      </div>
      {matchingFlies.length ? (
        <div className="libraryGrid">
          {matchingFlies.map((fly) => {
            const videoId = getYouTubeVideoId(fly.videoUrl)
            return (
              <article className="libraryCard" key={fly.id || fly.name}>
                <p className="eyebrow">{fly.type}</p>
                <h3>{fly.name}</h3>
                {fly.custom && <span className="customBadge">Custom</span>}
                <p><strong>Best for:</strong> {fly.bestFor}</p>
                <p><strong>Materials:</strong> {fly.materials}</p>
                <p>{fly.tip}</p>
                {fly.sourceUrl && <p className="libraryAttribution"><strong>Pattern source:</strong> <a href={fly.sourceUrl} target="_blank" rel="noreferrer">{fly.sourceName} ↗</a></p>}
                {videoId && <iframe className="flyVideo" src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={`${fly.name} tying tutorial`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}
                {fly.custom && <button className="textBtn" type="button" onClick={() => onRemoveCustomFly(fly.id)}>Remove</button>}
              </article>
            )
          })}
        </div>
      ) : <p className="emptyState">No HoodFlyLog patterns match “{query}”.</p>}

      <div className="sectionHeader flyLibraryHeading">
        <div><p className="eyebrow">Historical reference</p><h3>Classic FlyPattern.org Index</h3></div>
        <a className="secondaryBtn externalLibraryBtn" href="https://flypattern.org/search/" target="_blank" rel="noreferrer">Browse source ↗</a>
      </div>
      <p className="libraryAttribution">Classic pattern titles and source links are provided by <a href="https://flypattern.org/" target="_blank" rel="noreferrer">FlyPattern.org</a> under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>. Recipes open on the attributed source site.</p>
      {classicStatus && <p className="formMessage">{classicStatus}</p>}
      {displayedClassicPatterns.length > 0 && (
        <div className="classicPatternList">
          {displayedClassicPatterns.map((pattern) => (
            <a key={pattern.url} className="classicPatternRow" href={pattern.url} target="_blank" rel="noreferrer">
              <strong>{pattern.title}</strong>
              <span>{pattern.authorName || "Unknown author"}{pattern.bookTitle ? ` · ${pattern.bookTitle}` : ""}</span>
            </a>
          ))}
        </div>
      )}
      {normalizedQuery && matchingClassicPatterns.length > displayedClassicPatterns.length && <p className="libraryAttribution">Showing the first {displayedClassicPatterns.length} matches. Narrow the search to find a specific classic pattern.</p>}
      {!classicStatus && !normalizedQuery && <p className="classicSearchPrompt">Enter a fly name, author, material, species, or source book above to search FlyPattern.org.</p>}
      {!classicStatus && normalizedQuery && displayedClassicPatterns.length === 0 && <p className="classicSearchPrompt">No FlyPattern.org patterns match “{query}”. Try a broader pattern name or author.</p>}
      <form className="libraryForm" onSubmit={addFly}>
        <div className="sectionHeader compactHeader">
          <div>
            <p className="eyebrow">Saved on this device</p>
            <h3>Add a Custom Fly</h3>
          </div>
          <button className="heroBtn" type="submit">Save Fly</button>
        </div>
        <div className="libraryFormGrid">
          <label>Fly name<input type="text" placeholder="Crescent Bend Bugger" value={formData.name} onChange={(event) => updateField("name", event.target.value)} /></label>
          <label>Type<input type="text" placeholder="Streamer, dry, nymph..." value={formData.type} onChange={(event) => updateField("type", event.target.value)} /></label>
          <label>Best for<input type="text" placeholder="Bass, panfish, trout..." value={formData.bestFor} onChange={(event) => updateField("bestFor", event.target.value)} /></label>
          <label>Materials<input type="text" placeholder="Hook, thread, body, tail..." value={formData.materials} onChange={(event) => updateField("materials", event.target.value)} /></label>
          <label className="fullWidth">YouTube tutorial (optional)<input type="url" placeholder="https://www.youtube.com/watch?v=..." value={formData.videoUrl} onChange={(event) => updateField("videoUrl", event.target.value)} /></label>
          <label className="fullWidth">Tip<textarea placeholder="Tying notes, colors, retrieve, where it works..." value={formData.tip} onChange={(event) => updateField("tip", event.target.value)} /></label>
        </div>
        {message && <p className="formMessage">{message}</p>}
      </form>
    </div>
  )
}

function namesOverlap(left, right) {
  const a = String(left || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const b = String(right || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  return Boolean(a && b && (a.includes(b) || b.includes(a)))
}

function formatFlyConfidence(value) {
  const confidence = Number(value)
  return Number.isFinite(confidence) ? `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%` : "Not available"
}

async function readFlyApiJson(response) {
  const body = await response.text()
  if (!body.trim()) throw new Error("Fly Identifier returned an empty response. Use npm run dev:worker for local AI testing.")
  try {
    return JSON.parse(body)
  } catch {
    throw new Error("Fly Identifier was unavailable. Use npm run dev:worker for local AI testing.")
  }
}

async function prepareFlyImage(file) {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.82))
}
function getYouTubeVideoId(value) {
  if (!value) return ""
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, "").toLowerCase()
    let id = ""
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || ""
    if (host === "youtube.com" || host === "m.youtube.com") {
      id = url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")
        ? url.pathname.split("/").filter(Boolean)[1] || ""
        : url.searchParams.get("v") || ""
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : ""
  } catch {
    return ""
  }
}

function normalizeYouTubeUrl(value) {
  const id = getYouTubeVideoId(value.trim())
  return id ? `https://www.youtube.com/watch?v=${id}` : ""
}
function Profile({ profile, user, onSaveProfile }) {
  const [formData, setFormData] = useState(() => ({
    display_name: profile?.display_name || "",
    home_water: profile?.home_water || "",
    hometown: profile?.hometown || "",
    bio: profile?.bio || "",
  }))
  const [message, setMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field, value) {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  async function saveProfile() {
    setMessage("")
    setIsSaving(true)
    const result = await onSaveProfile(formData)
    setIsSaving(false)
    setMessage(result.ok ? "Profile saved." : result.error)
  }

  return (
    <div className="panel">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Angler profile</p>
          <h2>👤 Profile</h2>
        </div>
      </div>

      <div className="profileSummary">
        <div className="profileAvatar">{getInitials(profile?.display_name || user.email)}</div>
        <div>
          <h3>{profile?.display_name || "New Angler"}</h3>
          <p>{profile?.home_water || "Add your home water"}</p>
        </div>
      </div>

      <form className="catchForm">
        <label>
          Display Name
          <input type="text" placeholder="Hood" value={formData.display_name} onChange={(event) => updateField("display_name", event.target.value)} />
        </label>

        <label>
          Home Water
          <input type="text" placeholder="Guadalupe River" value={formData.home_water} onChange={(event) => updateField("home_water", event.target.value)} />
        </label>

        <label>
          Hometown
          <input type="text" placeholder="Victoria, TX" value={formData.hometown} onChange={(event) => updateField("hometown", event.target.value)} />
        </label>

        <label>
          Email
          <input type="email" value={user.email} disabled />
        </label>

        <label className="fullWidth">
          Bio
          <textarea placeholder="Favorite water, favorite flies, target species..." value={formData.bio} onChange={(event) => updateField("bio", event.target.value)} />
        </label>

        <button type="button" className="heroBtn fullWidth" onClick={saveProfile}>
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
        {message && <p className="formMessage fullWidth">{message}</p>}
      </form>
    </div>
  )
}

function ProfilePreview({ profile, user, onOpenProfile }) {
  return (
    <button className="profilePreview" onClick={onOpenProfile}>
      <span>{getInitials(profile?.display_name || user.email)}</span>
      <div>
        <strong>{profile?.display_name || "Set up profile"}</strong>
        <p>{profile?.home_water || "Add home water"}</p>
      </div>
    </button>
  )
}

function AuthPanel() {
  const [mode, setMode] = useState("signIn")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignUp = mode === "signUp"

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage("")
    setIsSubmitting(true)

    const authAction = isSignUp
      ? supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      })
      : supabase.auth.signInWithPassword({ email, password })
    const { error } = await authAction

    setIsSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(isSignUp ? "Account created. Check your email if confirmation is enabled." : "Signed in.")
  }

  return (
    <div className="authShell">
      <div className="authPanel">
        <img src={logo} alt="HoodFlyLog" className="authLogo" />
        <p className="eyebrow">Private fishing journal</p>
        <h2>{isSignUp ? "Create your account" : "Welcome back"}</h2>
        <p>Sign in to save catches, photos, weather notes, and trip history to your HoodFlyLog account.</p>

        <form className="authForm" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="6" required />
          </label>

          <button type="submit" className="heroBtn">
            {isSubmitting ? "Working..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {message && <p className="authMessage">{message}</p>}

        <button
          type="button"
          className="linkBtn"
          onClick={() => {
            setMode(isSignUp ? "signIn" : "signUp")
            setMessage("")
          }}
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  )
}

function ModeratorAdmin({ currentUser }) {
  const [users, setUsers] = useState([])
  const [managedCatches, setManagedCatches] = useState([])
  const [catchFilter, setCatchFilter] = useState("pending")
  const [editingCatchId, setEditingCatchId] = useState("")
  const [editForm, setEditForm] = useState({})
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("Loading moderation tools...")
  const [isSaving, setIsSaving] = useState(false)

  async function loadData() {
    const [profiles, catches] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name, role, is_banned, ban_reason").order("email"),
      supabase.from("catches").select("*").order("created_at", { ascending: false }),
    ])
    const error = profiles.error || catches.error
    if (error) {
      console.error(error)
      setStatus(error.message || "Moderation data could not be loaded.")
      return
    }
    setUsers(profiles.data || [])
    setManagedCatches(catches.data || [])
    setStatus("")
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function runAction(action, message) {
    setIsSaving(true)
    setStatus("Saving...")
    const { error } = await action()
    if (error) {
      console.error(error)
      setStatus(error.message || "The moderation action failed.")
    } else {
      await loadData()
      setStatus(message)
    }
    setIsSaving(false)
  }

  function setModeratorRole(targetEmail, makeModerator) {
    return runAction(() => supabase.rpc("set_moderator_role", {
      target_email: targetEmail.trim().toLowerCase(),
      make_moderator: makeModerator,
    }), makeModerator ? "Moderator added." : "Moderator removed.")
  }

  function addModerator(event) {
    event.preventDefault()
    if (!email.trim()) return setStatus("Enter the angler's account email.")
    setModeratorRole(email, true)
    setEmail("")
  }

  function reviewCatch(catchId, decision) {
    return runAction(
      () => supabase.rpc("review_catch", { catch_id: catchId, decision }),
      `Catch ${decision}.`
    )
  }

  function beginEditing(fish) {
    setEditingCatchId(fish.id)
    setEditForm({
      species: fish.species || "",
      location: fish.location || "",
      length: fish.length || "",
      fly: fish.fly || "",
      date: fish.date || "",
      time: fish.time || "",
      notes: fish.notes || "",
      is_public: fish.is_public !== false,
    })
  }

  function updateEditField(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  async function saveCatchEdits(event) {
    event.preventDefault()
    await runAction(
      () => supabase.rpc("moderator_update_catch", { catch_id: editingCatchId, changes: editForm }),
      "Catch updated."
    )
    setEditingCatchId("")
  }

  function deleteCatch(fish) {
    const label = fish.species || "this catch"
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return
    return runAction(
      () => supabase.rpc("moderator_delete_catch", { catch_id: fish.id }),
      "Catch deleted."
    )
  }

  function setUserBan(targetEmail, shouldBan) {
    const reason = shouldBan ? window.prompt("Reason for banning this user?")?.trim() : ""
    if (shouldBan && !reason) return setStatus("A ban reason is required.")
    return runAction(() => supabase.rpc("set_user_ban", {
      target_email: targetEmail.toLowerCase(),
      should_ban: shouldBan,
      reason,
    }), shouldBan ? "User banned." : "User unbanned.")
  }

  const moderators = users.filter((account) => account.role === "moderator")
  const visibleCatches = catchFilter === "all"
    ? managedCatches
    : managedCatches.filter((fish) => fish.moderation_status === catchFilter)
  const pendingCount = managedCatches.filter((fish) => fish.moderation_status === "pending").length

  return (
    <div className="moderationStack">
      <section className="panel moderatorPanel">
        <div className="pageHeader compactHeader">
          <div><p className="eyebrow">Catch management</p><h2>🛡️ Catch Moderation</h2><p>Review, edit, change status, or delete any catch.</p></div>
          <span className="customBadge">{pendingCount} pending</span>
        </div>
        {status && <p className="formMessage" role="status">{status}</p>}
        <div className="moderationFilters">
          {["pending", "approved", "rejected", "all"].map((filter) => (
            <button className={catchFilter === filter ? "active" : ""} key={filter} onClick={() => setCatchFilter(filter)} type="button">{filter}</button>
          ))}
        </div>
        <div className="moderationQueue">
          {visibleCatches.map((fish) => {
            const angler = users.find((account) => account.id === fish.user_id)
            const isEditing = editingCatchId === fish.id
            return (
              <article className="moderationCatchCard" key={fish.id}>
                {fish.photo_url && <img src={fish.photo_url} alt={fish.species || "Catch"} className="catchPhoto" />}
                {isEditing ? (
                  <form className="moderationEditForm" onSubmit={saveCatchEdits}>
                    <label>Species<input value={editForm.species} onChange={(event) => updateEditField("species", event.target.value)} /></label>
                    <label>Location<input value={editForm.location} onChange={(event) => updateEditField("location", event.target.value)} /></label>
                    <label>Length<input value={editForm.length} onChange={(event) => updateEditField("length", event.target.value)} /></label>
                    <label>Fly<input value={editForm.fly} onChange={(event) => updateEditField("fly", event.target.value)} /></label>
                    <label>Date<input type="date" value={editForm.date} onChange={(event) => updateEditField("date", event.target.value)} /></label>
                    <label>Time<input type="time" value={editForm.time} onChange={(event) => updateEditField("time", event.target.value)} /></label>
                    <label className="fullWidth">Notes<textarea value={editForm.notes} onChange={(event) => updateEditField("notes", event.target.value)} /></label>
                    <label className="checkboxLabel"><input type="checkbox" checked={editForm.is_public} onChange={(event) => updateEditField("is_public", event.target.checked)} /> Public catch</label>
                    <div className="moderationActions fullWidth">
                      <button className="heroBtn" disabled={isSaving} type="submit">Save changes</button>
                      <button className="secondaryBtn" onClick={() => setEditingCatchId("")} type="button">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <span className={`moderationBadge ${fish.moderation_status}`}>{fish.moderation_status}</span>
                    <h3>{fish.species || "Unknown Fish"}</h3>
                    <p>Angler: {angler?.display_name || angler?.email || shortAnglerId(fish.user_id)}</p>
                    <p>📍 {fish.location || "No location"} · 📏 {fish.length || "No length"}</p>
                    <p>🪰 {fish.fly || "No fly listed"}</p>
                    {fish.notes && <p>📝 {fish.notes}</p>}
                  </div>
                )}
                {!isEditing && <div className="moderationActions catchAdminActions">
                  <button className="heroBtn" disabled={isSaving} onClick={() => reviewCatch(fish.id, "approved")} type="button">Approve</button>
                  <button className="secondaryBtn" disabled={isSaving} onClick={() => reviewCatch(fish.id, "rejected")} type="button">Reject</button>
                  <button className="secondaryBtn" disabled={isSaving} onClick={() => beginEditing(fish)} type="button">Edit</button>
                  <button className="dangerBtn" disabled={isSaving} onClick={() => deleteCatch(fish)} type="button">Delete</button>
                </div>}
              </article>
            )
          })}
          {visibleCatches.length === 0 && <p>No {catchFilter === "all" ? "" : catchFilter} catches found.</p>}
        </div>
      </section>

      <section className="panel moderatorPanel">
        <div className="pageHeader compactHeader"><div><p className="eyebrow">Access</p><h2>Moderators</h2></div></div>
        <form className="moderatorForm" onSubmit={addModerator}>
          <label>Angler email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="angler@example.com" disabled={isSaving} /></label>
          <button className="heroBtn" type="submit" disabled={isSaving}>Add moderator</button>
        </form>
        <div className="moderatorList">
          {moderators.map((moderator) => {
            const accountEmail = moderator.email?.toLowerCase()
            const protectedAccount = accountEmail === OWNER_EMAIL || accountEmail === currentUser.email?.toLowerCase()
            return <div className="moderatorCard" key={moderator.id}>
              <div><strong>{moderator.display_name || moderator.email}</strong><p>{moderator.email}</p></div>
              {protectedAccount ? <span className="customBadge">Protected</span> : <button className="textBtn" type="button" disabled={isSaving} onClick={() => setModeratorRole(moderator.email, false)}>Remove</button>}
            </div>
          })}
        </div>
      </section>

      <section className="panel moderatorPanel">
        <div className="pageHeader compactHeader"><div><p className="eyebrow">Community safety</p><h2>User Accounts</h2><p>Banned users cannot enter the app or add catches.</p></div></div>
        <div className="moderatorList">
          {users.map((account) => {
            const accountEmail = account.email?.toLowerCase()
            const protectedAccount = accountEmail === OWNER_EMAIL || accountEmail === currentUser.email?.toLowerCase()
            return <div className="moderatorCard" key={account.id}>
              <div><strong>{account.display_name || account.email}</strong><p>{account.email} · {account.role || "angler"}</p>{account.is_banned && <p className="banReason">Banned: {account.ban_reason || "No reason provided"}</p>}</div>
              {protectedAccount ? <span className="customBadge">Protected</span> : <button className={account.is_banned ? "secondaryBtn" : "dangerBtn"} disabled={isSaving} onClick={() => setUserBan(account.email, !account.is_banned)} type="button">{account.is_banned ? "Unban" : "Ban"}</button>}
            </div>
          })}
        </div>
      </section>
    </div>
  )
}
function BannedAccount({ profile, onSignOut }) {
  return <div className="authShell"><div className="authPanel">
    <p className="eyebrow">Account restricted</p>
    <h2>This account has been banned</h2>
    <p>{profile?.ban_reason || "Contact HoodFlyLog moderation if you believe this was a mistake."}</p>
    <button className="secondaryBtn" onClick={onSignOut} type="button">Sign Out</button>
  </div></div>
}
function App() {
  const [activePage, setActivePage] = useState("dashboard")
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const savedCatchPhotoInputRef = useRef(null)
  const [catches, setCatches] = useState(() => {
    const saved = localStorage.getItem("hoodflylog-catches")
    return saved ? JSON.parse(saved) : []
  })
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("hoodflylog-view-mode") || "public")
  const [loadStatus, setLoadStatus] = useState("Loading catch log...")
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [communityCatches, setCommunityCatches] = useState([])
  const [photoTargetCatch, setPhotoTargetCatch] = useState(null)
  const [uploadingCatchId, setUploadingCatchId] = useState("")
  const [customKnots, setCustomKnots] = useState(() => readStoredList("hoodflylog-custom-knots"))
  const [customFlies, setCustomFlies] = useState(() => readStoredList("hoodflylog-custom-flies"))
  const user = session?.user
  const isModerator = profile?.role === "moderator" || user?.email?.toLowerCase() === OWNER_EMAIL
  
  useEffect(() => {
    localStorage.setItem("hoodflylog-catches", JSON.stringify(catches))
  }, [catches])

  useEffect(() => {
    localStorage.setItem("hoodflylog-view-mode", viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem("hoodflylog-custom-knots", JSON.stringify(customKnots))
  }, [customKnots])

  useEffect(() => {
    localStorage.setItem("hoodflylog-custom-flies", JSON.stringify(customFlies))
  }, [customFlies])

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      const nextSession = data.session
      setSession(nextSession)
      if (nextSession) {
        setViewMode("app")
      }
      setAuthLoading(false)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) {
        setViewMode("app")
        setActivePage("dashboard")
      }
      setAuthLoading(false)
    })

    loadSession()

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setProfile(null)
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
        console.error(error)
        return
      }

      if (data) {
        setProfile(data)
      }
    }

    loadProfile()
  }, [user])

  useEffect(() => {
    async function loadCatches() {
      setLoadStatus("Loading catch log...")

      let query = supabase
        .from("catches")
        .select("*")
        .order("date", { ascending: false })

      if (user) {
        query = query.eq("user_id", user.id)
      } else {
        query = query.eq("is_public", true).eq("moderation_status", "approved")
      }

      const { data, error } = await query

      if (error) {
        console.error(error)
        setLoadStatus("Using catches saved on this device.")
        return
      }

      const catchesWithAnglers = await attachAnglerNames(data || [], profile)
      setCatches(catchesWithAnglers)
      setLoadStatus("")
    }

    loadCatches()
  }, [user, profile])

  useEffect(() => {
    async function loadCommunityCatches() {
      const { data, error } = await supabase.from("catches").select("*").eq("is_public", true).eq("moderation_status", "approved").order("date", { ascending: false })
      if (error) return console.error(error)
      setCommunityCatches(await attachAnglerNames(data || [], profile))
    }
    loadCommunityCatches()
  }, [profile])

  useEffect(() => {
    return () => {
      if (selectedPhoto?.previewUrl) {
        URL.revokeObjectURL(selectedPhoto.previewUrl)
      }
    }
  }, [selectedPhoto])

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

  if (authLoading) {
    return (
      <div className="authShell">
        <div className="authPanel">
          <p>Loading HoodFlyLog...</p>
        </div>
      </div>
    )
  }

  if (viewMode === "public") {
    return <LandingPage catches={communityCatches} onEnterApp={() => setViewMode("app")} />
  }

  if (!user) {
    return <AuthPanel />
  }

  if (profile?.is_banned) {
    return <BannedAccount profile={profile} onSignOut={signOut} />
  }

  const navItems = [
    { id: "dashboard", label: "Home", icon: "🏠" },
    { id: "history", label: "Journal", icon: "📖" },
    { id: "log", label: "Log Catch", icon: "📸", primary: true },
    { id: "knots", label: "Knots", icon: "🪢" },
    { id: "flytying", label: "Fly Tying", icon: "🪰" },
  ]
  const sidebarItems = [
    ...navItems,
    { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
    ...(isModerator ? [{ id: "moderators", label: "Moderation", icon: "🛡️" }] : []),
    { id: "profile", label: "Profile", icon: "👤" },
  ]
  const displayName = profile?.display_name || user.email?.split("@")[0] || "angler"

async function handleSaveCatch(newCatch) {
  const { photoUploadNote, ...photoDetails } = await uploadSelectedPhoto()
  const catchToSave = {
    ...newCatch,
    ...photoDetails,
    user_id: user.id,
    moderation_status: "pending",
  }

  if (photoUploadNote) {
    catchToSave.notes = catchToSave.notes ? `${catchToSave.notes}\n\n${photoUploadNote}` : photoUploadNote
  }

  const { data, error } = await supabase
    .from("catches")
    .insert([catchToSave])
    .select()
    .single()

  if (error) {
    console.error(error)
    setLoadStatus("Cloud save failed. Check your connection and try again.")
    return false
  }

  setCatches((currentCatches) => [data, ...currentCatches])
  clearSelectedPhoto()
  setActivePage("history")
  return true
}

async function uploadSelectedPhoto() {
  if (!selectedPhoto?.file) {
    return {}
  }

  const filePath = createCatchPhotoPath(selectedPhoto.file, user.id)
  const { error } = await supabase.storage
    .from("catch-photos")
    .upload(filePath, selectedPhoto.file, {
      cacheControl: "3600",
      upsert: false,
    })

  if (error) {
    console.error(error)
    return {
      photoUploadNote: `Photo upload failed: ${selectedPhoto.name}`,
    }
  }

  const { data } = supabase.storage
    .from("catch-photos")
    .getPublicUrl(filePath)

  return {
    photo_path: filePath,
    photo_url: data.publicUrl,
  }
}

function clearSelectedPhoto() {
  setSelectedPhoto((currentPhoto) => {
    if (currentPhoto?.previewUrl) {
      URL.revokeObjectURL(currentPhoto.previewUrl)
    }

    return null
  })
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

function openCamera() {
  setActivePage("log")
  window.setTimeout(() => {
    cameraInputRef.current?.click()
  }, 100)
}

function openGallery() {
  setActivePage("log")
  window.setTimeout(() => {
    galleryInputRef.current?.click()
  }, 100)
}

function handlePhotoSelected(event) {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  setSelectedPhoto((currentPhoto) => {
    if (currentPhoto?.previewUrl) {
      URL.revokeObjectURL(currentPhoto.previewUrl)
    }

    return {
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }
  })
}

function openSavedCatchPhotoPicker(fish) {
  setPhotoTargetCatch(fish)
  window.setTimeout(() => {
    savedCatchPhotoInputRef.current?.click()
  }, 100)
}

async function handleSavedCatchPhotoSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ""

  if (!file || !photoTargetCatch) {
    return
  }

  setUploadingCatchId(photoTargetCatch.id)

  const filePath = createCatchPhotoPath(file, user.id)
  const { error: uploadError } = await supabase.storage
    .from("catch-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

  if (uploadError) {
    console.error(uploadError)
    alert("Photo upload failed. Check your connection and try again.")
    setUploadingCatchId("")
    setPhotoTargetCatch(null)
    return
  }

  const { data: publicUrlData } = supabase.storage
    .from("catch-photos")
    .getPublicUrl(filePath)

  const photoUpdate = {
    photo_path: filePath,
    photo_url: publicUrlData.publicUrl,
  }

  const { data, error: updateError } = await supabase
    .from("catches")
    .update(photoUpdate)
    .eq("id", photoTargetCatch.id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (updateError) {
    console.error(updateError)
    alert("Photo uploaded, but the catch could not be updated. Try again from the Journal.")
    setUploadingCatchId("")
    setPhotoTargetCatch(null)
    return
  }

  setCatches((currentCatches) =>
    currentCatches.map((fish) => fish.id === photoTargetCatch.id ? data : fish)
  )
  setUploadingCatchId("")
  setPhotoTargetCatch(null)
}

function handleNavClick(item) {
  setActivePage(item.id)
}

function addCustomKnot(knot) {
  setCustomKnots((currentKnots) => [knot, ...currentKnots])
}

function removeCustomKnot(knotId) {
  setCustomKnots((currentKnots) => currentKnots.filter((knot) => knot.id !== knotId))
}

function addCustomFly(fly) {
  setCustomFlies((currentFlies) => [fly, ...currentFlies])
}

function removeCustomFly(flyId) {
  setCustomFlies((currentFlies) => currentFlies.filter((fly) => fly.id !== flyId))
}

async function signOut() {
  await supabase.auth.signOut()
  setCatches([])
  clearSelectedPhoto()
  setViewMode("public")
}

async function saveProfile(formData) {
  const profileToSave = {
    id: user.id,
    email: user.email,
    display_name: formData.display_name.trim(),
    home_water: formData.home_water.trim(),
    hometown: formData.hometown.trim(),
    bio: formData.bio.trim(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(profileToSave, { onConflict: "id" })
    .select()
    .single()

  if (error) {
    console.error(error)
    return {
      ok: false,
      error: error.message || "Profile could not be saved.",
    }
  }

  setProfile(data)
  return {
    ok: true,
  }
}

  return (
    <div className="app">
      <aside className="sideNav">
        <img src={logo} alt="HoodFlyLog" className="sideLogo" />
        <ProfilePreview profile={profile} user={user} onOpenProfile={() => setActivePage("profile")} />
        <div className="sideNavLinks">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              className={activePage === item.id ? "active" : ""}
              onClick={() => handleNavClick(item)}
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
          <p>Welcome back, {displayName}! Tight lines.</p>
        </div>
        <div className="topbarActions">
          <button className="primaryBtn" onClick={() => setActivePage("profile")}>Profile</button>
          <button className="primaryBtn" onClick={() => setViewMode("public")}>Public Site</button>
          <button className="secondaryBtn" onClick={signOut}>Sign Out</button>
        </div>
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
                    {fish.photo_url && <img src={fish.photo_url} alt={fish.species || "Recent catch"} className="catchPhoto" />}
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
            <button className="toolBtn" onClick={() => setActivePage("leaderboard")}>🏆 View Leaderboard</button>
            <button className="toolBtn" onClick={() => setActivePage("knots")}>🪢 Open Knots Library</button>
            <button className="toolBtn" onClick={() => setActivePage("flytying")}>🪰 Open Fly Tying Library</button>
            <button className="toolBtn">🗺️ View Fishing Map</button>
            <button className="toolBtn" onClick={exportCatches}>📤 Export Catch Log</button>
          </div>
        </section>
              </>
    )}

   {activePage === "log" && <LogCatch onSaveCatch={handleSaveCatch} selectedPhoto={selectedPhoto} onOpenCamera={openCamera} onChoosePhoto={openGallery} />}
{activePage === "history" && <Journal catches={catches} onChooseCatchPhoto={openSavedCatchPhotoPicker} uploadingCatchId={uploadingCatchId} />}
    {activePage === "leaderboard" && <Leaderboard catches={communityCatches} onLogCatch={() => setActivePage("log")} />}
    {activePage === "knots" && <Knots customKnots={customKnots} onAddCustomKnot={addCustomKnot} onRemoveCustomKnot={removeCustomKnot} />}
    {activePage === "flytying" && <FlyTying customFlies={customFlies} onAddCustomFly={addCustomFly} onRemoveCustomFly={removeCustomFly} />}
    {activePage === "profile" && <Profile key={profile?.updated_at || user.id} profile={profile} user={user} onSaveProfile={saveProfile} />}
    {activePage === "moderators" && isModerator && <ModeratorAdmin currentUser={user} />}
      </main>

      <nav className="bottomNav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={activePage === item.id ? "active" : ""}
            onClick={() => handleNavClick(item)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <input
        ref={cameraInputRef}
        className="cameraInput"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelected}
      />
      <input
        ref={galleryInputRef}
        className="cameraInput"
        type="file"
        accept="image/*"
        onChange={handlePhotoSelected}
      />
      <input
        ref={savedCatchPhotoInputRef}
        className="cameraInput"
        type="file"
        accept="image/*"
        onChange={handleSavedCatchPhotoSelected}
      />
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

function readStoredList(key) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error(error)
    return []
  }
}

function splitListInput(value) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseCatchLength(value) {
  const length = Number.parseFloat(String(value || "").replace(/[^0-9.]/g, ""))
  return Number.isFinite(length) ? length : 0
}

function shortAnglerId(userId = "") {
  return userId ? `Angler ${String(userId).slice(0, 4)}` : ""
}

function getInitials(value = "") {
  const parts = value
    .replace(/@.*/, "")
    .split(/\s+|[._-]+/)
    .filter(Boolean)

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "HF"
}

async function attachAnglerNames(catches, currentProfile) {
  const userIds = [...new Set(catches.map((fish) => fish.user_id).filter(Boolean))]

  if (userIds.length === 0) {
    return catches
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds)

  const profileNames = new Map()

  if (!error) {
    data?.forEach((profile) => {
      if (profile.display_name) {
        profileNames.set(profile.id, profile.display_name)
      }
    })
  }

  if (currentProfile?.id && currentProfile.display_name) {
    profileNames.set(currentProfile.id, currentProfile.display_name)
  }

  return catches.map((fish) => ({
    ...fish,
    angler_name: profileNames.get(fish.user_id) || fish.angler_name,
  }))
}

function createCatchPhotoPath(file, userId) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const safeName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "catch"

  return `users/${userId}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${extension}`
}
