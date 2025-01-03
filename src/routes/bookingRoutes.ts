import { Router } from "express";
import { BookingController } from "../controllers/bookingController";

const router = Router();

// Create a new instance of the controller
const bookingController = new BookingController();

// Use the instance method
router.post("/bookings", (req, res) =>
  bookingController.createBooking(req, res)
);

export default router;
