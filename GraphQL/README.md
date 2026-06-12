# REST Analytics

API REST Node.js avec Express et MongoDB pour stocker des analytics flexibles.

## Demarrage

```sh
docker start rest-mongodb
npm start
```

L'API ecoute sur `http://localhost:8010`.

## Views

```sh
curl -X POST http://localhost:8010/views \
  -H "Content-Type: application/json" \
  -d '{"source":"google","url":"/pricing","visitor":"visitor-1","meta":{"browser":"Firefox","campaign":"summer"}}'
```

## Actions

```sh
curl -X POST http://localhost:8010/actions \
  -H "Content-Type: application/json" \
  -d '{"source":"site","url":"/pricing","action":"click_cta","visitor":"visitor-1","meta":{"x":10,"y":20,"element":{"id":"cta"}}}'
```

## Goals

```sh
curl -X POST http://localhost:8010/goals \
  -H "Content-Type: application/json" \
  -d '{"source":"site","url":"/checkout","goal":"purchase","visitor":"visitor-1","meta":{"amount":99,"currency":"EUR","items":["plan-pro"]}}'
```

## Details d'un goal

```sh
curl http://localhost:8010/goals/GOAL_ID/details
```

Cette route retourne le goal, puis ajoute les tableaux `views` et `actions` associes au meme `visitor` via une aggregation MongoDB.
