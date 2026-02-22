# Amplitude API Learnings

## Authentication

- **Key type:** Amplitude Management API key (prefix `ampex_`)
- **Header:** `Authorization: Bearer <key>`
- **No OAuth required** — API key auth works for the Management API
- The MCP server uses OAuth, but the REST API accepts the management key directly
- Key is stored in `.env` as `AMPLITUIDE_MANAGEMENT_KEY` (note typo in var name)

## Base URLs

| API | Base URL |
|-----|----------|
| Experiment Management (flags, experiments) | `https://experiment.amplitude.com/api/1/` |

## Feature Flags

### Endpoint
```
GET https://experiment.amplitude.com/api/1/flags
```

### Query Parameters
| Param | Description |
|-------|-------------|
| `limit` | Max flags to return. Capped at 1000 |
| `cursor` | Pagination cursor (value from `nextCursor` in prior response) |
| `key` | Filter by flag key |
| `projectId` | Filter by project ID |
| `includeArchived` | Include archived flags (default: false) |

### Response Shape
```json
{
  "flags": [
    {
      "id": "848345",
      "projectId": "217854",
      "key": "flag-key",
      "name": "flag-name",
      "description": "...",
      "enabled": true,
      "evaluationMode": "remote",
      "bucketingKey": "amplitude_id",
      "bucketingUnit": "User",
      "variants": [{ "key": "variant-key", "name": "variant-name" }],
      "rolloutPercentage": 0,
      "rolloutWeights": {},
      "targetSegments": [],
      "tags": ["squad:some-team"],
      "createdBy": "user@housecallpro.com",
      "lastModifiedBy": "user@housecallpro.com",
      "createdAt": "2026-02-20T23:49:54.927Z",
      "lastModifiedAt": "2026-02-20T23:57:57.927Z",
      "deleted": false
    }
  ],
  "nextCursor": "26397"
}
```

### Pagination
- When `nextCursor` is present in the response, pass it as `?cursor=<value>` in the next request
- No `nextCursor` (or empty string) means you're on the last page

### Filtering by Prefix

The `key` parameter is **exact-match only** — `?key=reporting` returns 0 results, `?key=reporting-quick-views` returns 1.

There is no native prefix/substring search. To find flags by prefix, fetch all pages and filter client-side:

```javascript
const https = require('https');

async function fetchAllFlags(managementKey) {
  const allFlags = [];
  let cursor = null;
  do {
    const url = 'https://experiment.amplitude.com/api/1/flags?limit=1000' + (cursor ? '&cursor=' + cursor : '');
    const data = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + managementKey }
      }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
        res.on('error', reject);
      });
    });
    allFlags.push(...data.flags);
    cursor = data.nextCursor || null;
  } while (cursor);
  return allFlags;
}

// Usage: filter flags starting with "reporting"
const flags = await fetchAllFlags(process.env.AMPLITUIDE_MANAGEMENT_KEY);
const reportingFlags = flags.filter(f => f.key.startsWith('reporting'));
```

**Flags starting with "reporting" (as of 2026-02-21, 7 total):**
- `reporting-embedded-customer-profile-list-views`
- `reporting-interpolate-report-data-refactor`
- `reporting-quick-views`
- `reporting-oversized-arguments-email-api`
- `reporting-goals-summary-email-api`
- `reporting-operational-analytics-migration`
- `reporting-legacy-invoices-replacement`

### Gotchas
- Flag `description` fields can contain literal newlines — parse with a streaming or buffer-based approach, not shell heredocs
- The `/api/1/projects` endpoint does NOT exist — project info is embedded in flag/experiment responses
- The management key appears scoped to a single Amplitude project; all flags returned had `projectId: 217854` (housecall.io_development)

## housecall.io_development Project

- **projectId:** `217854`
- **Total feature flags:** 1,052 (as of 2026-02-21)
- Flags follow naming convention: `<feature-description>` (kebab-case)
- Tags typically follow `squad:<team-name>` convention
- Variants commonly use `using-<flag-key>` / `not-using-<flag-key>` naming

## Fetching a Single Flag by Key

Use `?key=<exact-key>` to fetch a single flag. Returns the full flag object including `targetSegments`, `variants`, `rolloutWeights`, etc.

```bash
curl -s --request GET \
  --url 'https://experiment.amplitude.com/api/1/flags?key=my-flag-key' \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer <AMPLITUIDE_MANAGEMENT_KEY>'
```

The response wraps the flag in a `flags` array: `{ "flags": [ { ...flag } ], "nextCursor": null }`.

### targetSegments Shape

`targetSegments` is an array on the flag (not per-variant). Each segment controls which users are bucketed, and `rolloutWeights` inside the segment determines which variant they receive:

```json
{
  "name": "Segment 1",
  "conditions": [
    {
      "prop": "gp:email",
      "op": "is",
      "type": "property",
      "values": ["user@example.com"]
    }
  ],
  "percentage": 100,
  "bucketingKey": "amplitude_id",
  "rolloutWeights": {
    "using-my-flag": 100,
    "not-using-my-flag": 0
  }
}
```

**HouseCall Pro property names:**
- `gp:email` — user email (group property)
- `gp:pro_uuid` — pro UUID
- `gp:org_uuid` — org UUID

## Patching targetSegments

```
PATCH https://experiment.amplitude.com/api/1/flags/<flag-id>
```

### Key behaviours
- `targetSegments` is a **full replacement** — you must include all existing segments in the request body, not just the ones you're modifying
- Always fetch the current flag first and build the new `targetSegments` array from it
- Response is `ok` (plain string) on success

### Safe workflow for adding an email to a segment

```javascript
const fs = require('fs');
const https = require('https');

// 1. Fetch current flag and save it
const flag = await fetchFlag('my-flag-key'); // use GET ?key=
fs.writeFileSync('saved_flag.json', JSON.stringify({ flags: [flag] }, null, 2));

// 2. Mutate the target segment
const updatedSegments = flag.targetSegments.map(seg => {
  if (seg.name === 'Segment 1') {
    return {
      ...seg,
      conditions: seg.conditions.map(c => ({
        ...c,
        values: [...c.values, 'newuser@example.com']
      }))
    };
  }
  return seg;
});

// 3. PATCH with full targetSegments array
await patchFlag(flag.id, { targetSegments: updatedSegments });
```

### curl example
```bash
curl -s --request PATCH \
  --url 'https://experiment.amplitude.com/api/1/flags/<flag-id>' \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <AMPLITUIDE_MANAGEMENT_KEY>' \
  --data '{ "targetSegments": [ ...all segments... ] }'
```

## Example curl

```bash
# First page
curl -s --request GET \
  --url 'https://experiment.amplitude.com/api/1/flags?limit=1000' \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer <AMPLITUIDE_MANAGEMENT_KEY>'

# Subsequent pages
curl -s --request GET \
  --url 'https://experiment.amplitude.com/api/1/flags?limit=1000&cursor=<nextCursor>' \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer <AMPLITUIDE_MANAGEMENT_KEY>'
```
