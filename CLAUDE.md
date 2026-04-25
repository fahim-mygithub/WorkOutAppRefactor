# Claude Code Instructions

## Testing Policy
**IMPORTANT**: Do NOT run `npm run dev` or any development server commands automatically.
Instead, inform the user to manually run the testing commands when needed.

When testing is required, simply tell the user:
"Please test the changes by running `npm run dev` in your terminal."

## Project Context
This is a React workout tracking application with Firebase integration.

## Recent Issues and Fixes
- Fixed Firebase rules for anonymous user access to shared workouts
- Fixed authentication context infinite loop issue
- Working on shared workout serialization issues