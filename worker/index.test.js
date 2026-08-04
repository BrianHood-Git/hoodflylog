import test from "node:test"
import assert from "node:assert/strict"
import {
  analyzeFlyWithWorkersAi,
  analyzeWithWorkersAi,
  buildPrompt,
  buildFlyPrompt,
  chooseGeoapifySuggestion,
  normalizeSuggestions,
  normalizeFlyIdentification,
  normalizeFlyPatterns,
  getNearbyFishCandidates,
  isModeratorAccount,
  mergeFishCandidates,
  parseModelJson,
  rulesFallback,
} from "./index.js"

test("isModeratorAccount recognizes the protected owner", async () => {
  const request = new Request("https://example.com", { headers: { Authorization: "Bearer token" } })
  assert.equal(await isModeratorAccount(request, { id: "owner", email: "NASSKATER89@GMAIL.COM" }, {}), true)
})

test("isModeratorAccount verifies profile roles through Supabase", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => Response.json([{ role: "moderator" }])
  try {
    const request = new Request("https://example.com", { headers: { Authorization: "Bearer token" } })
    assert.equal(await isModeratorAccount(request, { id: "user-1", email: "mod@example.com" }, {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
    }), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})
test("normalizeFlyIdentification limits generated approximation fields", () => {
  const value = normalizeFlyIdentification({
    isFly: true,
    name: "Woolly Bugger",
    confidence: 1.4,
    category: "Streamer",
    closeMatches: ["Woolly Bugger", "Leech", "Zonker", "Extra"],
    visibleMaterials: ["marabou tail", "hackled body"],
    approximateMaterials: ["hook", "marabou", "chenille"],
    approximateSteps: ["Tie in tail", "Wrap body"],
    fishingTip: "Strip slowly.",
    reasoning: "Marabou tail is visible.",
  })
  assert.equal(value.name, "Woolly Bugger")
  assert.equal(value.confidence, 1)
  assert.deepEqual(value.closeMatches, ["Leech", "Zonker", "Extra"])
  assert.equal(value.recipeStatus, "approximation")
})

test("buildFlyPrompt prohibits claiming exact recipes", () => {
  const prompt = buildFlyPrompt(["Woolly Bugger"])
  assert.match(prompt, /never an exact published recipe/i)
  assert.match(prompt, /Known HoodFlyLog pattern names are weak hints only/i)
  assert.doesNotMatch(prompt, /likely pattern name or descriptive family/i)
})

test("Fly Identifier uses separate vision and structured passes", async () => {
  const requests = []
  const env = { AI: { run: async (model, input) => {
    requests.push({ model, input })
    if (input.image) return { response: "A foam terrestrial with a black foam body, tan wing, and rubber legs; likely Chubby Chernobyl family." }
    return { response: { isFly: true, name: "Chubby Chernobyl", confidence: 0.9 } }
  } } }
  const result = await analyzeFlyWithWorkersAi(new Uint8Array([255, 216, 255]), "image/jpeg", ["Chubby Chernobyl"], env)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].model, "@cf/meta/llama-4-scout-17b-16e-instruct")
  assert.match(requests[0].input.image, /^data:image\/jpeg;base64,/)
  assert.equal(requests[0].input.guided_json, undefined)
  assert.match(requests[1].input.prompt, /foam terrestrial with a black foam body/i)
  assert.equal(requests[1].input.guided_json.type, "object")
  assert.equal(requests[1].input.guided_json.additionalProperties, false)
  assert.deepEqual(JSON.parse(result.text), { isFly: true, name: "Chubby Chernobyl", confidence: 0.9 })
})

test("Fly Identifier adapter serializes structured Cloudflare responses", async () => {
  let call = 0
  const env = { AI: { run: async () => {
    call += 1
    return call === 1
      ? { answer: "Visible foam terrestrial with rubber legs." }
      : { response: { isFly: true, name: "Chubby Chernobyl", confidence: 0.91 } }
  } } }
  const result = await analyzeFlyWithWorkersAi(new Uint8Array([255, 216, 255]), "image/jpeg", [], env)
  assert.deepEqual(JSON.parse(result.text), {
    isFly: true,
    name: "Chubby Chernobyl",
    confidence: 0.91,
  })
})
test("normalizeFlyIdentification rejects copied prompt placeholders", () => {
  assert.throws(() => normalizeFlyIdentification({
    isFly: true,
    name: "likely pattern name or descriptive family",
    confidence: 0.72,
    category: "dry fly, nymph, emerger, streamer, wet fly, terrestrial",
    closeMatches: ["Woolly Bugger", "Clouser Minnow", "Pheasant Tail Nymph"],
    visibleMaterials: ["Wool", "Silk", "Thread"],
    approximateMaterials: ["Wool", "Silk", "Thread"],
    approximateSteps: ["Tie a Woolly Bugger body with silk thread and hair."],
    fishingTip: "One cautious sentence describing visible construction and uncertainty.",
    reasoning: "One short explanation of the visual evidence and uncertainty",
  }), /template text/i)
})
test("normalizeFlyPatterns creates attributed source links and drops blank records", () => {
  const patterns = normalizeFlyPatterns([
    { title: "The Black and Yellow", authorName: "Francis Francis", authorSlug: "francis-francis", bookTitle: "A Book on Angling", bookSlug: "a-book-on-angling", slug: "the-black-and-yellow" },
    { title: "" },
  ])
  assert.deepEqual(patterns, [{
    title: "The Black and Yellow",
    authorName: "Francis Francis",
    bookTitle: "A Book on Angling",
    url: "https://flypattern.org/authors/francis-francis/book/a-book-on-angling/pattern/the-black-and-yellow/",
  }])
})
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
    identificationLevel: "species",
    promotedFromGroup: "",
    verificationUrl: "https://www.fishbase.se/ComNames/CommonNameSearchList.php?CommonName=Largemouth%20Bass",
  }, { existing: {} })

  assert.deepEqual(value, {
    species: "Largemouth Bass",
    confidence: 1,
    alternativeSpecies: ["Bluegill", "Redear Sunfish", "Warmouth"],
    fly: "Woolly Bugger",
    waterClarity: "clear",
    visibleCharacteristics: ["dark lateral stripe"],
    reasoning: "Likely, but verify locally.",
    identificationLevel: "species",
    promotedFromGroup: "",
    verificationUrl: "https://www.fishbase.se/ComNames/CommonNameSearchList.php?CommonName=Largemouth%20Bass",
  })
})

test("normalizeSuggestions keeps missing confidence unavailable", () => {
  const value = normalizeSuggestions({ species: "Sunfish", confidence: null }, { existing: {} })
  assert.equal(value.confidence, null)
  assert.deepEqual(value.alternativeSpecies, [])
})

test("normalizeSuggestions caps broad fish groups at low confidence", () => {
  const value = normalizeSuggestions({ species: "Sunfish", confidence: 0.92 }, { existing: {} })
  assert.equal(value.confidence, 0.45)
  assert.equal(value.identificationLevel, "group")
})

test("normalizeSuggestions promotes a specific black bass alternative over a broad sunfish label", () => {
  const value = normalizeSuggestions({
    species: "sunfish",
    confidence: 0.81,
    alternativeSpecies: ["largemouth bass", "smallmouth bass", "spotted bass"],
  }, { existing: {} })
  assert.equal(value.species, "largemouth bass")
  assert.equal(value.confidence, 0.45)
  assert.equal(value.identificationLevel, "candidate")
  assert.equal(value.promotedFromGroup, "sunfish")
  assert.deepEqual(value.alternativeSpecies, ["sunfish", "smallmouth bass", "spotted bass"])
  assert.doesNotMatch(value.reasoning, /orange-red spots/i)
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

test("multi-source candidate lookup rounds coordinates and normalizes species", async () => {
  const originalFetch = globalThis.fetch
  const requestedUrls = []
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url))
    if (String(url).includes("api.gbif.org")) return Response.json({ results: [] })
    return Response.json({
      results: [{ count: 42, taxon: { preferred_common_name: "Bluegill", name: "Lepomis macrochirus" } }],
    })
  }

  try {
    const result = await getNearbyFishCandidates(
      { weather: { latitude: 29.61234, longitude: -98.34567 } },
      { waitUntil() {} },
    )
    const inaturalistUrl = requestedUrls.find((url) => url.includes("inaturalist"))
    assert.match(inaturalistUrl, /lat=29.61/)
    assert.match(inaturalistUrl, /lng=-98.35/)
    assert.deepEqual(result, { candidates: [{
      commonName: "Bluegill",
      scientificName: "Lepomis macrochirus",
      recordCount: 42,
      sources: ["iNaturalist"],
    }], sources: ["iNaturalist", "GBIF"] })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("mergeFishCandidates favors species supported by multiple databases", () => {
  const candidates = mergeFishCandidates([
    { commonName: "Largemouth Bass", scientificName: "Micropterus salmoides", recordCount: 5, sources: ["iNaturalist"] },
    { commonName: "Largemouth Bass", scientificName: "Micropterus salmoides", recordCount: 1, sources: ["GBIF"] },
    { commonName: "Bluegill", scientificName: "Lepomis macrochirus", recordCount: 20, sources: ["iNaturalist"] },
  ])
  assert.equal(candidates[0].commonName, "Largemouth Bass")
  assert.deepEqual(candidates[0].sources, ["iNaturalist", "GBIF"])
  assert.equal(candidates[0].recordCount, 6)
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
