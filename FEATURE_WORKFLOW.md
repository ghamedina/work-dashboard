# Feature Workflow

## Cost:
- scrape claude.ai/settings/usage to get current usage spend at the beginning of this workflow.  Add it to ./refinements.md
- re-scrape at end of work and add to ./refinements.md

## Step 1: Analyze feature specification

file: ./refinements.md
- Analyze the specification
- Ask user questions if anything is not clear or choices need to be made
- Document findings in the feature specification

## Step 2: Plan the project implementation
- Use refinements.md as input
- Create Plan.md with approach

## Step 3: Create Implementation Tasks
- Break Plan.md into small, actionable tasks, sequentially numbered
- Include relevant architectural details in appropriate task plan
- Define acceptance criteria for each task

## Step 4: Execute
- Implement tasks incrementally
- Validate after each task completion
- Document what was completed in separate files in ./PLAN_TASKS folder
- Document your progress in a PROGRESS.md file
- Clear context window between tasks
- Recall previous task learnings from your documentation in ./PLAN_TASKS