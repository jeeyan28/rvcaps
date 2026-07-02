const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const Room = require("../model/room");
const upload = require("../middleware/upload");

function parseFeatures(features) {
  if (Array.isArray(features)) return features;
  if (!features) return [];
  return String(features).split(",").map(f => f.trim()).filter(Boolean);
}

// ── List all rooms (optionally filter by category or status)
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;

    const rooms = await Room.find(filter).sort({ category: 1, price: 1 });
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});

// ── Get a single room
router.get("/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Invalid room id." });
  }
});

// ── Create a new room/facility (multipart/form-data — image file optional)
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, category, roomNumber, capacity, description, price, status, features } = req.body;

    if (!name || !category || !roomNumber || !capacity || price === undefined) {
      return res.status(400).json({ message: "name, category, roomNumber, capacity and price are required." });
    }

    const room = new Room({
      name,
      category,
      roomNumber,
      capacity,
      description: description || "",
      price: Number(price),
      status: status || "Available",
      features: parseFeatures(features),
      image: req.file ? `/uploads/${req.file.filename}` : (req.body.image || "")
    });

    await room.save();
    res.status(201).json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error." });
  }
});

// ── Update a room/facility (used by Edit Facility modal). Image only changes
//    if a new file is uploaded — otherwise the existing image is kept.
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { name, category, roomNumber, capacity, description, price, status, features } = req.body;

    const update = {};
    if (name !== undefined) update.name = name;
    if (category !== undefined) update.category = category;
    if (roomNumber !== undefined) update.roomNumber = roomNumber;
    if (capacity !== undefined) update.capacity = capacity;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = Number(price);
    if (status !== undefined) update.status = status;
    if (features !== undefined) update.features = parseFeatures(features);

    let oldImagePath = null;
    if (req.file) {
      const existing = await Room.findById(req.params.id);
      if (existing && existing.image && existing.image.startsWith("/uploads/")) {
        oldImagePath = path.join(__dirname, "..", existing.image);
      }
      update.image = `/uploads/${req.file.filename}`;
    }

    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ message: "Room not found." });

    // Clean up the old image file now that the new one is confirmed saved
    if (oldImagePath) fs.unlink(oldImagePath, () => {});

    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error." });
  }
});

// ── Delete a room/facility (also removes its uploaded image file, if any)
router.delete("/:id", async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });

    if (room.image && room.image.startsWith("/uploads/")) {
      fs.unlink(path.join(__dirname, "..", room.image), () => {});
    }

    res.json({ message: "Room deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;