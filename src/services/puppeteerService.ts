import { Page } from "puppeteer";
import * as puppeteer from "puppeteer";
import { BookingModel } from "../models/booking";
import { BookingStatus } from "../types/booking";
import { FormDetails } from "../types/booking";

export class PuppeteerService {
  private page: Page | null = null;
  private browser: puppeteer.Browser | null = null;

  async initBrowser() {
    this.browser = await puppeteer.launch({
      headless: false, // Set to true in production
      defaultViewport: { width: 1280, height: 800 },
      args: ["--start-maximized"],
    });
    this.page = await this.browser.newPage();
    await this.page.setDefaultTimeout(30000); // 30 seconds timeout
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  private async waitAndClick(selector: string) {
    await this.retry(async () => {
      if (!this.page) throw new Error("Browser not initialized");
      await this.page.waitForSelector(selector, { visible: true });
      await this.page.click(selector);
    });
  }

  async bookFirstAvailableSlot(
    calendlyUrl: string,
    details: FormDetails
  ): Promise<boolean> {
    if (!this.page) throw new Error("Browser not initialized");

    try {
      // 1. Navigate to the Calendly URL
      console.log("Navigating to Calendly...");
      await this.page.goto(calendlyUrl, { waitUntil: "networkidle0" });

      // 2. Wait for and click the first available time slot
      console.log("Looking for first available time slot...");
      await this.retry(async () => {
        const availableDateSelector = 'button[aria-current="date"]';
        await this.page!.waitForSelector(availableDateSelector);
        await this.page!.click(availableDateSelector);
      });
      await this.retry(async () => {
        // Using data-container and data-start-time attributes which are more stable
        const timeSlotSelector = 'button[data-container="time-button"]';
        await this.page!.waitForSelector(timeSlotSelector);

        // Get all time slots and click first available
        const timeSlots = await this.page!.$$(timeSlotSelector);
        if (timeSlots.length === 0) {
          throw new Error("No available time slots found");
        }

        console.log("Clicking first available time slot");
        await timeSlots[0].click();

        await this.retry(async () => {
          // Using role and aria-label containing "Next"
          const nextButtonSelector =
            'button[role="button"][aria-label^="Next"]';
          await this.page!.waitForSelector(nextButtonSelector);
          console.log("Clicking next button");
          await this.page!.click(nextButtonSelector);
        });
      });

      // 4. Wait for the form page and fill details
      console.log("Filling form details...");
      await this.fillFormAndSubmit(details);

      return true;
    } catch (error) {
      console.error("Automation failed:", error);
      throw error;
    }
  }
  async fillFormAndSubmit(details: FormDetails): Promise<boolean> {
    if (!this.page) throw new Error("Browser not initialized");

    try {
      // Wait for the form to be fully loaded
      console.log("Starting form fill...");
      await this.page.waitForSelector("form");

      // Fill in name
      await this.page.type('input[name="full_name"]', details.name);

      // Fill in email
      await this.page.type('input[name="email"]', details.email);

      console.log("Filled name and email");

      // Handle guest emails if provided
      if (details.guestEmails?.length) {
        // Click add guests button
        console.log("Filling guest emails..");
        const addGuestButton = 'button:has-text("Add Guests")';
        await this.waitAndClick(addGuestButton);

        // Add each guest
        for (const guestEmail of details.guestEmails) {
          await this.retry(async () => {
            // Using id which is more reliable
            const guestSelector = "#invitee_guest_input";
            await this.page!.waitForSelector(guestSelector);
            await this.page!.type(guestSelector, guestEmail);
            await this.page!.keyboard.press("Enter");

            // Wait for the email to be added using waitForFunction
            await this.page!.waitForFunction(
              (email) => {
                // Look for elements that contain the added email
                const addedEmails = document.querySelectorAll(
                  '[data-qa="added-guest"]'
                );
                return Array.from(addedEmails).some((el) =>
                  el.textContent?.includes(email)
                );
              },
              {},
              guestEmail
            );
          });
        }
      }

      // Fill in notes if provided
      // Fill notes if any
      if (details.notes) {
        // Type guard
        const notes: string = details.notes;
        if (notes.trim() !== "") {
          console.log("Adding notes...");
          await this.retry(async () => {
            const notesSelector = 'textarea[name="question_0"]';
            await this.page!.waitForSelector(notesSelector);

            // Validate notes length
            if (notes.length > 10000) {
              throw new Error(
                "Notes exceed maximum length of 10000 characters"
              );
            }

            await this.page!.type(notesSelector, notes);
          });
        }
      }
      const scheduleButton = 'button[type="submit"]';
      await this.waitAndClick(scheduleButton);

      // Wait for confirmation page or success indicator
      // This selector might need adjustment based on Calendly's actual confirmation page

      return true;
    } catch (error) {
      console.error("Error in form filling:", error);
      throw error;
    }
  }

  // Helper method to retry actions in case of failure
  private async retry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1, delay);
    }
  }
}
