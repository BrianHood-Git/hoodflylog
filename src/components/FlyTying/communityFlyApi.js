import { supabase } from "../../supabase"

export const COMMUNITY_IMAGE_BUCKET = "community-fly-pattern-images"

export async function loadCommunityPatterns() {
  const { data, error } = await supabase
    .from("community_fly_patterns")
    .select("*, community_fly_pattern_materials(*), community_fly_pattern_steps(*)")
    .order("updated_at", { ascending: false })
  if (error) throw error

  const patterns = (data || []).map((pattern) => ({
    ...pattern,
    materials: [...(pattern.community_fly_pattern_materials || [])].sort(byPosition),
    steps: [...(pattern.community_fly_pattern_steps || [])].sort(byPosition),
  }))
  await attachSignedImages(patterns)
  return patterns
}

export async function saveCommunityPattern({ form, userId, isModerator }) {
  let patternId = form.id
  const parentChanges = {
    name: form.name.trim(),
    category: form.category.trim() || "Other",
    summary: clean(form.summary),
    best_for: clean(form.best_for),
    fishing_notes: clean(form.fishing_notes),
    video_url: clean(form.video_url),
  }

  if (!patternId) {
    const { data, error } = await supabase
      .from("community_fly_patterns")
      .insert({ ...parentChanges, owner_id: userId, status: "draft" })
      .select()
      .single()
    if (error) throw error
    patternId = data.id
  } else if (isModerator && form.owner_id !== userId) {
    const { error } = await supabase.rpc("moderator_update_community_fly_pattern", {
      target_pattern_id: patternId,
      changes: parentChanges,
    })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from("community_fly_patterns")
      .update(parentChanges)
      .eq("id", patternId)
    if (error) throw error
  }

  const coverPath = await uploadImage(form.cover_file, `${form.owner_id || userId}/${patternId}/cover-${Date.now()}`)
  if (coverPath) {
    if (isModerator && form.owner_id !== userId) {
      const { error } = await supabase.rpc("moderator_update_community_fly_pattern", {
        target_pattern_id: patternId,
        changes: { cover_image_path: coverPath },
      })
      if (error) throw error
    } else {
      const { error } = await supabase.from("community_fly_patterns").update({ cover_image_path: coverPath }).eq("id", patternId)
      if (error) throw error
    }
    if (form.cover_image_path && form.cover_image_path !== coverPath) {
      await removeImagePaths([form.cover_image_path])
    }
  }

  const { error: materialDeleteError } = await supabase.from("community_fly_pattern_materials").delete().eq("pattern_id", patternId)
  if (materialDeleteError) throw materialDeleteError
  const materials = form.materials.filter((item) => item.name.trim()).map((item, index) => ({
    pattern_id: patternId,
    position: index + 1,
    name: item.name.trim(),
    quantity: clean(item.quantity),
    notes: clean(item.notes),
  }))
  if (materials.length) {
    const { error } = await supabase.from("community_fly_pattern_materials").insert(materials)
    if (error) throw error
  }

  const { error: stepDeleteError } = await supabase.from("community_fly_pattern_steps").delete().eq("pattern_id", patternId)
  if (stepDeleteError) throw stepDeleteError
  const steps = []
  for (const [index, step] of form.steps.filter((item) => item.instruction.trim()).entries()) {
    const stepId = step.id || crypto.randomUUID()
    const imagePath = await uploadImage(step.image_file, `${form.owner_id || userId}/${patternId}/steps/${stepId}`)
    steps.push({
      id: stepId,
      pattern_id: patternId,
      position: index + 1,
      instruction: step.instruction.trim(),
      image_path: imagePath || step.image_path || null,
      image_alt_text: clean(step.image_alt_text),
    })
  }
  if (steps.length) {
    const { error } = await supabase.from("community_fly_pattern_steps").insert(steps)
    if (error) throw error
  }
  const activeStepPaths = new Set(steps.map((step) => step.image_path).filter(Boolean))
  await removeImagePaths((form.original_step_image_paths || []).filter((path) => !activeStepPaths.has(path)))
  return patternId
}

export async function submitCommunityPattern(patternId) {
  const { error } = await supabase.rpc("submit_community_fly_pattern", { target_pattern_id: patternId })
  if (error) throw error
}

export async function deleteCommunityDraft(pattern) {
  await removePatternImages(pattern)
  const { error } = await supabase.from("community_fly_patterns").delete().eq("id", pattern.id)
  if (error) throw error
}

export async function moderateCommunityPattern(patternId, decision, reason = null) {
  const { error } = await supabase.rpc("moderate_community_fly_pattern", {
    target_pattern_id: patternId,
    decision,
    moderation_reason: reason,
  })
  if (error) throw error
}

export async function moderatorDeleteCommunityPattern(pattern, reason) {
  await removePatternImages(pattern)
  const { error } = await supabase.rpc("moderator_delete_community_fly_pattern", {
    target_pattern_id: pattern.id,
    deletion_reason: reason || null,
  })
  if (error) throw error
}

async function attachSignedImages(patterns) {
  const paths = [...new Set(patterns.flatMap((pattern) => [
    pattern.cover_image_path,
    ...pattern.steps.map((step) => step.image_path),
  ]).filter(Boolean))]
  if (!paths.length) return
  const { data } = await supabase.storage.from(COMMUNITY_IMAGE_BUCKET).createSignedUrls(paths, 3600)
  const urls = new Map((data || []).map((item) => [item.path, item.signedUrl]))
  patterns.forEach((pattern) => {
    pattern.cover_image_url = urls.get(pattern.cover_image_path) || ""
    pattern.steps = pattern.steps.map((step) => ({ ...step, image_url: urls.get(step.image_path) || "" }))
  })
}

async function uploadImage(file, pathWithoutExtension) {
  if (!file) return ""
  const extension = imageExtension(file)
  const path = `${pathWithoutExtension}.${extension}`
  const { error } = await supabase.storage.from(COMMUNITY_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: true,
  })
  if (error) throw error
  return path
}

async function removePatternImages(pattern) {
  const paths = [pattern.cover_image_path, ...(pattern.steps || []).map((step) => step.image_path)].filter(Boolean)
  await removeImagePaths(paths)
}

async function removeImagePaths(paths) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(COMMUNITY_IMAGE_BUCKET).remove(paths)
  if (error) throw error
}

function imageExtension(file) {
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  return "jpg"
}

function clean(value) {
  return String(value || "").trim() || null
}

function byPosition(left, right) {
  return left.position - right.position
}
