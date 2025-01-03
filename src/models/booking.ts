// src/models/booking.model.ts
import { v4 as uuidv4 } from "uuid";
import pool from "../db/dbClient";
import { Booking, BookingInput, BookingStatus } from "../types/booking";

export class BookingModel {
  static async create(input: BookingInput): Promise<Booking> {
    const client = await pool.connect();
    try {
      const uuid = uuidv4();
      const query = `
        INSERT INTO bookings (
          uuid, email, status, createdat
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, uuid, email, status, createdat, bookedfor
      `;

      const values = [uuid, input.email, BookingStatus.PENDING, new Date()];

      const result = await client.query(query, values);

      if (!result.rows[0] || !result.rows[0].id) {
        throw new Error("Failed to create booking - no ID returned");
      }

      return {
        id: result.rows[0].id,
        uuid: result.rows[0].uuid,
        email: result.rows[0].email,
        status: result.rows[0].status as BookingStatus,
        createdAt: result.rows[0].createdat,
        bookedFor: result.rows[0].bookedfor,
      };
    } finally {
      client.release();
    }
  }

  static async updateStatus(id: number, status: BookingStatus): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE bookings 
        SET status = $1
        WHERE id = $2
      `;

      const result = await client.query(query, [status, id]);

      if (result.rowCount === 0) {
        throw new Error(`No booking found with id: ${id}`);
      }
    } catch (error) {
      console.error(`Error updating booking status for id ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: number): Promise<Booking | null> {
    const client = await pool.connect();
    try {
      const query = "SELECT * FROM bookings WHERE id = $1";
      const result = await client.query(query, [id]);

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }
  static async updateBookedFor(id: number, bookedFor: Date): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
            UPDATE bookings 
            SET bookedfor = $1
            WHERE id = $2
        `;
      const result = await client.query(query, [bookedFor, id]);

      if (result.rowCount === 0) {
        throw new Error(`No booking found with id: ${id}`);
      }
    } finally {
      client.release();
    }
  }
}
