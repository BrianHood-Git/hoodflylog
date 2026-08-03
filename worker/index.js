const WORKERS_VISION_MODEL = "@cf/moondream/moondream3.1-9B-A2B"
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const DAILY_REQUEST_LIMIT = 10
const DAILY_LOCATION_LIMIT = 50

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url)

    if (url.pathname === "/api/analyze-catch") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405)
      }
      return analyzeCatch(request, env, context)
    }

    if (url.pathname === "/api/location-suggestion") {
      if (request.method !== "GET") {
        return json({ error: "Method not allowed" }, 405)
      }
      return suggestLocation(request, env, context)
    }
    return env.ASSETS.fetch(request)
  },
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
    text: response.answer || response.response || response.description || JSON.stringify(response),
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
  "fly": "fly/lure only if clearly visible, otherwise empty string",
  "waterClarity": "clear, stained, muddy, or empty string",
  "visibleCharacteristics": ["short factual visual observation"],
  "reasoning": "one short explanation including uncertainty"
}
Confidence must be a JSON number from 0 to 1 that reflects actual certainty, or null when no fish is identifiable.
GPS and live weather are context, not visual evidence of species. Never invent a named location from coordinates.
Context: ${JSON.stringify(contextData)}`
}

function normalizeSuggestions(value, contextData) {
  const hasConfidence = value.confidence !== null && value.confidence !== undefined && value.confidence !== ""
  const confidence = hasConfidence ? Number(value.confidence) : Number.NaN
  return {
    species: cleanString(value.species, 80),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    fly: cleanString(value.fly, 100),
    waterClarity: normalizeClarity(value.waterClarity || contextData.existing?.water),
    visibleCharacteristics: Array.isArray(value.visibleCharacteristics)
      ? value.visibleCharacteristics.slice(0, 6).map((item) => cleanString(item, 140)).filter(Boolean)
      : [],
    reasoning: cleanString(value.reasoning, 500),
  }
}

function rulesFallback(contextData, reason) {
  return {
    provider: "rules",
    model: null,
    suggestions: {
      species: "",
      confidence: null,
      fly: contextData.existing?.fly || "",
      waterClarity: normalizeClarity(contextData.existing?.water),
      visibleCharacteristics: [],
      reasoning: `${reason} GPS and weather context can still be reviewed and saved.`,
    },
  }
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
  analyzeWithWorkersAi,
  chooseGeoapifySuggestion,
  buildPrompt,
  normalizeSuggestions,
  parseModelJson,
  rulesFallback,
}

