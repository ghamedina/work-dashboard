# Personal Dashboard

A personal engineering dashboard that surfaces your active Jira work items alongside their corresponding GitLab MRs and CI pipeline status. Built with SvelteKit and streamed SSR.

## Features

- **Jira + GitLab integration** — matches work items to MRs by Jira key in the MR title
- **CI pipeline status** — shows pass/fail/running status per MR
- **Amplitude flag switcher** — view and toggle feature flags via the Amplitude Management API
- **Three density modes** — summary, compact, relaxed
- **Streamed loading** — each data source loads independently; no full-page spinner

## Setup

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment

Copy the example and fill in your credentials:

```sh
cp .env.example .env
```

| Variable                   | Description                                                |
| -------------------------- | ---------------------------------------------------------- |
| `JIRA_TOKEN`               | Jira personal access token                                 |
| `JIRA_BASE_URL`            | e.g. `https://yourcompany.atlassian.net`                   |
| `JIRA_EMAIL`               | Your Jira account email                                    |
| `JIRA_PROJECT_KEY`         | Jira project key to filter issues                          |
| `GITLAB_TOKEN`             | GitLab personal access token                               |
| `GITLAB_BASE_URL`          | e.g. `https://gitlab.yourcompany.com`                      |
| `GITLAB_PROJECT_ID`        | Numeric project ID                                         |
| `GITLAB_REPO`              | e.g. `org/repo-name`                                       |
| `GITLAB_AUTHOR_USERNAME`   | Your GitLab username (filters MRs to yours)                |
| `AMPLITUDE_MANAGEMENT_KEY` | Amplitude Management API key                               |

### 3. Start the dev server

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Commands

```sh
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run check     # Svelte type-check
```

## Project Structure

```
src/
  lib/
    api/
      jira.ts         # Jira REST API client
      gitlab.ts       # GitLab REST API client (MRs + CI pipelines)
      amplitude.ts    # Amplitude Management API client
    components/
      DataTable.svelte     # Main data table
      Controls.svelte      # Density + refresh controls
      FlagSwitcher.svelte  # Amplitude flag panel
      ...                  # Button, Table, Tooltip, etc.
    config.ts         # Reads and validates env vars
    types.ts          # Shared TypeScript types
  routes/
    +page.server.ts   # Streaming SSR load (Jira + GitLab)
    +page.svelte      # Dashboard page
    api/
      amplitude/      # Amplitude flag API endpoints
      jira/           # Jira issue status/detail endpoints
```
