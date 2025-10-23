export default function handler(req, res) {
  const ok = Boolean(process.env.OPENAI_API_KEY);
  res.status(ok ? 200 : 500).json({ ok, hasKey: ok });
}
