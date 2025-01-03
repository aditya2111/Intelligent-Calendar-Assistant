import { Page } from "puppeteer";
import * as puppeteer from "puppeteer";
import { FormDetails } from "../types/booking";

export class PuppeteerService {
  private page: Page | null = null;
  private browser: puppeteer.Browser | null = null;
  private selectedDate: string | undefined;

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
  async goToCalendlyPage(calendlyUrl: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    try {
      console.log("Navigating to Calendly page...");
      await this.page.goto(calendlyUrl, { waitUntil: "networkidle0" });
      console.log("Navigation completed");
    } catch (error) {
      console.error("Error navigating to Calendly page:", error);
      throw error;
    }
  }

  async bookFirstAvailableSlot(): Promise<Date> {
    if (!this.page) throw new Error("Browser not initialized");

    try {
      // 1. Wait for and click the first available time slot
      if (!this.page) throw new Error("Browser not initialized");

      console.log("Looking for first available time slot...");
      let selectedDateTime: Date | undefined; // Initialize here

      // Get the selected date
      await this.retry(async () => {
        const availableDateSelector =
          'button[type="button"][aria-label*="Times available"]:not([disabled])';
        await this.page!.waitForSelector(availableDateSelector);

        // Get the date from aria-label before clicking
        const dateElements = await this.page!.$$(availableDateSelector);
        if (dateElements.length === 0) {
          throw new Error("No available dates found");
        }
        const ariaLabel = await dateElements[0].evaluate((el) =>
          el.getAttribute("aria-label")
        );
        this.selectedDate = ariaLabel?.split(",")[1].split("-")[0].trim();
        console.log("Selected date:", this.selectedDate);

        await dateElements[0].click();
      });

      // Get and click time slot
      await this.retry(async () => {
        const timeSlotSelector =
          'button[data-container="time-button"]:not([disabled])';
        await this.page!.waitForSelector(timeSlotSelector);

        const timeSlots = await this.page!.$$(timeSlotSelector);
        if (timeSlots.length === 0) {
          throw new Error("No available time slots found");
        }

        // Get the time before clicking
        const startTime = await timeSlots[0].evaluate((el) =>
          el.getAttribute("data-start-time")
        );
        console.log(`Selected time slot: ${startTime}`);

        // Combine date and time to create DateTime
        if (this.selectedDate && startTime) {
          // Parse the date parts
          const year = new Date().getFullYear();
          const month = this.selectedDate.split(" ")[0]; // "January"
          const day = parseInt(this.selectedDate.split(" ")[1]); // "4"

          // Convert month name to month number (0-11)
          const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          const monthIndex = monthNames.indexOf(month);

          // Parse time
          const timeMatch = startTime.match(/(\d+):(\d+)(am|pm)/);
          if (!timeMatch) {
            throw new Error("Invalid time format");
          }

          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const isPM = timeMatch[3].toLowerCase() === "pm";

          // Convert to 24-hour format
          if (isPM && hours !== 12) {
            hours += 12;
          } else if (!isPM && hours === 12) {
            hours = 0;
          }

          // Create date object
          selectedDateTime = new Date(year, monthIndex, day, hours, minutes);
          console.log(`Booking DateTime:`, selectedDateTime);
        }

        await timeSlots[0].click();
      });

      // Click Next button
      await this.retry(async () => {
        const nextButtonSelector = 'button[role="button"][aria-label^="Next"]';
        await this.page!.waitForSelector(nextButtonSelector);
        await this.page!.click(nextButtonSelector);
      });

      if (!selectedDateTime) {
        throw new Error("Failed to capture booking date and time");
      }

      return selectedDateTime; // TypeScript now knows this is defined
    } catch (error) {
      console.error("Error in selecting date and time:", error);
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
        console.log("Adding guest emails:", details.guestEmails);
        // Click add guests button
        await this.retry(async () => {
          await this.page!.waitForSelector('button[type="button"] span');
          const buttons = await this.page!.$$('button[type="button"] span');
          let buttonFound = false;

          for (const button of buttons) {
            const text = await button.evaluate((el) => el.textContent?.trim());
            if (text === "Add Guests") {
              await button.click();
              buttonFound = true;
              console.log("Clicked Add Guests button");
              break;
            }
          }

          if (!buttonFound) {
            throw new Error("Add Guests button not found");
          }
        });
        // Add each guest
        for (const guestEmail of details.guestEmails) {
          await this.retry(async () => {
            console.log(`Starting to add guest email: ${guestEmail}`);

            // Using the exact selector for the guest input
            const guestEmailSelector =
              'input[role="combobox"][aria-label="Guest Email(s)"]';
            await this.page!.waitForSelector(guestEmailSelector);

            // Clear any existing value and focus the input
            await this.page!.evaluate((selector) => {
              const input = document.querySelector(
                selector
              ) as HTMLInputElement;
              if (input) {
                input.value = "";
                input.focus();
              }
            }, guestEmailSelector);

            // Type the email
            await this.page!.type(guestEmailSelector, guestEmail);
            console.log(`Typed guest email: ${guestEmail}`);

            // Press Enter
            await this.page!.keyboard.press("Enter");
            console.log(`Pressed Enter for: ${guestEmail}`);

            // Wait for the email to be accepted
            await this.page!.waitForFunction(
              () => {
                const input = document.querySelector(
                  'input[role="combobox"]'
                ) as HTMLInputElement;
                return input && input.value === ""; // Input should be cleared after successful add
              },
              { timeout: 5000 }
            );
            console.log(`Guest email ${guestEmail} was added`);
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
      await this.retry(async () => {
        const scheduleButtonSelector = 'button[type="submit"]';
        await this.page!.waitForSelector(scheduleButtonSelector);
        console.log("Found Schedule Event button");

        await this.page!.evaluate(() => {
          const button = document.querySelector(
            'button[type="submit"]'
          ) as HTMLButtonElement;
          if (button) button.click();
        });
        console.log("Clicked Schedule Event button");

        // Wait for confirmation
        try {
          await this.page!.waitForNavigation({
            waitUntil: "networkidle0",
            timeout: 10000,
          });
          console.log("Navigation completed after scheduling");
        } catch (error) {
          console.log("No navigation occurred after clicking Schedule Event");
        }
      });

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
