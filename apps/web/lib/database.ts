import { createDatabase } from "@ai-news-navigator/database";

let connection: ReturnType<typeof createDatabase> | undefined;

export function getDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Add it to the runtime environment before opening the news feed.",
    );
  }

  if (process.env.DATABASE_DRIVER === "neon-serverless") {
    // Workers cannot safely reuse WebSocket-backed I/O across requests.
    return createDatabase(process.env.DATABASE_URL, {
      driver: "neon-serverless",
    });
  }

  connection ??= createDatabase(process.env.DATABASE_URL);
  return connection;
}
