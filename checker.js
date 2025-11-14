require("dotenv").config();
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");

// =======================
// ENV
// =======================
const URL = process.env.URL;
const REFUGIO = process.env.REFUGIO;
const PERSONAS = Number(process.env.PERSONAS);
const NOCHES = Number(process.env.NOCHES);
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL);

// =======================
// HELPERS
// =======================
async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function telegram(msg) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: msg }
    );
    console.log("📨 Telegram:", msg);
  } catch (e) {
    console.log("❌ Error Telegram:", e.message);
  }
}

async function selectContains(driver, id, text) {
  await driver.executeScript(
    (id, text) => {
      const el = document.getElementById(id);
      if (!el) return;
      const value = [...el.options].find(o =>
        (o.textContent || "").toLowerCase().includes(String(text).toLowerCase())
      );
      if (value) {
        el.value = value.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    id,
    text
  );
  await sleep(300);
}

// =======================
// LECTURA CALENDARIO
// =======================

async function leerCalendario(driver) {
  // Seleccionar todas las tablas del calendario
  const tablas = await driver.findElements(By.css("#calendarioDisponibilidad table.tabla_cal"));

  let diasTotal = [];
  let diasDisponibles = [];

  for (const tabla of tablas) {
    const celdas = await tabla.findElements(By.css("td[id^='dia_']"));

    for (const celda of celdas) {
      const id = await celda.getAttribute("id");     // ej: dia_12_01_2026
      const clase = await celda.getAttribute("class");
      const texto = await celda.getText();

      if (!texto || isNaN(Number(texto))) continue;

      const [, dd, mm, yyyy] = id.split("_");
      const fecha = new Date(`${yyyy}-${mm}-${dd}`);

      const fechaStr = `${dd}/${mm}/${yyyy}`;

      diasTotal.push({ fecha, fechaStr, clase });

      if (clase.includes("disponible")) {
        diasDisponibles.push({ fecha, fechaStr, clase });
      }
    }
  }

  return { diasTotal, diasDisponibles };
}

// =======================
// CHECK
// =======================

async function check() {
  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(new chrome.Options().addArguments("--headless=new"))
    .build();

  try {
    await driver.get(URL);

    await driver.wait(until.elementLocated(By.id("seleccion.idRefugio")), 20000);

    await selectContains(driver, "seleccion.idRefugio", REFUGIO);
    await selectContains(driver, "seleccion.visitantes", PERSONAS);
    await selectContains(driver, "seleccion.noches", NOCHES);

    await driver.findElement(By.css("button[data-button='comprobarDisponibilidad']")).click();
    await sleep(1500);

    // Asegurar que está el DIV del calendario
    await driver.wait(until.elementLocated(By.id("calendarioDisponibilidad")), 15000);

    const { diasTotal, diasDisponibles } = await leerCalendario(driver);

    if (diasTotal.length === 0) {
      console.log("❌ No se pudo leer el calendario");
      return;
    }

    // Ordenar por fecha
    diasTotal.sort((a, b) => a.fecha - b.fecha);
    diasDisponibles.sort((a, b) => a.fecha - b.fecha);

    const ultimoDia = diasTotal.at(-1);
    console.log("📅 Último día cargado:", ultimoDia.fechaStr);

    // Solo guardamos disponibleStr (string)
    const actuales = diasDisponibles.map(d => d.fechaStr);
    console.log("🟢 Disponibles:", actuales);

    // Leer historial
    let prev = [];
    if (fs.existsSync("disponible.json")) {
      prev = JSON.parse(fs.readFileSync("disponible.json"));
    }

    // Detectar nuevos
    const nuevos = actuales.filter(d => !prev.includes(d));

    if (nuevos.length > 0) {
      await telegram(`🔥 NUEVA DISPONIBILIDAD EN ${REFUGIO}:\n${nuevos.join("\n")}`);

      // Lanzar bot de reserva
      exec("node bot_arenalet.js");
    }

    fs.writeFileSync("disponible.json", JSON.stringify(actuales, null, 2));

  } catch (e) {
    console.log("❌ ERROR CHECK:", e.message);
  } finally {
    await driver.quit();
  }
}

// =======================
// LOOP
// =======================

(async () => {
  await telegram("👀 Checker iniciado correctamente");
  console.log("🔁 Iniciando checker...");

  while (true) {
    await check();
    await sleep(CHECK_INTERVAL);
  }
})();
