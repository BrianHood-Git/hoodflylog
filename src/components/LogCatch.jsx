import { useState } from "react"
import { supabase } from "../supabase"

const DAILY_AI_LIMIT = 5

function LogCatch({ onSaveCatch, selectedPhoto, onOpenCamera, onChoosePhoto }) {
  const [formData, setFormData] = useState(() => createBlankCatchForm())
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [weatherStatus, setWeatherStatus] = useState("")
  const [analysisStatus, setAnalysisStatus] = useState("")
  const [analysis, setAnalysis] = useState(null)
  const [allowPlaceLookup, setAllowPlaceLookup] = useState(false)
  const [locationAttribution, setLocationAttribution] = useState(null)

  function updateField(field, value) {
    setFormData((current) => ({ ...current, [field]: value }))
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
      setErrorMessage("Catch could not be saved. Check your connection and try again.")
      return
    }

    if (analysis?.suggestions?.species && cleanedCatch.species) {
      recordConfirmedSpecies(cleanedCatch.species)
    }

    setFormData(createBlankCatchForm())
    setAnalysis(null)
    setAnalysisStatus("")
  }

  async function collectGpsWeather({ applyToForm = true } = {}) {
    if (!navigator.geolocation) {
      setWeatherStatus("GPS is not available in this browser.")
      return null
    }

    setWeatherStatus("Getting GPS and weather...")

    try {
      const position = await getCurrentPosition()
      const latitude = Number(position.coords.latitude.toFixed(5))
      const longitude = Number(position.coords.longitude.toFixed(5))
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
      const [response, place] = await Promise.all([
        fetch(weatherUrl),
        allowPlaceLookup ? fetchPlaceSuggestion(latitude, longitude) : Promise.resolve(null),
      ])

      if (!response.ok) throw new Error("Weather request failed")

      const weather = await response.json()
      if (place?.attribution) setLocationAttribution(place)
      const current = weather.current || {}
      const context = {
        latitude,
        longitude,
        placeName: place?.placeName || "",
        timezone: weather.timezone || "",
        temperatureF: current.temperature_2m ?? null,
        windMph: current.wind_speed_10m ?? null,
        humidityPercent: current.relative_humidity_2m ?? null,
        pressureHpa: current.pressure_msl ?? null,
        weatherCode: current.weather_code ?? null,
      }
      const weatherNote = formatWeatherNote(context)

      if (applyToForm) {
        setFormData((currentForm) => ({
          ...currentForm,
          location: currentForm.location || context.placeName || `${latitude}, ${longitude}`,
          notes: appendUniqueNote(currentForm.notes, weatherNote),
        }))
      }

      setWeatherStatus("GPS and weather added.")
      return context
    } catch (error) {
      console.error(error)
      setWeatherStatus("Could not load GPS/weather. Photo analysis can still continue.")
      return null
    }
  }

  async function analyzePhoto() {
    if (!selectedPhoto?.file) {
      setAnalysisStatus("Take or choose a photo before asking the Catch Assistant.")
      return
    }

    if (!canUseAiToday()) {
      setAnalysisStatus(`Daily AI limit reached (${DAILY_AI_LIMIT}). You can still enter the catch manually.`)
      return
    }

    setIsAnalyzing(true)
    setAnalysisStatus("Collecting conditions and analyzing the photo...")
    setAnalysis(null)

    try {
      const weather = await collectGpsWeather({ applyToForm: false })
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) throw new Error("Sign in again before using photo analysis.")

      const requestBody = new FormData()
      const analysisPhoto = await prepareImageForAnalysis(selectedPhoto.file)
      requestBody.append("photo", analysisPhoto, "catch-analysis.jpg")
      requestBody.append("context", JSON.stringify({
        weather,
        existing: {
          species: formData.species,
          location: formData.location,
          fly: formData.fly,
          water: formData.water,
        },
        confirmedSpecies: getConfirmedSpecies(),
      }))

      const response = await fetch("/api/analyze-catch", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: requestBody,
      })
      const result = await readApiJson(response)

      if (!response.ok) throw new Error(result.error || "Photo analysis failed.")

      recordAiUse()
      applySuggestions(result, weather)
      setAnalysis(result)
      setAnalysisStatus(result.provider === "rules"
        ? "AI was unavailable, so GPS/weather context was applied. Review and finish the fields."
        : result.suggestions?.species
          ? "Fish suggestions applied. Review every field and correct anything before saving."
          : "AI analyzed the photo but could not identify the fish. Try a clearer side-profile photo or enter the species manually.")
    } catch (error) {
      console.error(error)
      setAnalysisStatus(error.message || "Photo analysis failed. You can still enter the catch manually.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  function applySuggestions(result, weather) {
    const suggestions = result.suggestions || {}
    const aiNote = [
      suggestions.visibleCharacteristics?.length
        ? `AI observed: ${suggestions.visibleCharacteristics.join(", ")}`
        : "",
      suggestions.reasoning ? `AI note: ${suggestions.reasoning}` : "",
      weather ? formatWeatherNote(weather) : "",
    ].filter(Boolean).join("\n")

    setFormData((current) => ({
      ...current,
      species: current.species || suggestions.species,
      location: current.location || (weather ? weather.placeName || `${weather.latitude}, ${weather.longitude}` : ""),
      fly: current.fly || suggestions.fly,
      water: current.water || suggestions.waterClarity,
      notes: appendUniqueNote(current.notes, aiNote),
    }))
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
          <div className="photoButtonRow">
            <button type="button" className="cameraBtn" onClick={onOpenCamera}>📸 Take Photo</button>
            <button type="button" className="secondaryBtn" onClick={onChoosePhoto}>🖼️ Choose Photo</button>
          </div>
          {selectedPhoto ? (
            <div className="photoPreview">
              <img src={selectedPhoto.previewUrl} alt="Catch preview" />
              <span>{selectedPhoto.name}</span>
            </div>
          ) : (
            <p>Add a photo for optional AI-assisted species and condition suggestions.</p>
          )}
          <button type="button" className="aiAnalyzeBtn" onClick={analyzePhoto} disabled={!selectedPhoto || isAnalyzing}>
            {isAnalyzing ? "Analyzing photo..." : "✨ Analyze Photo + Conditions"}
          </button>
          <small className="aiPrivacyNote">Uses your photo and, with permission, approximate GPS and current weather. Rounded GPS coordinates may be sent to iNaturalist and GBIF to find fish observed nearby. AI suggestions may be wrong.</small>
          <label className="placeLookupConsent">
            <input type="checkbox" checked={allowPlaceLookup} onChange={(event) => {
              setAllowPlaceLookup(event.target.checked)
              if (!event.target.checked) setLocationAttribution(null)
            }} />
            Suggest a nearby park or waterbody by sending GPS coordinates to the configured location service
          </label>
          {locationAttribution && (
            <small className="aiPrivacyNote">Location data: <a href={locationAttribution.attributionUrl} target="_blank" rel="noreferrer">{locationAttribution.attribution}</a></small>
          )}
        </div>

        {analysisStatus && <p className="formMessage fullWidth" role="status">{analysisStatus}</p>}
        {analysis && (
          <div className="aiSuggestionCard fullWidth">
            <div>
              <span className="customBadge">{analysis.provider === "rules" ? "Rules only" : "AI enhanced"}</span>
              <strong>Catch Assistant suggestions</strong>
            </div>
            <p>Species suggestion: {analysis.suggestions?.species || "No species identified"}</p>
            <p>Species confidence: {formatConfidence(analysis.suggestions?.confidence)}</p>
            {analysis.suggestions?.identificationLevel === "candidate" && <p><strong>Best specific candidate:</strong> The vision model returned “{analysis.suggestions.promotedFromGroup}” broadly, so HoodFlyLog selected its first species-level alternative. Please confirm it before saving.</p>}
            {analysis.suggestions?.identificationLevel === "group" && <p><strong>Broad identification only:</strong> The photo did not support a reliable species-level result. Confirm the exact fish before saving.</p>}
            {analysis.suggestions?.alternativeSpecies?.length > 0 && (
              <p>Other possibilities: {analysis.suggestions.alternativeSpecies.map((species, index) => (
                <span key={species}>{index ? ", " : ""}<button type="button" className="speciesSuggestionBtn" onClick={() => updateField("species", species)}>{species}</button></span>
              ))}</p>
            )}
            {analysis.suggestions?.reasoning && <p>Why: {analysis.suggestions.reasoning}</p>}
            {analysis.biodiversitySources?.length > 0 && <p>Nearby records checked: {analysis.biodiversitySources.join(" + ")}</p>}
            {analysis.suggestions?.verificationUrl && <p><a href={analysis.suggestions.verificationUrl} target="_blank" rel="noreferrer">Check this name in FishBase ↗</a></p>}
            <p>All populated fields remain editable. Confirm the species and details before saving.</p>
          </div>
        )}

        <label>Date<input type="date" value={formData.date} onChange={(event) => updateField("date", event.target.value)} /></label>
        <label>Time<input type="time" value={formData.time} onChange={(event) => updateField("time", event.target.value)} /></label>
        <label>Species<input type="text" placeholder="Largemouth Bass, Bluegill..." value={formData.species} onChange={(event) => updateField("species", event.target.value)} /></label>
        <label>Length<input type="text" placeholder='14.5"' value={formData.length} onChange={(event) => updateField("length", event.target.value)} /></label>
        <label>Location<input type="text" placeholder="Crescent Bend Nature Park" value={formData.location} onChange={(event) => updateField("location", event.target.value)} /></label>
        <label>Fly Used<input type="text" placeholder="Olive Woolly Bugger" value={formData.fly} onChange={(event) => updateField("fly", event.target.value)} /></label>
        <label>Rod / Setup<input type="text" placeholder="4wt, floating line, 10 lb mono" value={formData.setup} onChange={(event) => updateField("setup", event.target.value)} /></label>
        <label>Water Conditions<input list="water-clarity-options" type="text" placeholder="Clear, stained, muddy..." value={formData.water} onChange={(event) => updateField("water", event.target.value)} /><datalist id="water-clarity-options"><option value="Clear" /><option value="Stained" /><option value="Muddy" /></datalist></label>
        <label className="fullWidth">Notes<textarea placeholder="What worked, where fish were holding, weather, retrieve speed..." value={formData.notes} onChange={(event) => updateField("notes", event.target.value)} /></label>

        <button type="button" className="secondaryBtn fullWidth" onClick={() => collectGpsWeather()}>
          Use GPS + Weather
        </button>
        {weatherStatus && <p className="formMessage fullWidth">{weatherStatus}</p>}

        <button type="button" className="heroBtn fullWidth" onClick={saveCatch} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Catch"}
        </button>
        {errorMessage && <p className="formMessage fullWidth">{errorMessage}</p>}
      </form>
    </div>
  )
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

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 120000,
    })
  })
}

async function fetchPlaceSuggestion(latitude, longitude) {
  try {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) return null

    const response = await fetch(`/api/location-suggestion?latitude=${latitude}&longitude=${longitude}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}
function formatWeatherNote(weather) {
  return [
    weather.placeName ? `Nearby place: ${weather.placeName}` : "",
    `GPS: ${weather.latitude}, ${weather.longitude}`,
    `Weather: ${weather.temperatureF ?? "?"}F, wind ${weather.windMph ?? "?"} mph, humidity ${weather.humidityPercent ?? "?"}%, pressure ${weather.pressureHpa ?? "?"} hPa`,
  ].filter(Boolean).join("\n")
}

function appendUniqueNote(current, addition) {
  if (!addition || current.includes(addition)) return current
  return current ? `${current}\n\n${addition}` : addition
}

function formatConfidence(value) {
  if (value === null || value === undefined || value === "") return "Not available"
  const number = Number(value)
  if (!Number.isFinite(number)) return "Not available"
  return `${Math.round(Math.max(0, Math.min(1, number)) * 100)}%`
}

async function readApiJson(response) {
  const body = await response.text()
  if (!body.trim()) {
    throw new Error("The Catch Assistant API returned an empty response. Run npm run dev:worker for full local AI testing.")
  }
  try {
    return JSON.parse(body)
  } catch {
    throw new Error("The Catch Assistant API was not available. Run npm run dev:worker instead of npm run dev for full local AI testing.")
  }
}
async function prepareImageForAnalysis(file) {
  if (!file.type.startsWith("image/")) return file
  if (typeof createImageBitmap !== "function") return file

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const maxDimension = 1280
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.82)
  })
}

function usageRecord() {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const stored = JSON.parse(localStorage.getItem("hoodflylog-ai-usage") || "{}")
    return stored.date === today ? stored : { date: today, count: 0 }
  } catch {
    return { date: today, count: 0 }
  }
}

function canUseAiToday() {
  return usageRecord().count < DAILY_AI_LIMIT
}

function recordAiUse() {
  const record = usageRecord()
  localStorage.setItem("hoodflylog-ai-usage", JSON.stringify({ ...record, count: record.count + 1 }))
}

function getConfirmedSpecies() {
  try {
    const values = JSON.parse(localStorage.getItem("hoodflylog-confirmed-species") || "{}")
    return Object.entries(values).sort((left, right) => right[1] - left[1]).slice(0, 12)
      .map(([species, confirmations]) => ({ species, confirmations }))
  } catch {
    return []
  }
}

function recordConfirmedSpecies(confirmedSpecies) {
  const confirmed = confirmedSpecies.trim()
  if (!confirmed) return
  try {
    const values = JSON.parse(localStorage.getItem("hoodflylog-confirmed-species") || "{}")
    values[confirmed] = (Number(values[confirmed]) || 0) + 1
    localStorage.setItem("hoodflylog-confirmed-species", JSON.stringify(values))
  } catch {
    // Identification feedback is optional; catch saving must still succeed.
  }
}
export default LogCatch

