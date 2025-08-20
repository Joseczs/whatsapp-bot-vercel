// /api/webhook.js — Vercel Serverless Function (Node 20)
export default function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }
  if (req.method === "POST") {
    // Acuse de recibo para WhatsApp
    return res.status(200).json({ received: true });
  }
  return res.status(405).send("Method Not Allowed");
}
