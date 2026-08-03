import test from "node:test"
import assert from "node:assert/strict"
import {
  buildPrompt,
  normalizeSuggestions,
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
    fly: "Woolly Bugger",
    waterClarity: "CLEAR",
    visibleCharacteristics: ["dark lateral stripe"],
    reasoning: "Likely, but verify locally.",
  }, { existing: {} })

  assert.deepEqual(value, {
    species: "Largemouth Bass",
    confidence: 1,
    fly: "Woolly Bugger",
    waterClarity: "clear",
    visibleCharacteristics: ["dark lateral stripe"],
    reasoning: "Likely, but verify locally.",
  })
})

test("buildPrompt prohibits unsupported location and length claims", () => {
  const prompt = buildPrompt({ weather: { latitude: 29.4, longitude: -98.5 } })
  assert.match(prompt, /do not estimate fish length/i)
  assert.match(prompt, /Never invent a named location/i)
})

test("rulesFallback preserves entered context without inventing species", () => {
  const result = rulesFallback({ existing: { fly: "Clouser Minnow", water: "stained" } }, "AI unavailable.")
  assert.equal(result.provider, "rules")
  assert.equal(result.suggestions.species, "")
  assert.equal(result.suggestions.fly, "Clouser Minnow")
  assert.equal(result.suggestions.waterClarity, "stained")
})

