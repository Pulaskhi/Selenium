// bot_arenalet.js
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const URL = "https://www.caib.es/albergsfront";

const PERSONAS = 5;
const NOCHES = 1;
const REFUGIO = "Lavanor";

const USER = {
  nombre: "Marcos",
  primerApellido: "González",
  segundoApellido: "Morcillo",
  fechaNacimiento: "31/10/1997",
  nacionalidad: "108",
  tipoDocumento: "NIF",
  numeroDocumento: "43216840R",
  fechaExpedicion: "04/07/1997",
  direccion: "Lledoner nº3 ·C",
  municipio: "Palma",
  cp: "07008",
  provincia: "Islas Baleares",
  telefono1: "622074344",
  telefono2: "",
  email: "mgmdestral@gmail.com"
};

// ==================================================================================
// HELPERS
// ==================================================================================

async function selectContains(driver, selectId, text) {
  await driver.executeScript(
    function (id, value) {
      const el = document.getElementById(id);
      if (!el) return;
      value = String(value).toLowerCase();
      const opt = [...el.options].find(o =>
        o.textContent.toLowerCase().includes(value)
      );
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    selectId,
    text
  );
  await sleep(600);
}

async function selectValue(driver, selectId, value) {
  await driver.executeScript(
    function (id, val) {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = String(val);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    selectId,
    value
  );
  await sleep(600);
}

async function selectBeds(driver, personas) {
  console.log("[INFO] Seleccionando plazas…");

  // Primero habitaciones (lo más común en Arenalet)
  let hab = await driver.findElements(
    By.css("#plazasHabitaciones input[type='checkbox'], #plazasHabitaciones input[type='radio']")
  );
  if (hab.length > 0) {
    await hab[0].click();
    console.log("[INFO] Habitación completa seleccionada.");
    return;
  }

  // Luego camas sueltas
  let camas = await driver.findElements(
    By.css("#plazasCamas input[type='checkbox'], #plazasCamas input[type='radio']")
  );
  if (camas.length >= personas) {
    for (let i = 0; i < personas; i++) {
      await camas[i].click();
      await sleep(200);
    }
    console.log(`[INFO] Seleccionadas ${personas} camas.`);
    return;
  }

  // Finalmente refugio completo
  let ref = await driver.findElements(
    By.css("#plazasRefugio input[type='checkbox'], #plazasRefugio input[type='radio']")
  );
  if (ref.length > 0) {
    await ref[0].click();
    console.log("[INFO] Refugio completo seleccionado.");
    return;
  }

  console.log("[WARN] No se pudo seleccionar ninguna plaza.");
}

// ==================================================================================
// MAIN
// ==================================================================================

async function run() {
  const options = new chrome.Options();
  options.excludeSwitches("enable-logging");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    console.log("[INFO] Abriendo web...");
    await driver.get(URL);
    await sleep(2000);

    // PASO 1
    await driver.wait(until.elementLocated(By.id("seleccion.idRefugio")), 20000);

    console.log("[INFO] Seleccionando REFUGIO...");
    await selectContains(driver, "seleccion.idRefugio", REFUGIO);

    console.log("[INFO] Seleccionando VISITANTES...");
    await selectContains(driver, "seleccion.visitantes", PERSONAS);

    console.log("[INFO] Seleccionando NOCHES...");
    await selectContains(driver, "seleccion.noches", NOCHES);

    const dispBtn = await driver.findElement(By.css("button[data-button='comprobarDisponibilidad']"));
    await dispBtn.click();
    await sleep(1500);

    // PASO 2
    console.log("[INFO] Seleccionando día...");
    const dias = await driver.findElements(By.css("td.leyenda_disponible, td.disponible"));

    if (dias.length === 0) {
      console.log("❌ No hay días disponibles.");
      return;
    }

    await dias[0].click();
    await sleep(1000);

    // PASO 3 - ECOTASA
    console.log("[INFO] Seleccionando ecotasa...");
    await selectContains(driver, "ecotasa.visitantesMayores", PERSONAS);
    await sleep(800);

    // Detectar si hay botón ecotasaSiguiente
    let ecoBtnExists = false;
    try {
      await driver.findElement(By.css("button[data-button='ecotasaSiguiente']"));
      ecoBtnExists = true;
      console.log("[INFO] Botón ecotasaSiguiente encontrado.");
    } catch {
      console.log("[INFO] No existe botón ecotasaSiguiente, continuando al paso de plazas.");
    }

    if (ecoBtnExists) {
      const ecoBtn = await driver.findElement(By.css("button[data-button='ecotasaSiguiente']"));
      await ecoBtn.click();
      await sleep(1200);
    }

    // PASO 4 - PLAZAS
    console.log("[INFO] Seleccionando plazas...");
    await selectBeds(driver, PERSONAS);
    await sleep(800);

    const selBtn = await driver.findElement(By.css("button[data-button='seleccionar']"));
    await selBtn.click();
    await sleep(1500);

    // PASO 5 - FORMULARIO
    async function write(id, val) {
      if (!val) return;
      try {
        const el = await driver.findElement(By.id(id));
        await el.clear();
        await el.sendKeys(val);
      } catch {
        console.log("[WARN] Campo no encontrado:", id);
      }
    }

    console.log("[INFO] Rellenando datos personales...");

    await write("responsable.nombre", USER.nombre);
    await write("responsable.primerApellido", USER.primerApellido);
    await write("responsable.segundoApellido", USER.segundoApellido);
    await write("responsable.fechaNacimiento", USER.fechaNacimiento);

    await selectValue(driver, "responsable.nacionalidad", USER.nacionalidad);
    await selectValue(driver, "responsable.tipoDocumento", USER.tipoDocumento);

    await write("responsable.numeroDocumento", USER.numeroDocumento);
    await write("responsable.fechaExpedicionDocumento", USER.fechaExpedicion);

    await write("domicilio.domicilio", USER.direccion);
    await write("domicilio.localidad", USER.municipio);
    await write("domicilio.codigoPostal", USER.cp);
    await write("domicilio.region", USER.provincia);

    await write("contacto.telefono1", USER.telefono1);
    await write("contacto.telefono2", USER.telefono2);
    await write("contacto.email", USER.email);

    for (let id of [
      "obligacionesVisitantes",
      "veracidad",
      "covid",
      "condicionesGenerales"
    ]) {
      try {
        const chk = await driver.findElement(By.id(id));
        if (!(await chk.isSelected())) await chk.click();
      } catch {}
    }

    // PASO 6 - BOTÓN PAS SEGÜENT
    console.log("[INFO] Buscando botón 'Pas següent'.");

    let nextBtn = await driver.findElement(By.css("button[data-button='seleccionar']"));

    await driver.executeScript("arguments[0].scrollIntoView(true);", nextBtn);
    await sleep(300);

    await nextBtn.click();

    console.log("=================================================");
    console.log(" ✔ FORMULARIO COMPLETADO");
    console.log(" ✔ TODO AUTOMATIZADO HASTA EL PAGO");
    console.log(" 👉 AHORA COMPLETA EL PAGO MANUALMENTE");
    console.log("=================================================");

    await driver.wait(() => false, 999999999);

  } catch (err) {
    console.log("[ERROR]", err);
  }
}

run();
