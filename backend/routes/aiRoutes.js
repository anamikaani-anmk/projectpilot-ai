const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getProjectInsights,
  getDashboardStats,
} = require("../controllers/aiController");

router.use(auth);

router.get("/dashboard", getDashboardStats);
router.get("/project/:projectId", getProjectInsights);

module.exports = router;
