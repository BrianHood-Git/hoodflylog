# AI Catch Assistant QA

Use this checklist with the same catch photos when comparing Cloudflare Workers AI and Hugging Face. Never use a photo containing a person, vehicle plate, home address, or other private information.

## Production smoke test

1. Sign in to HoodFlyLog and open **Log Catch**.
2. Choose a clear fish photo.
3. Leave **Suggest a nearby place name** unchecked and select **Analyze Photo + Conditions**.
4. Allow browser location access when prompted.
5. Confirm the assistant suggests species/conditions, keeps the location as coordinates, and does not save automatically.
6. Correct at least one suggested value and verify the edit remains.
7. Save the catch and confirm the edited values appear in Journal.
8. Repeat with the place-name checkbox enabled. Confirm the UI discloses the configured location lookup before GPS is sent, shows provider attribution after lookup, and keeps the suggested place editable.

## Location-provider setup

Create a free Geoapify key and store it with `npx wrangler secret put GEOAPIFY_API_KEY`. The key stays in Cloudflare and enables named park/waterbody suggestions. Without it, the app falls back to BigDataCloud locality results such as city and state.

## Failure and privacy checks

- Decline GPS permission: photo analysis should continue and manual location entry should work.
- Use no photo: Analyze should explain that a photo is required.
- Disconnect the network or exhaust the limit: manual catch entry should remain usable.
- Confirm the model never invents fish length without a visible scale.
- Confirm existing typed fields are not overwritten by analysis.
- Confirm a signed-out request to `/api/analyze-catch` returns `401`.
- Confirm non-moderators still cannot see the Moderation tab.

## Provider comparison

Test at least five representative photos: clear side profile, low light, partial fish, similar species, and a non-fish control. Use identical context for both providers.

| Photo | Provider | Species correct | Useful observations | Unsupported claim | Latency | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Cloudflare Moondream |  |  |  |  |  |
| 1 | Hugging Face model |  |  |  |  |  |

Prefer the provider with fewer unsupported claims and better species accuracy. Latency is secondary for friends-and-family usage. Keep Cloudflare as the default unless Hugging Face shows a clear quality improvement across the same photos.

## Hugging Face comparison setup

Set the Worker variables `AI_PROVIDER=huggingface` and `HF_MODEL=<vision-model>`, then store `HF_TOKEN` as an encrypted Worker secret. Never commit the token. Restore `AI_PROVIDER=workers-ai` after the comparison.
