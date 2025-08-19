// api/webhook.js  (Node 18 en Vercel, serverless function)
export default async function handler(req, res) {
  // 1) Verificación inicial (Meta llama con GET para "handshake")
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // 2) Mensajes entrantes (Meta envía POST cuando un usuario escribe)
  if (req.method === 'POST') {
    try {
      const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];

      // Si no hay mensaje, respondemos OK para que Meta no reintente
      if (!msg) return res.status(200).json({ received: true });

      const from = msg.from; // telefono del usuario (ej: 506...)
      // Si envía un "interactivo" (botón/lista)
      if (msg.type === 'interactive') {
        const id =
          msg.interactive?.button_reply?.id ||
          msg.interactive?.list_reply?.id;

        if (id === 'ver_tareas') {
          await sendText(from, '🗂️ Tus tareas: https://tu-enlace-a-tareas.com');
        } else if (id === 'enviar_evidencia') {
          await sendText(from, '📸 Enviá una foto como evidencia por este chat.');
        } else if (id === 'soporte') {
          await sendText(from, '🛟 Soporte: +506 0000 0000');
        } else {
          await sendText(from, 'Escribí *MENU* para ver opciones.');
        }
      }
      // Si envía una imagen (evidencia)
      else if (msg.type === 'image') {
        await sendText(from, '✅ ¡Evidencia recibida! La revisamos y te avisamos.');
        // Aquí luego podrás: 1) Intercambiar media_id por URL 2) Subir a Drive/S3 3) Guardar en Sheets
      }
      // Si escribe texto
      else if (msg.type === 'text') {
        const body = (msg.text?.body || '').trim().toLowerCase();
        if (body === 'menu' || body === 'hola' || body === 'hi' || body === 'ayuda') {
          await sendListMenu(from); // enviamos menú con lista
        } else {
          await sendText(from, 'No te entendí. Escribí *MENU* para ver opciones.');
        }
      }

      return res.status(200).json({ received: true });
    } catch (e) {
      console.error('Webhook error:', e);
      return res.status(200).json({ received: true });
    }
  }

  // Otros métodos no permitidos
  return res.status(405).send('Method Not Allowed');
}

// --- Helpers para enviar mensajes con Cloud API ---
import fetch from 'node-fetch';

async function sendText(to, body) {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_ID}/messages`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    })
  });
  if (!r.ok) console.error('Error sendText:', await r.text());
}

// Menú tipo LISTA (muy útil para baja alfabetización digital)
async function sendListMenu(to) {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Menú principal' },
      body: { text: 'Seleccioná una opción:' },
      footer: { text: 'Demo' },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            title: 'Opciones',
            rows: [
              { id: 'ver_tareas', title: 'Ver mis tareas' },
              { id: 'enviar_evidencia', title: 'Enviar evidencia (foto)' },
              { id: 'soporte', title: 'Hablar con soporte' }
            ]
          }
        ]
      }
    }
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) console.error('Error sendListMenu:', await r.text());
}
