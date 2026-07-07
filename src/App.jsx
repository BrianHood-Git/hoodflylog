import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "./supabase"
import LandingPage from "./components/LandingPage"
import logo from "./assets/hoodflylog-logo.jpg"
import "./App.css"
function LogCatch({ onSaveCatch, selectedPhoto, onOpenCamera }) {
  const [formData, setFormData] = useState(() => createBlankCatchForm())
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [weatherStatus, setWeatherStatus] = useState("")

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

    if (selectedPhoto?.name) {
      const photoNote = `Photo captured: ${selectedPhoto.name}`
      cleanedCatch.notes = cleanedCatch.notes ? `${cleanedCatch.notes}\n\n${photoNote}` : photoNote
    }

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

    setFormData(createBlankCatchForm())
  }

  async function useGpsWeather() {
    if (!navigator.geolocation) {
      setWeatherStatus("GPS is not available in this browser.")
      return
    }

    setWeatherStatus("Getting GPS and weather...")

    try {
      const position = await getCurrentPosition()
      const latitude = position.coords.latitude.toFixed(5)
      const longitude = position.coords.longitude.toFixed(5)
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
      const response = await fetch(weatherUrl)

      if (!response.ok) {
        throw new Error("Weather request failed")
      }

      const weather = await response.json()
      const current = weather.current || {}
      const weatherNote = [
        `GPS: ${latitude}, ${longitude}`,
        `Weather: ${current.temperature_2m ?? "?"}F, wind ${current.wind_speed_10m ?? "?"} mph, humidity ${current.relative_humidity_2m ?? "?"}%, pressure ${current.pressure_msl ?? "?"} hPa`,
      ].join("\n")

      setFormData((currentForm) => ({
        ...currentForm,
        location: currentForm.location || `${latitude}, ${longitude}`,
        notes: currentForm.notes ? `${currentForm.notes}\n\n${weatherNote}` : weatherNote,
      }))
      setWeatherStatus("GPS and weather added.")
    } catch (error) {
      console.error(error)
      setWeatherStatus("Could not load GPS/weather. Check location permission and signal.")
    }
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
        <div className="photoCapture fullWidth">
          <button type="button" className="cameraBtn" onClick={onOpenCamera}>
            📸 Add Catch Photo
          </button>
          {selectedPhoto ? (
            <div className="photoPreview">
              <img src={selectedPhoto.previewUrl} alt="Catch preview" />
              <span>{selectedPhoto.name}</span>
            </div>
          ) : (
            <p>Tap the camera button to take or choose a catch photo.</p>
          )}
        </div>

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

        <button type="button" className="secondaryBtn fullWidth" onClick={useGpsWeather}>
          Use GPS + Weather
        </button>
        {weatherStatus && <p className="formMessage fullWidth">{weatherStatus}</p>}

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
              {fish.photo_url && <img src={fish.photo_url} alt={fish.species || "Saved catch"} className="catchPhoto" />}
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

  return (
    <div className="panel">
      <h2>🪢 Knots Library</h2>
      <div className="libraryGrid">
        {knots.map((knot) => (
          <article className="libraryCard" key={knot.name}>
            <p className="eyebrow">{knot.use}</p>
            <h3>{knot.name}</h3>
            <p>{knot.notes}</p>
            <ol>
              {knot.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </div>
  )
}

function FlyTying() {
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
      name: "San Juan Worm",
      type: "Attractor nymph",
      bestFor: "Trout, carp, panfish",
      materials: "Chenille or worm material, thread, bead optional",
      tip: "Excellent after rain or in stained water. Red, pink, wine, and brown are common choices.",
    },
    {
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

  return (
    <div className="panel">
      <h2>🪰 Fly Tying Library</h2>
      <div className="libraryGrid">
        {flies.map((fly) => (
          <article className="libraryCard" key={fly.name}>
            <p className="eyebrow">{fly.type}</p>
            <h3>{fly.name}</h3>
            <p><strong>Best for:</strong> {fly.bestFor}</p>
            <p><strong>Materials:</strong> {fly.materials}</p>
            <p>{fly.tip}</p>
          </article>
        ))}
      </div>
    </div>
  )
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
    const saved = await onSaveProfile(formData)
    setIsSaving(false)
    setMessage(saved ? "Profile saved." : "Profile could not be saved.")
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
      ? supabase.auth.signUp({ email, password })
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

function App() {
  const [activePage, setActivePage] = useState("dashboard")
  const cameraInputRef = useRef(null)
  const [catches, setCatches] = useState(() => {
    const saved = localStorage.getItem("hoodflylog-catches")
    return saved ? JSON.parse(saved) : []
  })
  const [viewMode, setViewMode] = useState("public")
  const [loadStatus, setLoadStatus] = useState("Loading catch log...")
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const user = session?.user
  
  useEffect(() => {
    localStorage.setItem("hoodflylog-catches", JSON.stringify(catches))
  }, [catches])

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setAuthLoading(false)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
      setActivePage("dashboard")
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
        query = query.eq("is_public", true)
      }

      const { data, error } = await query

      if (error) {
        console.error(error)
        setLoadStatus("Using catches saved on this device.")
        return
      }

      setCatches(data || [])
      setLoadStatus("")
    }

    loadCatches()
  }, [user])

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

  if (viewMode === "public") {
    return <LandingPage catches={catches} onEnterApp={() => setViewMode("app")} />
  }

  if (authLoading) {
    return (
      <div className="authShell">
        <div className="authPanel">
          <p>Loading HoodFlyLog...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPanel />
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
    { id: "profile", label: "Profile", icon: "👤" },
  ]
  const displayName = profile?.display_name || user.email?.split("@")[0] || "angler"

async function handleSaveCatch(newCatch) {
  const { photoUploadNote, ...photoDetails } = await uploadSelectedPhoto()
  const catchToSave = {
    ...newCatch,
    ...photoDetails,
    user_id: user.id,
  }

  if (photoUploadNote) {
    catchToSave.notes = catchToSave.notes ? `${catchToSave.notes}\n\n${photoUploadNote}` : photoUploadNote
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
    clearSelectedPhoto()
    setActivePage("history")
    return true
  }

  setCatches((currentCatches) => [data || fallbackCatch, ...currentCatches])
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

function handleNavClick(item) {
  setActivePage(item.id)
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
    .upsert(profileToSave)
    .select()
    .single()

  if (error) {
    console.error(error)
    return false
  }

  setProfile(data)
  return true
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
            <button className="toolBtn" onClick={() => setActivePage("knots")}>🪢 Open Knots Library</button>
            <button className="toolBtn" onClick={() => setActivePage("flytying")}>🪰 Open Fly Tying Library</button>
            <button className="toolBtn">🗺️ View Fishing Map</button>
            <button className="toolBtn" onClick={exportCatches}>📤 Export Catch Log</button>
          </div>
        </section>
              </>
    )}

   {activePage === "log" && <LogCatch onSaveCatch={handleSaveCatch} selectedPhoto={selectedPhoto} onOpenCamera={openCamera} />}
{activePage === "history" && <Journal catches={catches} />}
    {activePage === "knots" && <Knots />}
    {activePage === "flytying" && <FlyTying />}
    {activePage === "profile" && <Profile key={profile?.updated_at || user.id} profile={profile} user={user} onSaveProfile={saveProfile} />}
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

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
    })
  })
}

function createBlankCatchForm() {
  const now = new Date()

  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    species: "",
    length: "",
    location: "",
    fly: "",
    setup: "",
    water: "",
    notes: "",
  }
}
