const fs = require("fs");
const path = require("path");
const mysql = require("../backend/node_modules/mysql2/promise");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const csvPath = path.join(__dirname, "..", "data", "catalog_120.csv");
  const rows = fs.readFileSync(csvPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map(line => {
      const m = line.match(/^"([^"]+)","(.*)"$/);
      return m ? { file_name: m[1], text: m[2] } : null;
    })
    .filter(Boolean);

  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [existing] = await db.query("SELECT name FROM medicines");
  const existingNames = new Set(existing.map(x => x.name.toLowerCase()));

  const categories = {
    pain: 1,
    antibiotic: 2,
    vitamin: 3,
    diabetes: 4,
    cardiac: 5,
    skin: 6
  };

  function category(name) {
    const n = name.toLowerCase();

    if (/vitamin|calcium|d3|minerals|iron|folic/.test(n)) return categories.vitamin;
    if (/azith|amox|cef|mox|cillin|antibiotic/.test(n)) return categories.antibiotic;
    if (/metformin|glimepiride|glyc|diabet|sitagliptin/.test(n)) return categories.diabetes;
    if (/amlod|atorva|telmi|arbitel|cardio|losartan|enalapril/.test(n)) return categories.cardiac;
    if (/cream|gel|ointment|adapal|acne|derma|skin/.test(n)) return categories.skin;
    return categories.pain;
  }

  function price(name) {
    const n = name.toLowerCase();

    if (/gel|cream|ointment/.test(n)) return 149;
    if (/syrup|suspension/.test(n)) return 99;
    if (/capsule/.test(n)) return 129;
    return 79;
  }

  function prescription(name) {
    const n = name.toLowerCase();

    return /antibiotic|azith|amox|cef|cillin|alprax|clonaz|tramadol|pregabalin|isotrin|retinoid|adapal|atorva|metformin|amlod|telmi|arbitel/.test(n) ? 1 : 0;
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row.text.trim();

    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }

    const imageUrl = `/medicine-images/${row.file_name}`;

    await db.execute(
      `INSERT INTO medicines
       (category_id, name, generic_name, manufacturer, description,
        price, stock, prescription_required, image_url, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        category(name),
        name,
        "See product packaging",
        "Demo Catalog",
        "Product image from the Drug Packaging Image Dataset. Academic project catalog item.",
        price(name),
        50,
        prescription(name),
        imageUrl
      ]
    );

    existingNames.add(name.toLowerCase());
    inserted++;
  }

  await db.end();

  console.log("");
  console.log("========================================");
  console.log("PharmaFlow catalog import complete");
  console.log("========================================");
  console.log(`CSV products: ${rows.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped existing: ${skipped}`);
  console.log("========================================");
}

main().catch(err => {
  console.error("IMPORT FAILED:", err.message);
  process.exit(1);
});

