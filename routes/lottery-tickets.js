// routes/lottery-tickets.js
const express = require("express");
const router = express.Router();

const Ticket = require("../models/Ticket");
const authenticate = require("../middleware/authenticate");

/**
 * GET /api/lottery/tickets
 * Query:
 *   - status=pending | won | lost (optional)
 *
 * Response:
 * {
 *   ok: true,
 *   tickets: [...]
 * }
 */
router.get("/tickets", authenticate, async (req, res) => {
  try {
    const userId =
      (req.user && (req.user._id || req.user.id)) || null;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
      });
    }

    const filter = { userId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      ok: true,
      tickets,
    });
  } catch (err) {
    console.error("GET /lottery/tickets error:", err);
    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
    });
  }
});
/**
 * GET /api/lottery/tickets/:ticketId
 * ดึงบิลหวย 1 ใบ
 */
router.get("/tickets/:ticketId", authenticate, async (req, res) => {
  try {
    const userId =
      (req.user && (req.user._id || req.user.id)) || null;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
      });
    }

    const { ticketId } = req.params;

    const ticket = await Ticket.findOne({
      ticketId,
      userId, // ป้องกันดูบิลคนอื่น
    }).lean();

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND",
      });
    }

    return res.json({
      ok: true,
      ticket,
    });
  } catch (err) {
    console.error("GET /lottery/tickets/:ticketId error:", err);
    return res.status(500).json({
      ok: false,
      error: "SERVER_ERROR",
    });
  }
});


module.exports = router;
