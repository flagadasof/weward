require("dotenv").config({
  path: ".env.local",
  override: true,
});

const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Variables manquantes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const TABLES = [
  "reported_profiles",
  "profile_identifiers",
  "profile_identifiers_import",
];

async function getAllRows(table) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(
        `Erreur sur ${table}: ${error.message}`
      );
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    console.log(
      `${table}: ${rows.length} lignes récupérées`
    );

    if (data.length < pageSize) {
      break;
    }
  }

  return rows;
}

function formatIdentifiers(rows) {
  const profiles = new Map();

  for (const row of rows) {
    const profileId = row.profile_id;

    if (!profileId) {
      continue;
    }

    if (!profiles.has(profileId)) {
      profiles.set(profileId, {
        profile_id: profileId,
        pseudos: new Set(),
        names: new Set(),
      });
    }

    const profile = profiles.get(profileId);

    const value = String(row.value ?? "").trim();

    if (!value) {
      continue;
    }

    if (row.identifier_type === "pseudo") {
      profile.pseudos.add(value);
    }

    if (row.identifier_type === "name") {
      profile.names.add(value);
    }
  }

return Array.from(profiles.values())
  .map((profile) => ({
    pseudos: Array.from(profile.pseudos).join(" | "),
    noms_associes: Array.from(profile.names).join(" | "),
  }));
    
}

function formatWorksheet(worksheet) {
  const range = XLSX.utils.decode_range(
    worksheet["!ref"] || "A1"
  );

  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range(range),
  };

  worksheet["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
  };

  worksheet["!cols"] = [];

  for (let column = range.s.c; column <= range.e.c; column++) {
    let maxLength = 12;

    for (
      let row = range.s.r;
      row <= range.e.r;
      row++
    ) {
      const cell = worksheet[
        XLSX.utils.encode_cell({
          r: row,
          c: column,
        })
      ];

      if (cell && cell.v != null) {
        const length = String(cell.v).length;

        if (length > maxLength) {
          maxLength = length;
        }
      }
    }

    worksheet["!cols"][column] = {
      wch: Math.min(maxLength + 2, 60),
    };
  }
}

async function main() {
  console.log("Début de l'export...\n");

  const workbook = XLSX.utils.book_new();

  const exportedTables = {};

  // Export des 3 tables originales
  for (const table of TABLES) {
    console.log(`Export de ${table}...`);

    const rows = await getAllRows(table);

    exportedTables[table] = rows;

    const worksheet = XLSX.utils.json_to_sheet(rows);

    formatWorksheet(worksheet);

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      table.substring(0, 31)
    );

    console.log(
      `✓ ${table}: ${rows.length} lignes\n`
    );
  }

  // Création du 4e onglet lisible
  console.log("Création de profils_associes...");

  const identifiers =
    exportedTables["profile_identifiers"];

  const profilesAssocies =
    formatIdentifiers(identifiers);

  const summaryWorksheet =
    XLSX.utils.json_to_sheet(profilesAssocies);

  formatWorksheet(summaryWorksheet);

  XLSX.utils.book_append_sheet(
    workbook,
    summaryWorksheet,
    "profils_associes"
  );

  console.log(
    `✓ profils_associes: ${profilesAssocies.length} profils\n`
  );

  const output = "weward_export.xlsx";

  XLSX.writeFile(workbook, output);

  console.log("=================================");
  console.log("EXPORT TERMINÉ");
  console.log(`Fichier : ${output}`);
  console.log("=================================");
}

main().catch((error) => {
  console.error("\n❌ Export impossible :");
  console.error(error.message);
  process.exit(1);
});