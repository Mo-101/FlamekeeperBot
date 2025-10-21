(async () => {
  try {
    await import('./bot/index.js');
  } catch (error) {
    console.error('Failed to launch FlameKeeper from bot/index.js');
    console.error(error);
    process.exit(1);
  }
})();
