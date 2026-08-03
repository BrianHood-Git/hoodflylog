import test from "node:test"
import assert from "node:assert/strict"
import {
  analyzeWithWorkersAi,
  buildPrompt,
  chooseGeoapifySuggestion,
  normalizeSuggestions,
  getNearbyFishCandidates,
  parseModelJson,
  rulesFallback,
} from "./index.js"

test("parseModelJson extracts fenced JSON", () => {
  const value = parseModelJson(`\`\`\`json
{"species":"Bluegill","confidence":0.82}
\`\`\``)
  assert.equal(value.species, "Bluegill")
  assert.equal(value.confidence, 0.82)
})

test("normalizeSuggestions clamps confidence and limits values", () => {
  const value = normalizeSuggestions({
    species: "  Largemouth Bass  ",
    confidence: 2,
    alternativeSpecies: ["Bluegill", "Redear Sunfish", "Bluegill", "Warmouth"],
    fly: "Woolly Bugger",
    waterClarity: "CLEAR",
    visibleCharacteristics: ["dark lateral stripe"],
    reasoning: "Likely, but verify locally.",
  }, { existing: {} })

  assert.deepEqual(value, {
    species: "Largemouth Bass",
    confidence: 1,
    alternativeSpecies: ["Bluegill", "Redear Sunfish", "Warmouth"],
    fly: "Woolly Bugger",
    waterClarity: "clear",
    visibleCharacteristics: ["dark lateral stripe"],
    reasoning: "Likely, but verify locally.",
  })
})

test("normalizeSuggestions keeps missing confidence unavailable", () => {
  const value = normalizeSuggestions({ species: "Sunfish", confidence: null }, { existing: {} })
  assert.equal(value.confidence, null)
  assert.deepEqual(value.alternativeSpecies, [])
})

test("normalizeSuggestions removes redundant alternatives and repeated reasoning", () => {
  const value = normalizeSuggestions({
    species: "Largemouth Bass",
    alternativeSpecies: ["bass", "Sunfish", "sunfish", "Largemouth Bass"],
    reasoning: "Dark lateral stripe is visible. Dark lateral stripe is visible. Mouth shape supports bass. Extra repetition.",
  }, { existing: {} })
  assert.deepEqual(value.alternativeSpecies, ["Sunfish"])
  assert.equal(value.reasoning, "Dark lateral stripe is visible. Mouth shape supports bass.")
})
test("buildPrompt prohibits unsupported location and length claims", () => {
  const prompt = buildPrompt({ weather: { latitude: 29.4, longitude: -98.5 } })
  assert.match(prompt, /do not estimate fish length/i)
  assert.match(prompt, /Never invent a named location/i)
  assert.match(prompt, /Do not leave species blank merely because identification is uncertain/i)
  assert.match(prompt, /location-based shortlist/i)
})

test("rulesFallback preserves entered context without inventing species", () => {
  const result = rulesFallback({ existing: { fly: "Clouser Minnow", water: "stained" } }, "AI unavailable.")
  assert.equal(result.provider, "rules")
  assert.equal(result.suggestions.species, "")
  assert.equal(result.suggestions.fly, "Clouser Minnow")
  assert.equal(result.suggestions.waterClarity, "stained")
})


test("Workers AI adapter sends Moondream query input and reads its answer", async () => {
  let request
  const env = {
    AI: {
      run: async (model, input) => {
        request = { model, input }
        return { answer: '{"species":"Bluegill","confidence":0.75}' }
      },
    },
  }

  const result = await analyzeWithWorkersAi(new Uint8Array([255, 216, 255]), "image/jpeg", { existing: {} }, env)

  assert.equal(request.model, "@cf/moondream/moondream3.1-9B-A2B")
  assert.equal(request.input.task, "query")
  assert.equal(request.input.stream, false)
  assert.match(request.input.image, /^data:image\/jpeg;base64,/)
  assert.match(request.input.question, /Return only valid JSON/)
  assert.equal(result.text, '{"species":"Bluegill","confidence":0.75}')
})

test("iNaturalist candidate lookup rounds coordinates and normalizes species", async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return Response.json({
      results: [{ count: 42, taxon: { preferred_common_name: "Bluegill", name: "Lepomis macrochirus" } }],
    })
  }

  try {
    const candidates = await getNearbyFishCandidates(
      { weather: { latitude: 29.61234, longitude: -98.34567 } },
      { waitUntil() {} },
    )
    assert.match(requestedUrl, /lat=29.61/)
    assert.match(requestedUrl, /lng=-98.35/)
    assert.deepEqual(candidates, [{
      commonName: "Bluegill",
      scientificName: "Lepomis macrochirus",
      observationCount: 42,
    }])
  } finally {
    globalThis.fetch = originalFetch
  }
})
test("Workers AI adapter reads Cloudflare's nested result answer", async () => {
  const env = {
    AI: {
      run: async () => ({ result: { answer: '{"species":"Bass","confidence":0.72}' } }),
    },
  }

  const result = await analyzeWithWorkersAi(new Uint8Array([255, 216, 255]), "image/jpeg", { existing: {} }, env)
  assert.equal(result.text, '{"species":"Bass","confidence":0.72}')
})
test("Geoapify selector prefers the nearest named park or water feature", () => {
  const value = chooseGeoapifySuggestion({
    features: [
      { properties: { name: "Far Park", city: "Schertz", state: "Texas", distance: 350, categories: ["leisure.park"] } },
      { properties: { name: "Crescent Bend Nature Park", city: "Schertz", state: "Texas", distance: 0, categories: ["leisure.park.nature_reserve"] } },
      { properties: { city: "Schertz", distance: 0 } },
    ],
  })

  assert.equal(value.placeName, "Crescent Bend Nature Park, Schertz, Texas")
  assert.equal(value.distanceMeters, 0)
  assert.equal(value.source, "geoapify")
})
