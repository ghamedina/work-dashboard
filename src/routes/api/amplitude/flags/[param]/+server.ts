import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchFlagByKey, patchFlagSegments } from "$lib/api/amplitude";
import { getConfig } from "$lib/config";
import type { AmplitudeTargetSegment } from "$lib/types";

function resolveProject(projectName: string) {
  const { amplitude } = getConfig();
  const cfg = amplitude.projects.find((p) => p.name === projectName);
  if (!cfg) return null;
  const apiKey = env[cfg.envKey] ?? "";
  return apiKey ? { name: cfg.name, apiKey } : null;
}

export async function GET({ params, url }) {
  const { amplitude } = getConfig();
  const projectName = url.searchParams.get("projectName");
  const project = projectName ? resolveProject(projectName) : null;

  if (!project) {
    return json({ error: "Project not found" }, { status: 400 });
  }

  try {
    const flag = await fetchFlagByKey(params.param, project.apiKey, amplitude.baseUrl);
    return json(flag);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch flag";
    return json({ error: message }, { status: 502 });
  }
}

export async function PATCH({ params, request }) {
  const { amplitude } = getConfig();

  const body = (await request.json()) as {
    targetSegments: AmplitudeTargetSegment[];
    flagKey: string;
    projectName: string;
  };

  const project = resolveProject(body.projectName);
  if (!project) {
    return json({ error: "Project not found" }, { status: 400 });
  }

  try {
    await patchFlagSegments(params.param, body.targetSegments, project.apiKey, amplitude.baseUrl);
    const updated = await fetchFlagByKey(body.flagKey, project.apiKey, amplitude.baseUrl);
    return json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PATCH failed";
    return json({ error: message }, { status: 502 });
  }
}
