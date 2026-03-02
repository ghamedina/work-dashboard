# Personal Dashboard

A personal engineering dashboard that surfaces your active Jira work items alongside their corresponding GitLab MRs and CI pipeline status. Built with SvelteKit and streamed SSR.

## Features

- **Jira + GitLab integration** — matches work items to MRs by Jira key in the MR title
- **CI pipeline status** — shows pass/fail/running status per MR
- **Claude Code launcher** — open any Jira ticket in a new terminal window running `claude`, pre-loaded with ticket context and a configurable prompt
- **Repo picker** — choose which local repo to open Claude in; supports glob patterns to auto-discover all projects under a directory
- **Amplitude flag switcher** — view and toggle feature flags via the Amplitude Management API
- **Three density modes** — summary, compact, relaxed
- **Streamed loading** — each data source loads independently; no full-page spinner

## Setup

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment variables

Copy the example and fill in your API tokens:

```sh
cp .env.example .env
```

| Variable                   | Description                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| `JIRA_EMAIL`               | Your Jira account email                                                      |
| `JIRA_TOKEN`               | Jira API token — generate at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `GITLAB_TOKEN`             | GitLab personal access token (`read_api` scope minimum) — generate at your GitLab instance under Settings → Access Tokens |
| `AMPLITUDE_MANAGEMENT_KEY` | Amplitude Management API key — find at [app.amplitude.com/experiment](https://app.amplitude.com/experiment) → Settings → API Keys _(optional — only needed for flag switcher)_ |

### 3. Configure settings

Copy the example and fill in your settings:

```sh
cp settings.yml.example settings.yml
```

`settings.yml` holds non-secret configuration. See the example file for full documentation of every option.

| Section        | What it controls                                                   |
| -------------- | ------------------------------------------------------------------ |
| `jira`         | Jira base URL, email, and project keys to filter issues            |
| `gitlab`       | GitLab base URL, project ID, repo path, and your username          |
| `amplitude`    | Amplitude API base URL                                             |
| `claudePrompt` | Prompts available in the Claude launcher; which one is the default |
| `repoPath`     | Repos available in the repo picker; which one is pre-selected      |
| `terminal`     | Terminal app (`Terminal` or `iTerm2`) and shell settings           |

### 4. Start the dev server

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
      jira.ts           # Jira REST API client
      gitlab.ts         # GitLab REST API client (MRs + CI pipelines)
      amplitude.ts      # Amplitude Management API client
    components/
      DataTable.svelte       # Main data table
      Controls.svelte        # Density + refresh controls
      ClaudePicker.svelte    # Claude launcher: prompt + repo picker UI
      RepoPicker.svelte      # Repo path dropdown
      FlagSwitcher.svelte    # Amplitude flag panel
      FlagSwitcherRow.svelte # Individual flag row with toggle
      DropdownMenu.svelte    # Generic dropdown menu
      ModalContainer.svelte  # Generic modal wrapper
      Button.svelte          # Base button component
      ButtonGroup.svelte     # Grouped button row
      ToggleButton.svelte    # Toggle-state button
      EmailToggleButton.svelte
      Tooltip.svelte
      Table.svelte / TableHeaderRow.svelte / TableBodyRow.svelte
      Container.svelte
      Loader.svelte
    config.ts         # Reads settings.yml and validates env vars
    types.ts          # Shared TypeScript types
  routes/
    +page.server.ts   # Streaming SSR load (Jira + GitLab)
    +page.svelte      # Dashboard page
    api/
      amplitude/      # Amplitude flag list + toggle endpoints
      jira/           # Jira issue status/detail endpoints
      claude/         # Claude launcher: open + preview endpoints
      repo-paths/     # Resolved repo path list endpoint
      open-file/      # Open file in editor endpoint
```
