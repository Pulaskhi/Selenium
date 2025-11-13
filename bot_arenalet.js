require("dotenv").config();
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const URL = process.env.URL;
const REFUGIO = process.env.REFUGIO;
const PERSONAS = Number(process.env.PERSONAS);
const NOCHES = Number(process.env.NOCHES)

// Tus datos
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

  // 1) Habitaciones
  let hab = await driver.findElements(
    By.css("#plazasHabitaciones input[type='checkbox'], #plazasHabitaciones input[type='radio']")
  );
  if (hab.length > 0) {
    await hab[0].click();
    console.log("[INFO] Habitación completa seleccionada.");
    return;
  }

  // 2) Camas
  let camas = await driver.findElements(
    By.css("#plazasCamas input[type='checkbox'], #plazasCamas input[type='radio']")
  );
  if (camas.length >= personas) {
    for (let i = 0; i < personas; i++) {
      await camas[i].click();
      await sleep(250);
    }
    console.log(`[INFO] Seleccionadas ${personas} camas.`);
    return;
  }

  // 3) Refugio entero
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
    await sleep(1500);

    // PASO 1: selección inicial
    await driver.wait(until.elementLocated(By.id("seleccion.idRefugio")), 20000);

    console.log("[INFO] Seleccionando refugio / visitantes / noches...");
    await selectContains(driver, "seleccion.idRefugio", REFUGIO);
    await selectContains(driver, "seleccion.visitantes", PERSONAS);
    await selectContains(driver, "seleccion.noches", NOCHES);

    const dispBtn = await driver.findElement(
      By.css("button[data-button='comprobarDisponibilidad']")
    );
    await dispBtn.click();
    await sleep(1500);

    // PASO 2: día de entrada
    console.log("[INFO] Seleccionando día disponible...");
    const dias = await driver.findElements(
      By.css("td.leyenda_disponible, td.disponible")
    );

    if (dias.length === 0) {
      console.log("❌ No hay días disponibles.");
      return;
    }

    await dias[0].click();
    await sleep(800);

    // PASO 3: ecotasa
    console.log("[INFO] Seleccionando ecotasa...");
    await selectContains(driver, "ecotasa.visitantesMayores", PERSONAS);

    // A veces hay botón "ecotasaSiguiente", a veces no
    try {
      const ecoBtn = await driver.findElement(
        By.css("button[data-button='ecotasaSiguiente']")
      );
      console.log("[INFO] Pulsando botón de ecotasa...");
      await ecoBtn.click();
      await sleep(1000);
    } catch {
      console.log("[INFO] Sin botón de ecotasa, pasando a plazas.");
    }

    // PASO 4: plazas (habitaciones/camas/refugio)
    console.log("[INFO] Seleccionando plazas...");
    await selectBeds(driver, PERSONAS);

    const selBtn = await driver.findElement(
      By.css("button[data-button='seleccionar']")
    );
    await selBtn.click();
    await sleep(1500);

    // PASO 5: formulario responsable
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

    console.log("[INFO] Rellenando formulario...");

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

    // Checkboxes obligatorios
    console.log("[INFO] Marcando checkboxes obligatorias...");
    for (let id of [
      "obligacionesVisitantes",
      "veracidad",
      "covid",
      "condicionesGenerales"
    ]) {
      try {
        const chk = await driver.findElement(By.id(id));
        if (!(await chk.isSelected())) await chk.click();
      } catch {
        console.log("[WARN] No se pudo marcar checkbox:", id);
      }
    }

    // PASO 6: botón "Acceptació de les condicions"
    console.log("[INFO] Buscando botón 'Acceptació de les condicions'...");

    let aceptarCondBtn = null;
    for (let i = 0; i < 20; i++) {
      try {
        aceptarCondBtn = await driver.findElement(
          By.xpath("//button[.//span[contains(.,'Acceptació de les condicions')] or contains(.,'Acceptació de les condicions')]")
        );
        break;
      } catch {
        await sleep(300);
      }
    }

    if (aceptarCondBtn) {
      console.log("[INFO] Pulsando 'Acceptació de les condicions'...");
      await driver.executeScript("arguments[0].scrollIntoView(true);", aceptarCondBtn);
      await sleep(300);
      await aceptarCondBtn.click();
      await sleep(800);
    } else {
      console.log("[WARN] No se encontró el botón 'Acceptació de les condicions'.");
    }

    // PASO 7: popup de condicions generals → botón "Acceptar"
    console.log("[INFO] Buscando popup de condicions generals...");

    let popupBtn = null;
    for (let i = 0; i < 20; i++) {
      try {
        popupBtn = await driver.findElement(
          By.xpath("//button[.//span[contains(.,'Acceptar')] or contains(.,'Acceptar')]")
        );
        break;
      } catch {
        await sleep(300);
      }
    }

    if (popupBtn) {
      console.log("[INFO] Popup encontrado → pulsando 'Acceptar'...");
      await driver.executeScript("arguments[0].scrollIntoView(true);", popupBtn);
      await sleep(300);
      await popupBtn.click();
      await sleep(800);
    } else {
      console.log("[INFO] No apareció el popup de 'Acceptar'.");
    }

    console.log("\n==============================================");
    console.log(" ✔ FORMULARIO COMPLETADO");
    console.log(" ✔ CONDICIONS ACCEPTADES");
    console.log(" 👉 EL BOTÓN 'Pagament' YA DEBERÍA ESTAR ACTIVO");
    console.log(" 👉 AHORA TÚ HACES EL PAGO MANUALMENTE");
    console.log("==============================================\n");

    // Dejamos el navegador abierto para que tú pagues
    await driver.wait(() => false, 999999999);

  } catch (err) {
    console.log("[ERROR BOT]", err);
  }
}

run();
