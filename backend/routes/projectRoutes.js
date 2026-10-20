const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  joinProject,
  getProjectMembers,
  removeProjectMember,
  updateJoinPassword,
} = require("../controllers/projectController");

router.use(auth);

router.post("/join", joinProject);
router.post("/", createProject);
router.get("/", getProjects);
router.get("/user/:user_id", getProjects);
router.get("/:id", getProjectById);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

router.get("/:id/members", getProjectMembers);
router.delete("/:id/members/:userId", removeProjectMember);
router.patch("/:id/join-password", updateJoinPassword);

module.exports = router;

