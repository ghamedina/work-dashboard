# Refinements

## Reusable components
Create reusable components (usage mentioned below)
- DropdownMenu
- ModalContainer


## Featue flag switcher

Data freshness
- Add a refresh button to table, next to `+` button
- on refresh or page reload, re-fetch feature flag data and update status values for all rows

Flag key
- upgrade text input to be a combo-box
- typing into text input opens a small dropdown overlay below the text input.
- dropdown is sized to show max 10 lines of text
- dropdown is populated by filtered list of keys that contain the typed text
- keys in dropdown can be clicked to select, closing the dropdown and updating the text in the text input

Clone row
- add a "clone" button (use "copy" icon) to each row, next to "x" button
- clicking creates a new row with same values, and re-fetches feature flag data, revalidating "status" column

## Jira / Gitlab table

Comments
- render comment count with Button
- Button click opens a modal (make a reusable ModalConatainer)
- Modal renders
  - header with MR Title, and MR number (clickable)
  - table with columns: comment number, comment text (truncate to 500px, no line wrapping), comment link
  - clicking on the comment text removes truncation, so it is rendered with line wrapping
  - clicking on the comment link opens new tab in gitlab, targetting the coment location in the MR

Jira workItem status
- clicking a status opens a drowpdown menu, listing the status options
- clicking an option updates the Jira item with new status
