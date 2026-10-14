// Load .env for the worker and CLI (Next.js loads it for the web app itself).
try {
  process.loadEnvFile?.(".env");
} catch {
  // No .env file: rely on the real environment, as in production.
}
