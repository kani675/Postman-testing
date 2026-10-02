# Users API + Postman in DevOps

Node.js/Express + MySQL CRUD API tested with a Postman collection.
The same collection runs in the Postman app, from the terminal (Newman) and in GitHub Actions.

## Run locally (PowerShell)
```
npm install
$env:DB_USER="root"
$env:DB_PASSWORD="Kani675@mepco"
$env:DB_NAME="user_db"
npm start
```

## Run the Postman tests with Newman
```
npm run test:api
npx newman run postman/users-api.postman_collection.json --env-var baseUrl=http://localhost:3000 -d postman/names.csv
```

## Run everything with Docker
```
docker compose up --build --abort-on-container-exit --exit-code-from newman
```

## CI
`.github/workflows/api-tests.yml` starts MySQL, starts the API and runs the Postman collection on every push.
