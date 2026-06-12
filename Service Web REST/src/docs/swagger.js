const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "REST Postgres Marketplace API",
    version: "1.0.0",
  },
  servers: [{ url: "http://localhost:8000" }],
  paths: {
    "/": {
      get: {
        summary: "Health check",
        responses: { 200: { description: "Hello World" } },
      },
    },
    "/products": {
      get: {
        summary: "Lister les produits",
        parameters: [
          { name: "name", in: "query", schema: { type: "string" } },
          { name: "about", in: "query", schema: { type: "string" } },
          { name: "price", in: "query", schema: { type: "number" } },
        ],
        responses: { 200: { description: "Liste des produits" } },
      },
      post: {
        summary: "Creer un produit",
        responses: { 201: { description: "Produit cree" }, 400: { description: "Body invalide" } },
      },
    },
    "/products/{id}": {
      get: { summary: "Recuperer un produit", responses: { 200: {}, 404: {} } },
      delete: { summary: "Supprimer un produit", responses: { 200: {}, 404: {} } },
    },
    "/users": {
      get: { summary: "Lister les utilisateurs sans mot de passe", responses: { 200: {} } },
      post: { summary: "Creer un utilisateur avec mot de passe SHA512", responses: { 201: {}, 400: {} } },
    },
    "/users/{id}": {
      get: { summary: "Recuperer un utilisateur", responses: { 200: {}, 404: {} } },
      put: { summary: "Remplacer un utilisateur", responses: { 200: {}, 400: {}, 404: {} } },
      patch: { summary: "Modifier partiellement un utilisateur", responses: { 200: {}, 400: {}, 404: {} } },
      delete: { summary: "Supprimer un utilisateur", responses: { 200: {}, 404: {} } },
    },
    "/f2p-games": {
      get: { summary: "Lister les jeux Free-to-Play via FreeToGame", responses: { 200: {}, 500: {} } },
    },
    "/f2p-games/{id}": {
      get: { summary: "Recuperer un jeu Free-to-Play", responses: { 200: {}, 404: {}, 500: {} } },
    },
    "/orders": {
      get: { summary: "Lister les commandes avec user et produits complets", responses: { 200: {} } },
      post: { summary: "Creer une commande", responses: { 201: {}, 400: {} } },
    },
    "/orders/{id}": {
      get: { summary: "Recuperer une commande", responses: { 200: {}, 404: {} } },
      put: { summary: "Remplacer une commande", responses: { 200: {}, 400: {}, 404: {} } },
      patch: { summary: "Modifier partiellement une commande", responses: { 200: {}, 400: {}, 404: {} } },
      delete: { summary: "Supprimer une commande", responses: { 200: {}, 404: {} } },
    },
    "/reviews": {
      get: { summary: "Lister les avis", responses: { 200: {} } },
      post: { summary: "Creer un avis et mettre a jour le produit", responses: { 201: {}, 400: {} } },
    },
    "/reviews/{id}": {
      get: { summary: "Recuperer un avis", responses: { 200: {}, 404: {} } },
      put: { summary: "Remplacer un avis", responses: { 200: {}, 400: {}, 404: {} } },
      patch: { summary: "Modifier partiellement un avis", responses: { 200: {}, 400: {}, 404: {} } },
      delete: { summary: "Supprimer un avis", responses: { 200: {}, 404: {} } },
    },
  },
};

module.exports = swaggerDocument;
