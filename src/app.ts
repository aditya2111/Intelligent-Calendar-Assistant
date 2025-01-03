import express from "express";
import bookingRoutes from "./routes/bookingRoutes";

const app = express();
app.use(express.json());
app.use("/api", bookingRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
