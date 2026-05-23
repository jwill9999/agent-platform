# Add Project Git Push Action And Terminal Dock Padding

## Summary

Add a small Git push path after local commits and improve the terminal dock spacing in Project Chat.

## Requirements

- After a successful commit from the Changes tab, switch to the Commits tab and show a success confirmation.
- Show a Push action when the current branch has an upstream and local commits are ahead.
- Keep no-upstream branches explicit: do not invent remotes or create GitHub repositories in this task.
- Refresh local Git state after push.
- Add bottom spacing below the Project terminal dock so it is not flush with the application canvas edge.

## Verification

- Focused Project router test covers pushing to an upstream.
- API and web typecheck pass.
- Web lint and formatting pass.
