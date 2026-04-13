import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

/** Minimal health for Docker / load balancers; mov.4 layers clean-arch + structured logs. */
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(port, host, () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg: 'api.listen', host, port }));
});
