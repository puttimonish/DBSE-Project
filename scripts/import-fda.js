const fs = require("fs");
const mysql = require("mysql2/promise");

async function main() {
  const raw = fs.readFileSync("./data/ndc_dataset.json", "utf8").trim();
  const parsed = JSON.parse(raw);

  const records = Array.isArray(parsed)
    ? parsed
    : (parsed.results || []);

  console.log("FDA records loaded:", records.length);

  const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root2",
    database: "pharmaflow"
  });

  const categories = {
    "Pain Relief": 1,
    "Antibiotics": 2,
    "Vitamins": 3,
    "Diabetes": 4,
    "Cardiac Care": 5,
    "Skin Care": 6
  };

  function chooseCategory(record) {
    const text = [
      record.brand_name || "",
      record.generic_name || "",
      record.dosage_form || "",
      record.pharm_class || ""
    ].join(" ").toLowerCase();

    if (/antibiotic|azithromycin|amoxicillin|doxycycline|cephalexin|ciprofloxacin|penicillin/.test(text))
      return categories["Antibiotics"];

    if (/vitamin|mineral|cholecalciferol|ergocalciferol|cyanocobalamin|multivitamin/.test(text))
      return categories["Vitamins"];

    if (/metformin|insulin|glucose|diabetes|glimepiride|sitagliptin/.test(text))
      return categories["Diabetes"];

    if (/atorvastatin|rosuvastatin|simvastatin|cardiac|heart|cholesterol|hypertension|blood pressure/.test(text))
      return categories["Cardiac Care"];

    if (/adapalene|tretinoin|clindamycin.*gel|acne|dermat|skin|cream|ointment/.test(text))
      return categories["Skin Care"];

    if (/pain|analgesic|ibuprofen|acetaminophen|paracetamol|naproxen|aspirin/.test(text))
      return categories["Pain Relief"];

    return categories["Pain Relief"];
  }

  let imported = 0;
  let skipped = 0;

  for (const record of records.slice(0, 500)) {
    const name = String(record.brand_name || "").trim();
    const generic = String(record.generic_name || "").trim();

    if (!name || !generic) {
      skipped++;
      continue;
    }

    const manufacturer =
      record.openfda &&
      Array.isArray(record.openfda.manufacturer_name)
        ? String(record.openfda.manufacturer_name[0] || "").trim()
        : "";

    const finalManufacturer =
      manufacturer || "FDA Listed Manufacturer";

    const dosage = String(record.dosage_form || "").trim();

    const route = Array.isArray(record.route)
      ? record.route.join(", ")
      : String(record.route || "").trim();

    const description =
      "FDA NDC catalog record. " +
      (dosage ? "Dosage form: " + dosage + ". " : "") +
      (route ? "Route: " + route + ". " : "") +
      "Generic: " + generic + ".";

    const categoryId = chooseCategory(record);

    // Demo inventory values only.
    const price = (40 + (imported % 17) * 10).toFixed(2);
    const stock = 20 + (imported % 5) * 10;

    const [existing] = await db.execute(
      `SELECT id FROM medicines
       WHERE LOWER(name)=LOWER(?)
       AND LOWER(COALESCE(manufacturer,''))=LOWER(?)
       LIMIT 1`,
      [
        name.substring(0, 160),
        finalManufacturer.substring(0, 160)
      ]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.execute(
      `INSERT INTO medicines
       (category_id, name, generic_name, manufacturer, description,
        price, stock, prescription_required, image_url, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, 1)`,
      [
        categoryId,
        name.substring(0, 160),
        generic.substring(0, 160),
        finalManufacturer.substring(0, 160),
        description,
        price,
        stock
      ]
    );

    imported++;
  }

  console.log("");
  console.log("====================================");
  console.log("FDA IMPORT COMPLETE");
  console.log("====================================");
  console.log("FDA records scanned :", Math.min(records.length, 500));
  console.log("Medicines imported  :", imported);
  console.log("Records skipped     :", skipped);
  console.log("====================================");

  await db.end();
}

main().catch(err => {
  console.error("IMPORT FAILED");
  console.error(err.message);
  process.exit(1);
});
