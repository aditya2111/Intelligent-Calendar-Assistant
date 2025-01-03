import { Request, Response } from "express";
import { BookingModel } from "../models/booking";
import { BookingService } from "../services/bookingServices";
import { BookingRequest } from "../types/booking";
import { FormDetails } from "../types/booking";

export class BookingController {
  private bookingService: BookingService;

  constructor() {
    this.bookingService = new BookingService();
  }
  private createFormDetails(
    email: string,
    guestEmails?: string[],
    notes?: string
  ): FormDetails {
    // Create a more presentable name from email
    const name = email
      .split("@")[0]
      .split(/[._-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Construct the form details object
    const details: FormDetails = {
      name,
      email,
    };

    // Add optional fields only if they are provided
    if (guestEmails && guestEmails.length > 0) {
      details.guestEmails = guestEmails;
    }

    if (notes) {
      details.notes = notes;
    }

    return details;
  }

  async createBooking(req: Request, res: Response): Promise<void> {
    try {
      const { email, calendlyUrl, guestEmails, notes } =
        req.body as BookingRequest;

      // Validate request
      if (!email || !calendlyUrl) {
        res.status(400).json({
          error: "Missing required fields: email and calendlyUrl are required",
        });
        return;
      }

      // Create booking record with just email
      const booking = await BookingModel.create({ email });
      const details = this.createFormDetails(email, guestEmails, notes);

      // Start automation with calendlyUrl from request
      this.bookingService
        .automateBooking(booking.id, calendlyUrl, details)
        .catch((error) => {
          console.error("Automation failed:", error);
        });

      res.status(201).json(booking);
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({
        error: "Failed to create booking",
      });
    }
  }
}
