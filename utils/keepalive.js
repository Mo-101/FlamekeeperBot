import express from 'express';

export function startKeepAlive() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.get('/', (req, res) => {
    res
      .status(200)
      .send('🔥 FlameKeeperBot is alive on Render | Network: Celo Alfajores');
  });

  app.listen(PORT, () => {
    console.log(`🌍 Keep-alive web server running on port ${PORT}`);
  });
}
