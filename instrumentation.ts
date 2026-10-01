export function register() {
  // Prevent Next.js / Node on Windows from entering recursive quicksort/logging loops
  // when standard output or error stream pipes close unexpectedly (e.g. terminal close).
  if (typeof process !== 'undefined') {
    process.stdout?.on('error', (err: any) => {
      if (err?.code === 'EPIPE') {
        process.exit(0);
      }
    });

    process.stderr?.on('error', (err: any) => {
      if (err?.code === 'EPIPE') {
        process.exit(0);
      }
    });
  }
}
