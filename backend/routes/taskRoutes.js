const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require("../controllers/taskController");

router.use(auth);

router.get("/project/:project_id", getTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.patch("/:id/status", updateTaskStatus);
router.delete("/:id", deleteTask);

module.exports = router;
