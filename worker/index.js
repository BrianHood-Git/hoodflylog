const WORKERS_VISION_MODEL = "@cf/moondream/moondream3.1-9B-A2B"
const FLY_VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct"
const OWNER_EMAIL = "nasskater89@gmail.com"
const FLY_IDENTIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isFly", "name", "confidence", "category", "closeMatches", "visibleMaterials", "approximateMaterials", "approximateSteps", "fishingTip", "reasoning"],
  properties: {
    isFly: { type: "boolean" },
    name: { type: "string", description: "Likely established pattern name or a descriptive fly family when uncertain." },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    category: { type: "string" },
    closeMatches: { type: "array", maxItems: 3, items: { type: "string" } },
    visibleMaterials: { type: "array", maxItems: 8, items: { type: "string" } },
    approximateMaterials: { type: "array", maxItems: 12, items: { type: "string" } },
    approximateSteps: { type: "array", maxItems: 6, items: { type: "string" } },
    fishingTip: { type: "string" },
    reasoning: { type: "string" },
  },
}
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const DAILY_REQUEST_LIMIT = 10
const DAILY_LOCATION_LIMIT = 50
const INATURALIST_RADIUS_KM = 75
const INATURALIST_CANDIDATE_LIMIT = 15
const GBIF_RADIUS_KM = 75
const GBIF_CANDIDATE_LIMIT = 100
const GENERIC_FISH_GROUPS = new Set(["bass", "black bass", "sunfish", "bream", "panfish", "fish", "trout", "catfish"])

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url)

    if (url.pathname === "/api/analyze-catch") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405)
      }
      return analyzeCatch(request, env, context)
    }

    if (url.pathname === "/api/analyze-fly") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405)
      return analyzeFly(request, env, context)
    }

    if (url.pathname === "/api/location-suggestion") {
      if (request.method !== "GET") {
        return json({ error: "Method not allowed" }, 405)
      }
      return suggestLocation(request, env, context)
    }
    if (url.pathname === "/api/fly-patterns") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405)
      return getFlyPatterns(context)
    }
    return env.ASSETS.fetch(request)
  },
}

async function getFlyPatterns(context) {
  const cacheKey = new Request("https://fly-patterns.internal/flypattern-org/v1")
  const cache = globalThis.caches?.default
  const cached = cache ? await cache.match(cacheKey) : null
  if (cached) return cached

  try {
    const response = await fetch("https://flypattern.org/data/patterns.json", {
      headers: { "User-Agent": "HoodFlyLog/1.0 (classic fly lookup)" },
    })
    if (!response.ok) throw new Error(`FlyPattern.org lookup failed (${response.status}).`)
    const patterns = normalizeFlyPatterns(await response.json())
    const result = Response.json({ patterns, source: "FlyPattern.org", license: "CC BY-NC-SA 4.0" }, {
      headers: { "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
    })
    if (cache) context.waitUntil(cache.put(cacheKey, result.clone()))
    return result
  } catch (error) {
    console.error("Classic fly-pattern lookup failed", error)
    return json({ patterns: [], error: "Classic patterns are temporarily unavailable." }, 200)
  }
}

function normalizeFlyPatterns(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 2500).map((pattern) => {
    const authorSlug = cleanString(pattern?.authorSlug, 100)
    const bookSlug = cleanString(pattern?.bookSlug, 140)
    const slug = cleanString(pattern?.slug, 180)
    return {
      title: cleanString(pattern?.title, 160),
      authorName: cleanString(pattern?.authorName, 120),
      bookTitle: cleanString(pattern?.bookTitle, 180),
      url: authorSlug && bookSlug && slug
        ? `https://flypattern.org/authors/${authorSlug}/book/${bookSlug}/pattern/${slug}/`
        : "https://flypattern.org/search/",
    }
  }).filter((pattern) => pattern.title)
}
async function suggestLocation(request, env, context) {
  const user = await authenticateUser(request, env)
  if (!user) return json({ error: "Sign in before requesting a location suggestion." }, 401)

  const url = new URL(request.url)
  const latitude = Number(url.searchParams.get("latitude"))
  const longitude = Number(url.searchParams.get("longitude"))
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json({ error: "Valid latitude and longitude are required." }, 400)
  }

  const configuredProvider = env.GEOAPIFY_API_KEY ? "geoapify" : "bigdatacloud"
  const cacheKey = new Request(`https://location-cache.internal/${configuredProvider}/${latitude.toFixed(4)}/${longitude.toFixed(4)}`)
  const cache = globalThis.caches?.default
  const cached = cache ? await cache.match(cacheKey) : null
  if (cached) return json(await cached.json())

  const rateLimit = await consumeDailyLimit(user.id, "location-suggestion", DAILY_LOCATION_LIMIT, context)
  if (!rateLimit.allowed) {
    return json({ error: `Daily location-suggestion limit reached (${DAILY_LOCATION_LIMIT}).` }, 429)
  }

  let suggestion = null
  if (env.GEOAPIFY_API_KEY) {
    try {
      suggestion = await suggestWithGeoapify(latitude, longitude, env.GEOAPIFY_API_KEY)
    } catch (error) {
      console.error("Geoapify location lookup failed", error)
    }
  }

  if (!suggestion) {
    try {
      suggestion = await suggestWithBigDataCloud(latitude, longitude)
    } catch (error) {
      console.error("BigDataCloud location fallback failed", error)
    }
  }

  const payload = suggestion || {
    placeName: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    source: "coordinates",
    attribution: "",
    attributionUrl: "",
  }

  if (cache) {
    context.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(payload), {
      headers: {
        "Cache-Control": `public, max-age=${payload.source === "geoapify" ? 2592000 : 86400}`,
        "Content-Type": "application/json",
      },
    })))
  }

  return json(payload)
}

async function suggestWithGeoapify(latitude, longitude, apiKey) {
  const params = new URLSearchParams({
    categories: "leisure.park,leisure.park.nature_reserve,natural.water,natural.protected_area,waterway",
    filter: `circle:${longitude},${latitude},2000`,
    bias: `proximity:${longitude},${latitude}`,
    limit: "10",
    apiKey,
  })
  const response = await fetch(`https://api.geoapify.com/v2/places?${params}`)
  if (!response.ok) throw new Error(`Geoapify lookup failed (${response.status}).`)
  return chooseGeoapifySuggestion(await response.json())
}

function chooseGeoapifySuggestion(payload) {
  const candidates = (payload?.features || [])
    .map((feature) => feature?.properties || {})
    .filter((properties) => cleanString(properties.name, 120))
    .sort((left, right) => {
      const leftDistance = Number(left.distance)
      const rightDistance = Number(right.distance)
      return (Number.isFinite(leftDistance) ? leftDistance : Number.MAX_SAFE_INTEGER)
        - (Number.isFinite(rightDistance) ? rightDistance : Number.MAX_SAFE_INTEGER)
    })

  const place = candidates[0]
  if (!place) return null
  return {
    placeName: uniqueLocationParts([place.name, place.city, place.state]),
    source: "geoapify",
    featureType: Array.isArray(place.categories) ? place.categories[0] || "" : "",
    distanceMeters: Number.isFinite(Number(place.distance)) ? Math.round(Number(place.distance)) : null,
    attribution: "Powered by Geoapify; data © OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  }
}

async function suggestWithBigDataCloud(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "en",
  })
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`)
  if (!response.ok) throw new Error(`BigDataCloud lookup failed (${response.status}).`)
  const place = await response.json()
  const locality = place.locality || place.city || place.localityInfo?.administrative?.[0]?.name || ""
  const placeName = uniqueLocationParts([locality, place.principalSubdivision, place.countryName])
  if (!placeName) return null
  return {
    placeName,
    source: "bigdatacloud",
    featureType: "locality",
    distanceMeters: null,
    attribution: "Location by BigDataCloud",
    attributionUrl: "https://www.bigdatacloud.com/",
  }
}

function uniqueLocationParts(parts) {
  return [...new Set(parts.map((part) => cleanString(part, 120)).filter(Boolean))].join(", ")
}
async function analyzeCatch(request, env, context) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: "Sign in before using the Catch Assistant." }, 401)

    const rateLimit = await consumeDailyRequest(user.id, env, context)
    if (!rateLimit.allowed) {
      return json({ error: `Daily Catch Assistant limit reached (${DAILY_REQUEST_LIMIT}).` }, 429)
    }

    const form = await request.formData()
    const photo = form.get("photo")
    if (!(photo instanceof File)) return json({ error: "A catch photo is required." }, 400)
    if (!photo.type.startsWith("image/")) return json({ error: "The uploaded file must be an image." }, 400)
    if (photo.size > MAX_IMAGE_BYTES) return json({ error: "Photo must be smaller than 5 MB." }, 413)

    const contextData = parseContext(form.get("context"))
    const nearbyLookup = await getNearbyFishCandidates(contextData, context)
    contextData.nearbySpecies = nearbyLookup.candidates
    const bytes = new Uint8Array(await photo.arrayBuffer())
    const provider = (env.AI_PROVIDER || "workers-ai").toLowerCase()

    let result
    try {
      if (provider === "huggingface") {
        result = await analyzeWithHuggingFace(bytes, photo.type, contextData, env)
      } else if (env.AI) {
        result = await analyzeWithWorkersAi(bytes, photo.type, contextData, env)
      } else {
        return json({ ...rulesFallback(contextData, "Workers AI is not configured."), remainingToday: rateLimit.remaining }, 200)
      }

      return json({
        provider,
        model: result.model,
        suggestions: normalizeSuggestions(parseModelJson(result.text), contextData),
        biodiversitySources: nearbyLookup.sources,
        remainingToday: rateLimit.remaining,
      })
    } catch (providerError) {
      console.error("Vision provider unavailable", providerError)
      return json({
        ...rulesFallback(contextData, safeErrorMessage(providerError)),
        remainingToday: rateLimit.remaining,
      }, 200)
    }
  } catch (error) {
    console.error("Catch analysis failed", error)
    return json({ error: safeErrorMessage(error) }, 500)
  }
}

async function analyzeFly(request, env, context) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: "Sign in before using Fly Identifier." }, 401)
    const moderator = await isModeratorAccount(request, user, env)
    const rateLimit = moderator
      ? { allowed: true, remaining: null }
      : await consumeDailyLimit(user.id, "fly-identifier", DAILY_REQUEST_LIMIT, context)
    if (!rateLimit.allowed) return json({ error: `Daily Fly Identifier limit reached (${DAILY_REQUEST_LIMIT}).` }, 429)

    const form = await request.formData()
    const photo = form.get("photo")
    if (!(photo instanceof File)) return json({ error: "A fly photo is required." }, 400)
    if (!photo.type.startsWith("image/")) return json({ error: "The uploaded file must be an image." }, 400)
    if (photo.size > MAX_IMAGE_BYTES) return json({ error: "Photo must be smaller than 5 MB." }, 413)
    if (!env.AI) return json({ error: "Workers AI is not configured." }, 503)

    const bytes = new Uint8Array(await photo.arrayBuffer())
    const knownPatterns = parseKnownPatterns(form.get("knownPatterns"))
    const result = await analyzeFlyWithWorkersAi(bytes, photo.type, knownPatterns, env)
    return json({
      provider: "workers-ai",
      model: result.model,
      suggestions: normalizeFlyIdentification(parseModelJson(result.text)),
      remainingToday: rateLimit.remaining,
      unlimited: moderator,
    })
  } catch (error) {
    console.error("Fly identification failed", error)
    return json({ error: safeErrorMessage(error) }, 500)
  }
}

async function analyzeFlyWithWorkersAi(bytes, mimeType, knownPatterns, env) {
  const visionResponse = await env.AI.run(FLY_VISION_MODEL, {
    prompt: buildFlyVisionPrompt(),
    image: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
    stream: false,
    max_tokens: 450,
    temperature: 0.1,
  })
  const visualReport = extractAiText(visionResponse)
  if (!visualReport.trim()) throw new Error("The vision model returned an empty visual report.")

  const response = await env.AI.run(FLY_VISION_MODEL, {
    prompt: `${buildFlyPrompt(knownPatterns)}\nVisual report from the image model:\n${visualReport.slice(0, 4000)}`,
    guided_json: FLY_IDENTIFICATION_SCHEMA,
    stream: false,
    max_tokens: 700,
    temperature: 0.1,
  })
  const output = response.response ?? response.answer ?? response.result?.response ?? response.result?.answer ?? response
  return {
    model: FLY_VISION_MODEL,
    text: typeof output === "string" ? output : JSON.stringify(output),
  }
}

function buildFlyVisionPrompt() {
  return `Inspect this fishing-hook image without assuming it is a fly or any particular pattern. Classify the construction before naming it. Choose the best broad class from: dry fly, nymph, wet fly, streamer, popper, slider, mouse or frog, foam terrestrial, jig, spoon, spinner, hard-bodied lure, or unknown.
Describe only visible evidence: number and placement of hooks, hook profile, whether the body is tied fibers/dubbing versus molded plastic/painted metal, reflective or rigid surfaces, cupped popper face, foam, bead or weight, tail, body, rib, thorax, hackle, wing, rubber legs, colors, and proportions. Explicitly state important absent features. Do not call something a foam terrestrial unless foam plus terrestrial-style legs or wing are actually visible. A painted or molded head, cupped face, metal spoon body, feathered lure tail, or hard body must be classified accordingly. Only after the broad class is established may you suggest up to three compatible names. Do not output JSON and do not provide tying instructions.`
}

function extractAiText(response) {
  const output = response?.response ?? response?.answer ?? response?.result?.response ?? response?.result?.answer ?? response
  return typeof output === "string" ? output : JSON.stringify(output ?? "")
}

function buildFlyPrompt(knownPatterns = []) {
  return `Identify the tied fishing fly described in the supplied visual report. Use only the report's visible evidence: hook shape, bead or weight, tail, body, rib, thorax, hackle, wing, legs, color, profile, and proportions.
Return the requested structured fields with actual observations from the visual report. Preserve its broad construction class; do not replace a popper, streamer, jig, spoon, spinner, or hard-bodied lure with a terrestrial pattern. Never repeat field descriptions or instructions as answers. If the exact pattern is uncertain, use a descriptive compatible family as the name and put plausible established patterns in closeMatches. Never claim an exact commercial or proprietary pattern without strong visual evidence. Suggested materials and steps are an approximate tie based only on visible construction, never an exact published recipe.
Set isFly false, confidence 0, and text/list fields empty when no tied fishing fly is clearly visible. Known HoodFlyLog pattern names are weak hints only and must not override the visual report: ${JSON.stringify(knownPatterns)}`
}
function normalizeFlyIdentification(value) {
  if (containsFlyPromptPlaceholder(value)) {
    throw new Error("The vision model returned template text instead of an identification. Try a closer side-profile photo.")
  }
  const isFly = value?.isFly === true
  const name = isFly ? cleanString(value.name, 100) : ""
  const confidence = Number(value?.confidence)
  return {
    isFly,
    name,
    confidence: isFly && value?.confidence !== null && Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    category: isFly ? cleanString(value.category, 50) : "",
    closeMatches: normalizeStringList(value.closeMatches, 3, 100, name),
    visibleMaterials: normalizeStringList(value.visibleMaterials, 8, 140),
    approximateMaterials: normalizeStringList(value.approximateMaterials, 12, 100),
    approximateSteps: normalizeStringList(value.approximateSteps, 6, 180),
    fishingTip: isFly ? cleanString(value.fishingTip, 240) : "",
    reasoning: isFly ? cleanReasoning(value.reasoning) : "",
    recipeStatus: "approximation",
  }
}

function containsFlyPromptPlaceholder(value) {
  const text = JSON.stringify(value || {}).toLowerCase()
  return [
    "likely pattern name or descriptive family",
    "one cautious sentence",
    "one short explanation of the visual evidence",
    "up to three plausible pattern names",
    "suggested material",
    "dry fly, nymph, emerger, streamer",
  ].some((placeholder) => text.includes(placeholder))
}
function normalizeStringList(value, limit, maxLength, excluded = "") {
  if (!Array.isArray(value)) return []
  const seen = new Set(excluded ? [excluded.toLowerCase()] : [])
  return value.map((item) => cleanString(item, maxLength)).filter((item) => {
    const key = item.toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, limit)
}

function parseKnownPatterns(raw) {
  if (typeof raw !== "string") return []
  try {
    return normalizeStringList(JSON.parse(raw), 40, 100)
  } catch {
    return []
  }
}
async function analyzeWithWorkersAi(bytes, mimeType, contextData, env) {
  const response = await env.AI.run(WORKERS_VISION_MODEL, {
    task: "query",
    image: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
    question: buildPrompt(contextData),
    reasoning: false,
    stream: false,
    max_tokens: 500,
    temperature: 0.2,
  })

  return {
    model: WORKERS_VISION_MODEL,
    text: response.answer
      || response.result?.answer
      || response.response
      || response.description
      || JSON.stringify(response),
  }
}

async function analyzeWithHuggingFace(bytes, mimeType, contextData, env) {
  if (!env.HF_TOKEN || !env.HF_MODEL) {
    throw new Error("Hugging Face provider requires HF_TOKEN and HF_MODEL.")
  }

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.HF_MODEL,
      temperature: 0.2,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: buildPrompt(contextData) },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${bytesToBase64(bytes)}` } },
        ],
      }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Hugging Face analysis failed (${response.status}).`)
  }

  const payload = await response.json()
  return {
    model: env.HF_MODEL,
    text: payload.choices?.[0]?.message?.content || "",
  }
}

function buildPrompt(contextData) {
  return `Analyze this fishing catch photo as a fish-identification assistant. First determine whether a fish is visible. If a fish is visible, make the best cautious common-species identification from body shape, mouth, fins, coloration, and markings. Do not leave species blank merely because identification is uncertain; use a broader common group such as "sunfish" or "bass" when that is the most defensible identification. Leave species blank only when no fish is visible or the image provides no usable fish characteristics.
Do not claim certainty and do not estimate fish length without a visible scale reference.
Return only valid JSON with this exact shape:
{
  "species": "likely common name or empty string",
  "confidence": 0.72,
  "alternativeSpecies": ["up to three other plausible common names"],
  "fly": "fly/lure only if clearly visible, otherwise empty string",
  "waterClarity": "clear, stained, muddy, or empty string",
  "visibleCharacteristics": ["short factual visual observation"],
  "reasoning": "one short explanation including uncertainty"
}
Confidence must be a JSON number from 0 to 1 that reflects actual certainty, or null when no fish is identifiable.
GPS and live weather are context, not visual evidence of species. Never invent a named location from coordinates.
Taxonomy warning: largemouth bass, smallmouth bass, spotted bass, and other black bass belong to the sunfish family Centrarchidae. Do not label a black bass as "sunfish" merely because that family is correct. Distinguish black bass from Lepomis sunfish using mouth size, body proportions, dorsal fin shape, and markings. Prefer a species-level common name only when visible traits support it. If only a family or broad group is defensible, use that group and keep confidence at or below 0.45.
When nearbySpecies is present, it is a merged iNaturalist and GBIF location-based shortlist. Each candidate includes its supporting sources and nearby record count. Compare the visible fish against those candidates, but choose a species outside the list when the visual evidence supports it. Do not identify a fish solely because it is common nearby.
When confirmedSpecies is present, it contains species this user previously confirmed or corrected. Treat it as a weak personal-history hint only; visible characteristics must still support the identification.
Context: ${JSON.stringify(contextData)}`
}

function normalizeSuggestions(value, contextData) {
  const rawSpecies = cleanString(value.species, 80)
  const rawAlternatives = Array.isArray(value.alternativeSpecies)
    ? value.alternativeSpecies.map((item) => cleanString(item, 80)).filter(Boolean)
    : []
  const promotedSpecies = GENERIC_FISH_GROUPS.has(rawSpecies.toLowerCase())
    ? rawAlternatives.find((item) => !GENERIC_FISH_GROUPS.has(item.toLowerCase())) || ""
    : ""
  const species = promotedSpecies || rawSpecies
  const hasConfidence = value.confidence !== null && value.confidence !== undefined && value.confidence !== ""
  const confidence = hasConfidence ? Number(value.confidence) : Number.NaN
  return {
    species,
    confidence: Number.isFinite(confidence)
      ? Math.max(0, Math.min(promotedSpecies || GENERIC_FISH_GROUPS.has(species.toLowerCase()) ? 0.45 : 1, confidence))
      : null,
    alternativeSpecies: normalizeAlternativeSpecies(promotedSpecies ? [rawSpecies, ...rawAlternatives] : rawAlternatives, species),
    fly: cleanString(value.fly, 100),
    waterClarity: normalizeClarity(value.waterClarity || contextData.existing?.water),
    visibleCharacteristics: Array.isArray(value.visibleCharacteristics)
      ? value.visibleCharacteristics.slice(0, 6).map((item) => cleanString(item, 140)).filter(Boolean)
      : [],
    reasoning: promotedSpecies
      ? `The vision model returned the broad group “${rawSpecies}” but ranked ${promotedSpecies} as its best species-level candidate. Confirm using the fish's mouth, body shape, fins, and markings.`
      : cleanReasoning(value.reasoning),
    identificationLevel: promotedSpecies ? "candidate" : GENERIC_FISH_GROUPS.has(species.toLowerCase()) ? "group" : species ? "species" : "unknown",
    promotedFromGroup: promotedSpecies ? rawSpecies : "",
    verificationUrl: species ? `https://www.fishbase.se/ComNames/CommonNameSearchList.php?CommonName=${encodeURIComponent(species)}` : "",
  }
}
function normalizeAlternativeSpecies(value, primarySpecies) {
  if (!Array.isArray(value)) return []
  const primary = primarySpecies.toLowerCase()
  const seen = new Set()
  return value.map((item) => cleanString(item, 80)).filter((item) => {
    const normalized = item.toLowerCase()
    if (!normalized || seen.has(normalized) || primary.includes(normalized) || normalized.includes(primary)) return false
    seen.add(normalized)
    return true
  }).slice(0, 3)
}

function cleanReasoning(value) {
  const reasoning = cleanString(value, 800)
  if (!reasoning) return ""
  const seen = new Set()
  return reasoning.split(/(?<=[.!?])\s+/).filter((sentence) => {
    const normalized = sentence.toLowerCase().replace(/\W+/g, " ").trim()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  }).slice(0, 2).join(" ").slice(0, 360)
}
function rulesFallback(contextData, reason) {
  return {
    provider: "rules",
    model: null,
    suggestions: {
      species: "",
      confidence: null,
      alternativeSpecies: [],
      fly: contextData.existing?.fly || "",
      waterClarity: normalizeClarity(contextData.existing?.water),
      visibleCharacteristics: [],
      reasoning: `${reason} GPS and weather context can still be reviewed and saved.`,
    },
  }
}

async function getNearbyFishCandidates(contextData, context) {
  const latitude = Number(contextData.weather?.latitude)
  const longitude = Number(contextData.weather?.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { candidates: [], sources: [] }

  const roundedLatitude = Number(latitude.toFixed(2))
  const roundedLongitude = Number(longitude.toFixed(2))
  const cacheKey = new Request(`https://fish-candidates.internal/multisource-v1/${roundedLatitude}/${roundedLongitude}`)
  const cache = globalThis.caches?.default
  const cached = cache ? await cache.match(cacheKey) : null
  if (cached) return cached.json()

  const lookups = await Promise.allSettled([
    getINaturalistCandidates(roundedLatitude, roundedLongitude),
    getGbifCandidates(roundedLatitude, roundedLongitude),
  ])
  const candidates = mergeFishCandidates(lookups.flatMap((result) => result.status === "fulfilled" ? result.value : []))
  const sources = []
  if (lookups[0].status === "fulfilled") sources.push("iNaturalist")
  else console.error("iNaturalist nearby-species lookup failed", lookups[0].reason)
  if (lookups[1].status === "fulfilled") sources.push("GBIF")
  else console.error("GBIF nearby-species lookup failed", lookups[1].reason)
  const payload = { candidates, sources }

  if (cache && sources.length) {
    context.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(payload), {
      headers: { "Cache-Control": "public, max-age=604800", "Content-Type": "application/json" },
    })))
  }
  return payload
}

async function getINaturalistCandidates(latitude, longitude) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(INATURALIST_RADIUS_KM),
    iconic_taxa: "Actinopterygii",
    quality_grade: "research",
    rank: "species",
    per_page: String(INATURALIST_CANDIDATE_LIMIT),
    locale: "en",
  })
  const response = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?${params}`, {
    headers: { "User-Agent": "HoodFlyLog/1.0 (nearby fish suggestions)" },
  })
  if (!response.ok) throw new Error(`iNaturalist lookup failed (${response.status}).`)
  const payload = await response.json()
  return (payload?.results || []).map((entry) => ({
    commonName: cleanString(entry?.taxon?.preferred_common_name, 80),
    scientificName: cleanString(entry?.taxon?.name, 100),
    recordCount: Math.max(0, Number(entry?.count) || 0),
    sources: ["iNaturalist"],
  })).filter((candidate) => candidate.commonName || candidate.scientificName)
}

async function getGbifCandidates(latitude, longitude) {
  const radiusDegrees = GBIF_RADIUS_KM / 111
  const params = new URLSearchParams({
    decimalLatitude: `${Math.max(-90, latitude - radiusDegrees)},${Math.min(90, latitude + radiusDegrees)}`,
    decimalLongitude: `${Math.max(-180, longitude - radiusDegrees)},${Math.min(180, longitude + radiusDegrees)}`,
    classKey: "204",
    hasCoordinate: "true",
    limit: String(GBIF_CANDIDATE_LIMIT),
  })
  const response = await fetch(`https://api.gbif.org/v1/occurrence/search?${params}`, {
    headers: { "User-Agent": "HoodFlyLog/1.0 (nearby fish suggestions)" },
  })
  if (!response.ok) throw new Error(`GBIF lookup failed (${response.status}).`)
  const payload = await response.json()
  return (payload?.results || []).map((entry) => ({
    commonName: cleanString(entry?.vernacularName, 80),
    scientificName: cleanString(entry?.species || entry?.scientificName, 100),
    recordCount: 1,
    sources: ["GBIF"],
  })).filter((candidate) => candidate.commonName || candidate.scientificName)
}

function mergeFishCandidates(candidates) {
  const merged = new Map()
  for (const candidate of candidates) {
    const key = (candidate.scientificName || candidate.commonName).toLowerCase()
    if (!key) continue
    const current = merged.get(key) || { ...candidate, recordCount: 0, sources: [] }
    current.commonName ||= candidate.commonName
    current.scientificName ||= candidate.scientificName
    current.recordCount += Math.max(0, Number(candidate.recordCount) || 0)
    current.sources = [...new Set([...current.sources, ...(candidate.sources || [])])]
    merged.set(key, current)
  }
  return [...merged.values()]
    .sort((left, right) => right.sources.length - left.sources.length || right.recordCount - left.recordCount)
    .slice(0, INATURALIST_CANDIDATE_LIMIT)
}
async function authenticateUser(request, env) {
  const authorization = request.headers.get("Authorization")
  if (!authorization?.startsWith("Bearer ") || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: env.SUPABASE_ANON_KEY,
    },
  })
  if (!response.ok) return null
  return response.json()
}

async function isModeratorAccount(request, user, env) {
  if (String(user?.email || "").toLowerCase() === OWNER_EMAIL) return true
  const authorization = request.headers.get("Authorization")
  if (!authorization || !user?.id) return false
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, {
      headers: {
        Authorization: authorization,
        apikey: env.SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
    })
    if (!response.ok) return false
    const profiles = await response.json()
    return profiles?.[0]?.role === "moderator"
  } catch (error) {
    console.error("Moderator role lookup failed", error)
    return false
  }
}
async function consumeDailyRequest(userId, env, context) {
  return consumeDailyLimit(userId, "catch-assistant", DAILY_REQUEST_LIMIT, context)
}

async function consumeDailyLimit(userId, bucket, limit, context) {
  if (!globalThis.caches?.default) return { allowed: true, remaining: limit - 1 }

  const date = new Date().toISOString().slice(0, 10)
  const userHash = await sha256(userId)
  const key = new Request(`https://rate-limit.internal/${bucket}/${date}/${userHash}`)
  const cached = await caches.default.match(key)
  const used = cached ? Number(await cached.text()) || 0 : 0
  if (used >= limit) return { allowed: false, remaining: 0 }

  const secondsUntilTomorrow = Math.max(60, Math.floor((Date.parse(`${date}T23:59:59Z`) - Date.now()) / 1000))
  context.waitUntil(caches.default.put(key, new Response(String(used + 1), {
    headers: { "Cache-Control": `max-age=${secondsUntilTomorrow}` },
  })))

  return { allowed: true, remaining: limit - used - 1 }
}
function parseContext(raw) {
  if (typeof raw !== "string") return {}
  try {
    const parsed = JSON.parse(raw)
    return {
      weather: parsed.weather || null,
      existing: parsed.existing || {},
      confirmedSpecies: Array.isArray(parsed.confirmedSpecies) ? parsed.confirmedSpecies.slice(0, 12) : [],
    }
  } catch {
    return {}
  }
}

function parseModelJson(text) {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("The vision model did not return usable suggestions.")
  return JSON.parse(cleaned.slice(start, end + 1))
}

function normalizeClarity(value) {
  const clarity = cleanString(value, 30).toLowerCase()
  return ["clear", "stained", "muddy"].includes(clarity) ? clarity : ""
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function bytesToBase64(bytes) {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Catch analysis failed."
  return message.slice(0, 240)
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export {
  analyzeFlyWithWorkersAi,
  analyzeWithWorkersAi,
  chooseGeoapifySuggestion,
  buildPrompt,
  buildFlyPrompt,
  normalizeSuggestions,
  normalizeFlyIdentification,
  getNearbyFishCandidates,
  getGbifCandidates,
  isModeratorAccount,
  mergeFishCandidates,
  normalizeFlyPatterns,
  parseModelJson,
  rulesFallback,
}

