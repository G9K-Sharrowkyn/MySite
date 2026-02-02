# Database switch (local JSON or MongoDB)

This backend supports two storage modes controlled by one env value:

- DATABASE=local  (default)
- DATABASE=mongo

## Local JSON

- Data file: backend/db.json
- Optional override: JSON_DB_PATH=some/path.json

## MongoDB

- Required: MONGO_URI
- Optional: MONGO_DB_NAME (default: geekfights)

## Migration scripts

Run from backend/:

- npm run migrate:mongo  (local JSON -> MongoDB)
- npm run export:json    (MongoDB -> local JSON)

## Notes

- The Mongo adapter mirrors the JSON schema using one collection per top-level key.
- Updates rewrite changed collections, which is fine for testing but not ideal for very large datasets.
- You can switch back and forth by changing DATABASE in the environment.

## Repositories

Module-level repositories live in `backend/repositories/index.js` and wrap storage access
per collection (users, posts, comments, etc.). Import `*Repo` or use `repositories.<name>`
to keep data access isolated while still honoring the DATABASE switch.
