import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchAllFlags } from "$lib/api/amplitude";
import { getConfig } from "$lib/config";
import type { AmplitudeFlag } from "$lib/types";

interface CachedEntry {
  flags: AmplitudeFlag[];
  time: number;
}

const cache = new Map<string, CachedEntry>();
const CACHE_TTL = 5 * 60 * 1000;

function resolveProjects() {
  const { amplitude } = getConfig();
  return amplitude.projects
    .map((p) => ({ name: p.name, apiKey: env[p.envKey] ?? "" }))
    .filter((p) => p.apiKey.length > 0);
}

export async function GET() {
  const { amplitude } = getConfig();
  const projects = resolveProjects();

  if (projects.length === 0) {
    return json(
      { error: "No amplitude projects configured (check settings.yml and .env)" },
      { status: 500 },
    );
  }

  const now = Date.now();
  const results: AmplitudeFlag[] = [];

  await Promise.all(
    projects.map(async (project) => {
      const cached = cache.get(project.name);
      if (cached && now - cached.time < CACHE_TTL) {
        results.push(...cached.flags);
        return;
      }

      try {
        const flags = await fetchAllFlags(project.apiKey, amplitude.baseUrl);
        for (const flag of flags) {
          (flag as AmplitudeFlag & { projectName: string }).projectName = project.name;
        }
        cache.set(project.name, { flags, time: now });
        results.push(...flags);
      } catch (err) {
        console.error(`Failed to fetch flags for project "${project.name}":`, err);
      }
    })
  );

  return json(results);
}
