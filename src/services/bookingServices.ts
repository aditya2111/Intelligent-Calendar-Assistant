import { BookingModel } from "../models/booking";
import { BookingStatus } from "../types/booking";
import { PuppeteerService } from "./puppeteerService";
import { FormDetails } from "../types/booking";

export class BookingService {
  private puppeteerService: PuppeteerService;

  constructor() {
    this.puppeteerService = new PuppeteerService();
  }

  async automateBooking(
    bookingId: number,
    calendlyUrl: string,
    details: FormDetails
  ): Promise<void> {
    try {
      // Initialize browser
      await this.puppeteerService.initBrowser();

      console.log("Booking status: Processing");
      await BookingModel.updateStatus(bookingId, BookingStatus.PROCESSING);

      await this.puppeteerService.goToCalendlyPage(calendlyUrl);

      // Single method call for automation
      const bookedDateTime =
        await this.puppeteerService.bookFirstAvailableSlot();

      await this.puppeteerService.fillFormAndSubmit(details);

      await BookingModel.updateBookedFor(bookingId, bookedDateTime);

      console.log("Booking status: Completed");
      await BookingModel.updateStatus(bookingId, BookingStatus.COMPLETED);
    } catch (error) {
      console.error("Booking automation failed:", error);
      await BookingModel.updateStatus(bookingId, BookingStatus.FAILED);
      throw error;
    } finally {
      await this.puppeteerService.closeBrowser();
    }
  }
}
