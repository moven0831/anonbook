# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Plan: Fix relay port to 3000

## Context
The relay server listens on port 8000 because `index.ts` has its own hardcoded default (`8000`) instead of using `config.port` (which correctly defaults to `3000`). The frontend already expects `localhost:3000`. This mismatch causes the "Cannot reach relay" error in the TUI.

## Changes

### 1. Fix `packages/relay/src/index.ts`
Use `config.port` instead of the hardcoded `process.env.PORT || 8000`:
```ts
import app from ...

