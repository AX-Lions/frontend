# AX Lions Frontend

Central Hackathon MVP frontend built with React and Vite.

## Start

```bash
npm install
npm run dev
```

On Windows PowerShell, use this if script execution is blocked:

```bash
npm.cmd run dev
```

## MVP Folder Structure

```txt
src/
  app/                 # app router and global providers
  pages/               # route-level page composition
  features/            # feature-owned components and logic
  shared/              # reusable components and constants
  lib/                 # app-wide clients, formatters, utilities
  assets/              # static assets imported by components
```

## Rule of Thumb

- Put a full screen in `pages`.
- Put domain-specific parts in `features/{feature-name}`.
- Put reusable buttons, inputs, layout helpers, and constants in `shared`.
- Put API clients, storage helpers, and pure utility functions in `lib`.
- Keep demo/mock data close to the feature until it becomes shared.
- Create `api`, `hooks`, or `styles` folders inside a feature only when files actually need them.
