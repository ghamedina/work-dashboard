# Personal Dashboard

## This Document

Describes a small project to be developed

## Purpose of the project

Display a web page that renders a table showing active Jira workitems aligned with associated Gitlab merge requests.
Show relevant links so that the assocaited work can easily be navigated to.

## Design

The table should be compact but very easy to read.
Light, muted colors. Subtle shadow and nearly sharp corners (but not quite!)
Buttons, not links.
Buttons should gently respond to hover.

No extra stuff. Just the table and a few controls at the top.  

3 modes - `summary`, `compact`, and `relaxed`, selected by a group of toggle buttons.

### Controls

Controls are rendered as buttons, with icons and no text. Hover surfaces a tooltip with a description of the purpose of the button. tooltip revealed after 400ms delay

- reload button
- `render mode` toggle button group. This control triggers render changes but does not require server interaction (all modes are present on client)

## Precedent

/Users/ben.norrichs/dev/personal/automations/logs/log_status.sh is a shell script that uses the Atlassian CLI and the Gitlab CLI to fetch data and create a markdown file that shows a table. This shell script produces a table very similar to what this app is meant to produce.
API calls will have the same functionality as the CLI commands, but with different syntax.

## Framework

SvelteKit

- use SSR

## APIs

### Jira Rest API
documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/

### GitLab
documentation: https://docs.gitlab.com/api/rest/

## Authentication

Jira and Gitlab APIs are authenticated using personal tokens. Token values are stored in ./.env

No sign-in. This app is for a single user.

## Data flow

Server rendered
While fetching data, render an informative loader screen with details about the API call status
Make concurrent API calls to Jira and Gitlab
Process the data to generate the table and update the view
Use hooks if available to trigger data refetch, otherwise refetch on "reload" request from client

