export async function register() {
  // Prevent Next.js / Node on Windows from entering recursive quicksort/logging loops
  // when standard output or error stream pipes close unexpectedly (e.g. terminal close).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
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

    // Start autonomous background token maintenance daemon (runs across all environments)
    try {
      const { startTokenMaintenanceDaemon } = await import('@/lib/auth/token-maintenance');
      startTokenMaintenanceDaemon();
    } catch (e: any) {
      console.warn('[Instrumentation] Could not initialize token maintenance daemon:', e.message);
    }
  }
}
