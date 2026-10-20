const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getProjectInsights,
  getDashboardStats,
  chatWithProjectAI,
} = require("../controllers/aiController");

router.use(auth);

router.get("/dashboard", getDashboardStats);
router.get("/project/:projectId", getProjectInsights);
router.post("/project/:projectId/chat", chatWithProjectAI);

module.exports = router;
