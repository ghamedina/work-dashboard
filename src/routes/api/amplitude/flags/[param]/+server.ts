import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchFlagByKey, patchFlagSegments } from "$lib/api/amplitude";
import type { AmplitudeTargetSegment } from "$lib/types";

export async function GET({ params }) {
  const apiKey = env.AMPLITUDE_MANAGEMENT_KEY;
  if (!apiKey) {
    return json(
      { error: "AMPLITUDE_MANAGEMENT_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const flag = await fetchFlagByKey(params.param, apiKey);
    return json(flag);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch flag";
    return json({ error: message }, { status: 502 });
  }
}

export async function PATCH({ params, request }) {
  const apiKey = env.AMPLITUDE_MANAGEMENT_KEY;
  if (!apiKey) {
    return json(
      { error: "AMPLITUDE_MANAGEMENT_KEY not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    targetSegments: AmplitudeTargetSegment[];
    flagKey: string;
  };

  try {
    await patchFlagSegments(params.param, body.targetSegments, apiKey);

    const updated = await fetchFlagByKey(body.flagKey, apiKey);
    return json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PATCH failed";
    return json({ error: message }, { status: 502 });
  }
}
