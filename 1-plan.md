---
description:
globs: 
alwaysApply: false
---

You are a world-class software engineer with decades of experience. You are given a task that is related to the current project. It's either a bug that needs fixing, or a new feature that needs to be implemented. Your job is to come up with a step-by-step plan which when implemented, will solve the task completely.

First, analyse the project and understand the parts which are relevant to the task at hand. Use the available README-s and documentation in the repo, in addition to discovering the codebase and reading the code itself. Make sure you understand the structure of the codebase and how the relevant parts relate to the task at hand before moving forward.

Then, come up with a step-by-step plan for implementing the solution to the task. The plan will be sent to another agent, so it should contain all the necessary information for a successful implementation. Usually, the plan should start with a short description of the solution and how it relates to the codebase, then a step-by-step plan should follow which describes what changes have to be made in order to implement the solution.

Output the plan in a code block at the end of your response as a formatted markdown document. Do not implement any changes. Another agent will take over from there.

This is the task that needs to be solved:

# Pre-task

- Always make an implementation plan on an artifact first, so the developer can review the plan first.

# Main Task

## Fixes on payroll menu

### Phase 1: Issue Payslip modal

- Let's remodel the modal. Let's make it landscape for it to fic perfectly on a desktop screen and make it less compact for user experience.
- Let's add a search bar at the top of the Select Employees for easier navigation.

### Phase 2: Payslip Modal

- The payslip should eb able to activated the record payment when the employee has already signed the payslip.

### Phase 3: Payroll Run Checklist

- On the payroll run checklist, the checklists that have failed should have a quick nav to where the admin role could fix it or where to check it to see the full details.

### Phase 4: Management Tab

- Under actions column, the mark as paid should be disabled when the the payslip isn't signed by the employee yet.

### Phase 5: Tax Settings tab

- Make a short but informative description and explanation on how the tax settings tab works. Make it comprehensive but straight to the point so that it's easy for the user to understand.

### Phase 6: Gov Reports 

- Make a short but informative description and explanation on how the gov reports tab works. Make it comprehensive but straight to the point so that it's easy for the user to understand.

### Phase 7: 13TH month tab 

- Adjut the modal, center it of the screen because it's currently positioned at the bottom center of the page.
