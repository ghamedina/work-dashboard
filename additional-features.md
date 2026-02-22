# Additional scope

## Reusable Components

Extract or create reusable svelte components to encapsulate functionality and styling
Continue to make use of project-level variables in app.css

Extract from existing code:
- Container - container for table
- Table
- TableHeaderRow
- TableBodyRow
- Button
- ButtonGroup
- Tooltip

Create new:
- renders in 2 states - dark and light for on and off state of the email in the feature flag cohort

### Tasks:
- Refactor existing UI to use reusable components


## Feature: Amplitude feature flag switcher

### Purpose
Configurable interface to display and alter feature flag status.

### Data
Amplitude feature flag details fetched with Amplitude Management API
Specific feature flags, cohorts, segments, and users can be selected through a variety of inputs
Selected combination of the above feed into buttons configured to toggle feature flag status.

### UI

Use reusable components to maintain consistency with design patterns of existing UI

This feature UI consists of:
- Table
- Each TableBodyRow corresponds to a particular combination of
  - feature flag
  - targetSegment
  - email address
- Initially, there are no rows.
- Rows are added by clicking a button.  UX and data flow section describes what happens after that

### Amplitude API

documentation: https://amplitude.com/docs/apis/experiment/experiment-management-api-flags
learnings: Amplitude-API-learnings.md

### Authentication

use AMPLITUIDE_MANAGEMENT_KEY environmental variable

### UX and data flow

1) user clicks "+" button
2) row added to table
3) API call - feature flags list fetched from project (specified by environmental variable)
4) feature flag name text input is typed into by user.  If typed text matches a feature flag, green circle indicator appears to the right of text input
5) `Select` component is rendered (new) with targetSegments of the selected flag as options
7) user chooses a targetSegment
8) text input appears to the right, where user can type an email address
9) button appears to the right.  Button color indicates if the email address appears in the targetSegment values array (green) or not (red).  Button click adds or removes the email address, using the `Safe workflow for adding an email to a segment` from Amplitude-API-learnings.md.  The click function will:
  - save the current configuration
  - PATCH the configuration
  - verify that the PATCH was non-destructive, only adding or removing the email address

### Persistence
Feature flag switcher configuration should be saved to local storage and retrived on load
Provide a button that clears the stored configuration

### SAFETY:
- during implementation, do not make experimental API calls
- after implementation is complete, initiate an interactive session to test example API calls using cURL