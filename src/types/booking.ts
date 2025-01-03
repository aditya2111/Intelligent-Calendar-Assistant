export interface BookingInput {
  email: string;
}
export interface BookingRequest {
  email: string;
  calendlyUrl: string;
  guestEmails?: string[];
  notes?: string;
}

export interface Booking {
  uuid: string;
  id: number;
  email: string;
  status: BookingStatus;
  createdAt: Date;
  bookedFor?: Date;
}

export enum BookingStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}
export interface FormDetails {
  name: string;
  email: string;
  guestEmails?: string[];
  notes?: string;
}
