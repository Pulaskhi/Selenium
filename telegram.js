require("dotenv").config();
const axios = require("axios");

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function enviarMensaje(texto) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

  await axios.post(url, {
    chat_id: CHAT_ID,
    text: texto
  });

  console.log("Mensaje enviado a Telegram ✔");
}

enviarMensaje("Hola cuco, esto es una prueba desde .env 😘");
