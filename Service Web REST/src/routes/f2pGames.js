const express = require("express");

const router = express.Router();
const API_LIST_URL = "https://www.freetogame.com/api/games";
const API_DETAIL_URL = "https://www.freetogame.com/api/game";

router.get("/", async (req, res, next) => {
  try {
    const response = await fetch(API_LIST_URL);
    if (!response.ok) throw new Error("FreeToGame service unavailable");
    res.send(await response.json());
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const response = await fetch(`${API_DETAIL_URL}?id=${req.params.id}`);
    if (response.status === 404) {
      return res.status(404).send({ message: "F2P game not found" });
    }
    if (!response.ok) throw new Error("FreeToGame service unavailable");
    return res.send(await response.json());
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
