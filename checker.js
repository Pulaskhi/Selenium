require("dotenv").config();
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const fs = require("fs");
const { exec } = require("child_process");
const axios = require("axios");

// =========================================
// CARGAR VARIABLES
// =========================================
const URL = process.env.URL;
const REFUGIO = process.env.REFUGIO;
const PERSONAS = Number(process.env.PERSONAS);
const NOCHES = Number(process.env.NOCHES);

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL);

// =========================================
// HELPERS
// =========================================

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function enviarTelegram(msg) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: msg
      }
    );
    console.log("📨 Mensaje enviado:", msg);
  } catch (err) {
    console.log("❌ Error enviando mensaje:", err);
  }
}

async function selectContains(driver, selectId, text) {
  await driver.executeScript(
    function (id, value) {
      const el = document.getElementById(id);
      if (!el) return;
      value = String(value).toLowerCase();
      const opt = [...el.options].find(o =>
        (o.textContent || "").toLowerCase().includes(value)
      );
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    selectId,
    text
  );
  await sleep(400);
}

// =========================================
// CHECK DISPONIBILIDAD
// =========================================

async function check() {
  const options = new chrome.Options().addArguments("--headless=new");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    await driver.get(URL);

    await driver.wait(until.elementLocated(By.id("seleccion.idRefugio")), 25000);

    await selectContains(driver, "seleccion.idRefugio", REFUGIO);
    await selectContains(driver, "seleccion.visitantes", PERSONAS);
    await selectContains(driver, "seleccion.noches", NOCHES);

    const dispBtn = await driver.findElement(
      By.css("button[data-button='comprobarDisponibilidad']")
    );
    await dispBtn.click();
    await sleep(1500);

    const disponibles = await driver.findElements(
      By.css("td.leyenda_disponible, td.disponible")
    );

    let dias = [];
    for (let d of disponibles) {
      dias.push((await d.getAttribute("textContent")).trim());
    }

    console.log("📅 Disponibles:", dias);

    let prev = [];
    if (fs.existsSync("disponible.json")) {
      prev = JSON.parse(fs.readFileSync("disponible.json"));
    }

    const nuevos = dias.filter(d => !prev.includes(d));

    if (nuevos.length > 0) {
      await enviarTelegram(`🔥 NUEVA DISPONIBILIDAD EN ${REFUGIO}: ${nuevos.join(", ")}`);

      // Ejecutar el bot_de_reserva
      exec("node bot_arenalet.js");
    }

    fs.writeFileSync("disponible.json", JSON.stringify(dias, null, 2));

  } catch (err) {
    console.log("❌ ERROR CHECK:", err);
  } finally {
    await driver.quit();
  }
}

(async () => {
  await enviarTelegram("👀 Monitor iniciado con .env");
  console.log("🔍 Revisando cada", CHECK_INTERVAL / 1000, "segundos");

  while (true) {
    await check();
    await sleep(CHECK_INTERVAL);
  }
})();
