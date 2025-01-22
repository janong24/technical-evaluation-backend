# o8t interview backend coding challenge

This repository contains a backend coding challenge for interviews at omniscient neurotechnology for backend
roles.

- Should take less than 4hrs
- Be prepared to discuss your code. If you do not complete the challenge, that is ok! Be prepared to discuss
  next steps you would take and problems and their potential solutions.
- Evaluated on code style, best practices
  - Git commit history
  - How readable code is

## Problem statement

- Upload and download files
- Files must be kept in-memory
  - We've selected valkey for the in-memory storage backend.
  - There is a test implementation of the "storage backend" that you will work with in in this challenge
- Data integrity is important. SHA-1 checksums should be used to ensure that files are

## Developing

- Node.js 20 is required
- Install dependencies with `yarn`
- Run tests with `yarn dev`
- Check typescript typings with `yarn typecheck`
- Apply automatic formatting with `yarn autoformat`

## Hints

- Dependency injection is used
- It is recommended to start by running the tests and working from failures
  - Reading the `TestBackend` implementation is recommended so that you are aware of the storage backend
    methods that are available
- the `node:crypto` module has utilities for computing sha-1 checksums of data. There is a helper method
  implemented in the codebase to make using this easy.
