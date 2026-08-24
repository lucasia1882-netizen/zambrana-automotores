#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = path.resolve(SCRIPT_DIR, "..", "vehicles.js");
const DB_FIELDS = [
  "slug", "brand", "model", "full_name", "type", "year", "mileage",
  "transmission", "fuel", "price_amount", "currency", "color", "status",
  "short_description", "description", "highlights", "is_published",
  "is_featured", "featured_order", "legacy_source_path"
];
const NUMBER_FIELDS = new Set(["year", "mileage", "price_amount", "featured_order"]);

function usage() {
  console.log(`Uso:
  node scripts/migrate-vehicles-to-supabase.mjs --source-only
  node scripts/migrate-vehicles-to-supabase.mjs
  node scripts/migrate-vehicles-to-supabase.mjs --apply

Opciones:
  --source-only  Valida vehicles.js sin conectarse a Supabase.
  --apply        Inserta únicamente los slugs faltantes y luego valida todo.
  --source RUTA  Usa otro archivo fuente (por defecto: vehicles.js del proyecto).
  --help         Muestra esta ayuda.

Variables requeridas para consultar/aplicar:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY`);
}

function parseArgs(argv) {
  const result = { apply: false, sourceOnly: false, source: DEFAULT_SOURCE };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") result.apply = true;
    else if (arg === "--source-only") result.sourceOnly = true;
    else if (arg === "--help") result.help = true;
    else if (arg === "--source") {
      if (!argv[index + 1]) throw new Error("Falta la ruta después de --source.");
      result.source = path.resolve(argv[++index]);
    } else throw new Error(`Opción desconocida: ${arg}`);
  }
  if (result.apply && result.sourceOnly) {
    throw new Error("--apply y --source-only no pueden usarse juntos.");
  }
  return result;
}

async function loadLegacyVehicles(sourcePath) {
  const source = await readFile(sourcePath, "utf8");
  const sandbox = { window: Object.create(null) };
  vm.createContext(sandbox);
  new vm.Script(source, { filename: sourcePath }).runInContext(sandbox, { timeout: 2_000 });
  if (!Array.isArray(sandbox.window.zambranaVehicles)) {
    throw new Error("vehicles.js no asignó un array a window.zambranaVehicles.");
  }
  return sandbox.window.zambranaVehicles;
}

function mapVehicle(vehicle, index) {
  return {
    slug: vehicle.slug,
    brand: vehicle.brand,
    model: vehicle.model,
    full_name: vehicle.fullName,
    type: vehicle.type ?? null,
    year: vehicle.year ?? null,
    mileage: vehicle.kms ?? null,
    transmission: vehicle.transmission ?? null,
    fuel: vehicle.fuel ?? null,
    price_amount: vehicle.priceValue ?? null,
    currency: "ARS",
    color: vehicle.color ?? null,
    status: vehicle.status === "Disponible" ? "available" : null,
    short_description: vehicle.shortDescription ?? null,
    description: vehicle.description ?? null,
    highlights: Array.from(vehicle.highlights ?? []),
    is_published: true,
    is_featured: index < 6,
    featured_order: index < 6 ? index + 1 : null,
    legacy_source_path: `vehicles.js#slug=${vehicle.slug};image=${vehicle.image ?? ""}`
  };
}

function validateSource(legacyVehicles) {
  const errors = [];
  const slugCounts = new Map();

  legacyVehicles.forEach((vehicle, index) => {
    const label = `vehículo ${index + 1}`;
    for (const field of ["slug", "brand", "model", "fullName"]) {
      if (typeof vehicle[field] !== "string" || vehicle[field].length === 0) {
        errors.push(`${label}: ${field} debe ser un texto no vacío.`);
      }
    }
    if (typeof vehicle.slug === "string") {
      slugCounts.set(vehicle.slug, (slugCounts.get(vehicle.slug) ?? 0) + 1);
    }
    if (vehicle.status !== "Disponible") errors.push(`${label}: estado no reconocido: ${vehicle.status}.`);
    if (vehicle.year != null && (!Number.isInteger(vehicle.year) || vehicle.year < 1886 || vehicle.year > 2100)) {
      errors.push(`${label}: year inválido.`);
    }
    if (vehicle.kms != null && (!Number.isInteger(vehicle.kms) || vehicle.kms < 0)) {
      errors.push(`${label}: kms inválido.`);
    }
    if (vehicle.priceValue != null && (typeof vehicle.priceValue !== "number" || vehicle.priceValue < 0)) {
      errors.push(`${label}: priceValue inválido.`);
    }
    if (!Array.isArray(vehicle.highlights) || vehicle.highlights.some((item) => typeof item !== "string")) {
      errors.push(`${label}: highlights debe ser un array de textos.`);
    }
  });

  const duplicateSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
  return { errors, duplicateSlugs, uniqueSlugs: slugCounts.size };
}

function printSourceSummary(legacyVehicles, validation) {
  console.log("\n=== Validación de fuente ===");
  console.log(`Vehículos encontrados:      ${legacyVehicles.length}`);
  console.log(`Vehículos válidos:          ${validation.errors.length === 0 ? legacyVehicles.length : legacyVehicles.length - new Set(validation.errors.map((error) => error.split(":")[0])).size}`);
  console.log(`Slugs únicos:               ${validation.uniqueSlugs}`);
  console.log(`Precios null:               ${legacyVehicles.filter((vehicle) => vehicle.priceValue == null).length}`);
  console.log(`Kilometrajes null:          ${legacyVehicles.filter((vehicle) => vehicle.kms == null).length}`);
  console.log(`Slugs duplicados:           ${validation.duplicateSlugs.length}`);
  if (validation.duplicateSlugs.length) console.log(`  ${validation.duplicateSlugs.join("\n  ")}`);
  if (validation.errors.length) console.log(`Errores:\n  ${validation.errors.join("\n  ")}`);
}

function getConfig() {
  const rawUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !serviceRoleKey) {
    throw new Error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  }
  const url = new URL(rawUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error("SUPABASE_URL debe usar http o https.");
  return { baseUrl: url.toString().replace(/\/$/, ""), serviceRoleKey };
}

async function supabaseRequest(config, pathname, options = {}) {
  const response = await fetch(`${config.baseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Accept: "application/json",
      ...(options.headers ?? {})
    }
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase respondió ${response.status}: ${body || response.statusText}`);
  }
  return { data: body ? JSON.parse(body) : null, headers: response.headers };
}

function encodeSlugFilter(slugs) {
  const quoted = slugs.map((slug) => `"${slug.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `in.(${quoted.join(",")})`;
}

async function fetchSourceRows(config, slugs) {
  if (slugs.length === 0) return [];
  const params = new URLSearchParams({ select: DB_FIELDS.join(","), slug: encodeSlugFilter(slugs) });
  const { data } = await supabaseRequest(config, `vehicles?${params}`);
  return data;
}

async function fetchTotalCount(config) {
  const params = new URLSearchParams({ select: "id", limit: "1" });
  const { headers } = await supabaseRequest(config, `vehicles?${params}`, {
    headers: { Prefer: "count=exact", Range: "0-0" }
  });
  const contentRange = headers.get("content-range") ?? "";
  const total = contentRange.split("/")[1];
  return total && total !== "*" ? Number(total) : null;
}

function comparable(field, value) {
  if (NUMBER_FIELDS.has(field)) return value == null ? null : Number(value);
  if (field === "highlights") return Array.isArray(value) ? Array.from(value) : value;
  return value;
}

function rowDifferences(expected, actual) {
  return DB_FIELDS.flatMap((field) => {
    const expectedValue = comparable(field, expected[field]);
    const actualValue = comparable(field, actual[field]);
    return JSON.stringify(expectedValue) === JSON.stringify(actualValue)
      ? []
      : [{ field, expected: expectedValue, actual: actualValue }];
  });
}

function classify(expectedRows, actualRows) {
  const actualBySlug = new Map(actualRows.map((row) => [row.slug, row]));
  const missing = [];
  const existingMatches = [];
  const conflicts = [];
  for (const expected of expectedRows) {
    const actual = actualBySlug.get(expected.slug);
    if (!actual) missing.push(expected);
    else {
      const differences = rowDifferences(expected, actual);
      if (differences.length === 0) existingMatches.push(expected);
      else conflicts.push({ slug: expected.slug, differences });
    }
  }
  return { missing, existingMatches, conflicts };
}

function printDatabaseSummary(classification, totalCount) {
  const existing = classification.existingMatches.length + classification.conflicts.length;
  console.log("\n=== Preflight de Supabase (sin escritura) ===");
  console.log(`Filas totales en vehicles:  ${totalCount ?? "no disponible"}`);
  console.log(`Slugs fuente ya existentes: ${existing}`);
  console.log(`  Coincidencias exactas:    ${classification.existingMatches.length}`);
  console.log(`  Conflictos:               ${classification.conflicts.length}`);
  console.log(`Slugs a insertar:           ${classification.missing.length}`);
  if (classification.existingMatches.length) {
    console.log(`Ya migrados (se omiten):\n  ${classification.existingMatches.map((row) => row.slug).join("\n  ")}`);
  }
  if (classification.conflicts.length) {
    console.log("Conflictos (no se sobrescriben):");
    for (const conflict of classification.conflicts) {
      console.log(`  ${conflict.slug}: ${conflict.differences.map(({ field }) => field).join(", ")}`);
    }
  }
  if (classification.missing.length) {
    console.log(`A insertar:\n  ${classification.missing.map((row) => row.slug).join("\n  ")}`);
  }
}

async function insertMissing(config, rows) {
  if (rows.length === 0) return [];
  const params = new URLSearchParams({ on_conflict: "slug" });
  const { data } = await supabaseRequest(config, `vehicles?${params}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  return data ?? [];
}

function printPostValidation(expectedRows, actualRows, insertedCount, totalCount) {
  const result = classify(expectedRows, actualRows);
  console.log("\n=== Validación posterior vehículo por vehículo ===");
  console.log(`Insertados en esta ejecución: ${insertedCount}`);
  console.log(`Omitidos por slug existente: ${expectedRows.length - insertedCount}`);
  console.log(`Filas totales en vehicles:   ${totalCount ?? "no disponible"}`);
  console.log(`Fuente esperada en la base:  ${expectedRows.length}`);
  console.log(`Coincidencias exactas:       ${result.existingMatches.length}`);
  console.log(`Slugs ausentes:              ${result.missing.length}`);
  console.log(`Registros con diferencias:   ${result.conflicts.length}`);
  if (result.missing.length) console.log(`Ausentes:\n  ${result.missing.map((row) => row.slug).join("\n  ")}`);
  for (const conflict of result.conflicts) {
    console.log(`Diferencias en ${conflict.slug}:`);
    for (const difference of conflict.differences) {
      console.log(`  ${difference.field}: esperado=${JSON.stringify(difference.expected)} actual=${JSON.stringify(difference.actual)}`);
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();

  console.log(`Fuente: ${args.source}`);
  const legacyVehicles = await loadLegacyVehicles(args.source);
  const validation = validateSource(legacyVehicles);
  printSourceSummary(legacyVehicles, validation);

  if (validation.duplicateSlugs.length > 0) {
    throw new Error("Migración cancelada: vehicles.js contiene slugs duplicados.");
  }
  if (validation.errors.length > 0) {
    throw new Error("Migración cancelada: vehicles.js contiene registros inválidos.");
  }

  const expectedRows = legacyVehicles.map(mapVehicle);
  if (args.sourceOnly) {
    console.log("\nResultado: fuente válida; no se consultó ni modificó Supabase.");
    return;
  }

  const config = getConfig();
  const [actualRows, totalCount] = await Promise.all([
    fetchSourceRows(config, expectedRows.map((row) => row.slug)),
    fetchTotalCount(config)
  ]);
  const preflight = classify(expectedRows, actualRows);
  printDatabaseSummary(preflight, totalCount);

  if (!args.apply) {
    console.log("\nResultado: dry-run finalizado; Supabase no fue modificado.");
    console.log("Ejecute nuevamente con --apply para insertar únicamente los registros faltantes.");
    if (preflight.conflicts.length > 0) process.exitCode = 2;
    return;
  }

  console.log("\nAplicando inserción idempotente de los slugs faltantes...");
  const inserted = await insertMissing(config, preflight.missing);
  const [afterRows, afterTotalCount] = await Promise.all([
    fetchSourceRows(config, expectedRows.map((row) => row.slug)),
    fetchTotalCount(config)
  ]);
  const post = printPostValidation(expectedRows, afterRows, inserted.length, afterTotalCount);
  if (post.missing.length || post.conflicts.length) {
    process.exitCode = 2;
    console.log("\nResultado: migración parcial; revise los conflictos informados. No se sobrescribió ningún registro existente.");
  } else {
    console.log("\nResultado: migración y validación completas.");
  }
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exitCode = 1;
});
