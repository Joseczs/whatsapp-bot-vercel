// /api/webhook.js  — Vercel Serverless Function (Node 20)
import fetch from "node-fetch";

export default async function handler(req, res) {
  // 1) Verificación del webhook (GET)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // 2) Mensajes entrantes (POST)
  if (req.method === "POST") {
    try {
      // Asegurar parsing de body en Vercel (por si llega como string)
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      const entry = body?.entry?.[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];
      if (!msg) return res.status(200).json({ received: true });

      const from = msg.from;                      // Teléfono del usuario (506...)
      const msgType = msg.type;

      // Botones / Lista
      if (msgType === "interactive") {
        const choice = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
        if (choice === "ver_tareas") {
          await sendText(from, "🗂️ Tus tareas: https://tu-enlace-a-tareas.com");
        } else if (choice === "enviar_evidencia") {
          await sendText(from, "📸 Enviá una foto como evidencia por este chat.");
        } else if (choice === "soporte") {
          await sendText(from, "🛟 Soporte: +506 0000 0000");
        } else {
          await sendText(from, "No te entendí. Escribí *MENU* para ver opciones.");
        }
        return res.status(200).json({ received: true });
      }

      // Imagen (evidencia)
      if (msgType === "image") {
        // TODO: aquí luego canjeás media_id -> URL y subís a Drive/S3
        await sendText(from, "✅ ¡Evidencia recibida! La revisamos y te avisamos.");
        return res.status(200).json({ received: true });
      }

      // Texto
      if (msgType === "text") {
        const text = (msg.text?.body || "").trim().toLowerCase();
        if (["menu", "hola", "hi", "ayuda"].includes(text)) {
          await sendListMenu(from);
        } else {
          await sendText(from, "No te entendí. Escribí *MENU* para ver opciones.");
        }
        return res.status(200).json({ received: true });
      }

      // Otros tipos: acuse de recibo
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(200).json({ received: true });
    }
  }

  return res.status(405).send("Method Not Allowed");
}

// === Helpers ===
async function sendText(to, body) {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_ID}/messages`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body }
    })
  });
  if (!r.ok) console.error("sendText error:", await r.text());
}

async function sendListMenu(to) {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "Menú principal" },
      body: { text: "Seleccioná una opción:" },
      footer: { text: "Demo" },
      action: {
        button: "Ver opciones",
        sections: [
          {
            title: "Opciones",
            rows: [
              { id: "ver_tareas", title: "Ver mis tareas" },
              { id: "enviar_evidencia", title: "Enviar evidencia (foto)" },
              { id: "soporte", title: "Hablar con soporte" }
            ]
          }
        ]
      }
    }
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) console.error("sendListMenu error:", await r.text());
}
