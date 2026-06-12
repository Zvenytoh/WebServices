# REST MongoDB

API REST Node.js avec Express, MongoDB et Zod.

## Demarrage

```sh
docker start rest-mongodb
npm start
```

L'API ecoute sur `http://localhost:8000`.
Le frontend temps reel est disponible sur `http://localhost:8000/frontend/`.

## Categories

Creer une categorie :

```sh
curl -X POST http://localhost:8000/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"Informatique"}'
```

## Products

Creer un produit :

```sh
curl -X POST http://localhost:8000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Laptop","about":"Portable computer","price":999,"categoryIds":["CATEGORY_ID"]}'
```

Un produit doit avoir au moins une categorie. Depuis le frontend, creez d'abord une categorie, puis selectionnez-la dans la liste du formulaire produit.

Lister les produits avec leurs categories :

```sh
curl http://localhost:8000/products
```

Recuperer un produit par id :

```sh
curl http://localhost:8000/products/PRODUCT_ID
```

Modifier un produit :

```sh
curl -X PUT http://localhost:8000/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{"name":"Laptop Pro","about":"Portable computer updated","price":1299,"categoryIds":["CATEGORY_ID"]}'
```

Supprimer un produit :

```sh
curl -X DELETE http://localhost:8000/products/PRODUCT_ID
```

## Codes de statut

- `200` : lecture ou modification reussie
- `201` : creation reussie
- `204` : suppression reussie, sans body de reponse
- `400` : body invalide ou id MongoDB invalide
- `404` : produit introuvable

## Temps reel

L'API utilise Socket.IO et emet un evenement sur le canal `products` a chaque changement :

- creation : `{ "type": "created", "product": ... }`
- modification : `{ "type": "updated", "product": ... }`
- suppression : `{ "type": "deleted", "product": { "_id": "..." } }`

Pour valider dans le navigateur, ouvrez `http://localhost:8000/frontend/` dans deux onglets.
Quand un produit est cree, modifie ou supprime depuis l'API, les deux onglets se mettent a jour sans recharger la page.
Quand une categorie est creee depuis une page, elle apparait aussi dans la liste de selection des autres pages ouvertes.
