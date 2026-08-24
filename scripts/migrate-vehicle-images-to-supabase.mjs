#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_SOURCE = path.join(PROJECT_ROOT, "vehicles.js");
const BUCKET = "vehicle-images";
const MAX_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Map([
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
const IMAGE_FIELDS = [
  "id", "vehicle_id", "storage_path", "position", "is_cover", "alt_text",
  "mime_type", "width", "height", "size_bytes"
];

function usage() {
  console.log(`Uso:
  node scripts/migrate-vehicle-images-to-supabase.mjs --source-only
  node scripts/migrate-vehicle-images-to-supabase.mjs
  node scripts/migrate-vehicle-images-to-supabase.mjs --apply

Opciones:
  --source-only  Audita solamente las referencias y archivos locales.
  --apply        Sube e inserta únicamente elementos faltantes y compatibles.
  --source RUTA  Usa otro vehicles.js (por defecto, el del proyecto).
  --help         Muestra esta ayuda.

Variables requeridas para consultar o aplicar:
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
  const vehicles = sandbox.window.zambranaVehicles;
  if (!Array.isArray(vehicles)) {
    throw new Error("vehicles.js no asignó un array a window.zambranaVehicles.");
  }
  return vehicles;
}

function uniqueVehiclePaths(vehicle) {
  const paths = [vehicle.image, ...Array.from(vehicle.gallery ?? [])];
  return [...new Set(paths)];
}

function readDimensions(buffer, mimeType) {
  if (mimeType === "image/png") {
    if (buffer.length < 24 || buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
      throw new Error("la firma no corresponde a PNG");
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (mimeType === "image/jpeg") {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      throw new Error("la firma no corresponde a JPEG");
    }
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset++];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (startOfFrame.has(marker)) {
        return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
      }
      offset += segmentLength;
    }
    throw new Error("no se encontraron dimensiones JPEG");
  }

  if (mimeType === "image/webp") {
    if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
      throw new Error("la firma no corresponde a WEBP");
    }
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    }
    if (chunk === "VP8 ") {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      if (buffer[20] !== 0x2f) throw new Error("cabecera VP8L inválida");
      const bits = buffer.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    throw new Error(`subformato WEBP no admitido: ${chunk}`);
  }

  throw new Error(`tipo no admitido: ${mimeType}`);
}

async function inspectLocalImage(sourcePath) {
  if (typeof sourcePath !== "string" || sourcePath.length === 0) {
    return { sourcePath, errors: ["ruta vacía o inválida"] };
  }
  const absolutePath = path.resolve(PROJECT_ROOT, sourcePath);
  const relative = path.relative(PROJECT_ROOT, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { sourcePath, absolutePath, errors: ["la ruta sale del proyecto"] };
  }
  const extension = path.extname(sourcePath).toLowerCase();
  const mimeType = SUPPORTED_EXTENSIONS.get(extension) ?? null;
  const errors = [];
  if (!mimeType) errors.push(`formato no admitido: ${extension || "sin extensión"}`);

  let fileStat;
  try {
    fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) errors.push("la ruta no es un archivo");
  } catch (error) {
    if (error.code === "ENOENT") errors.push("archivo faltante");
    else errors.push(`no se pudo leer el archivo: ${error.message}`);
  }

  let dimensions = null;
  if (fileStat?.isFile() && mimeType) {
    if (fileStat.size > MAX_BYTES) errors.push("archivo mayor a 10 MB");
    try {
      dimensions = readDimensions(await readFile(absolutePath), mimeType);
      if (dimensions.width <= 0 || dimensions.height <= 0) errors.push("dimensiones inválidas");
    } catch (error) {
      errors.push(`archivo incompatible con su extensión: ${error.message}`);
    }
  }

  return {
    sourcePath,
    absolutePath,
    extension,
    mimeType,
    sizeBytes: fileStat?.isFile() ? fileStat.size : null,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    exists: Boolean(fileStat?.isFile()),
    overLimit: Boolean(fileStat?.isFile() && fileStat.size > MAX_BYTES),
    errors
  };
}

async function buildLocalAudit(legacyVehicles) {
  const slugCounts = new Map();
  const sourceOwners = new Map();
  const vehicles = [];
  for (const vehicle of legacyVehicles) {
    slugCounts.set(vehicle.slug, (slugCounts.get(vehicle.slug) ?? 0) + 1);
    const sourcePaths = uniqueVehiclePaths(vehicle);
    for (const sourcePath of sourcePaths) {
      const owners = sourceOwners.get(sourcePath) ?? [];
      owners.push(vehicle.slug);
      sourceOwners.set(sourcePath, owners);
    }
    const images = await Promise.all(sourcePaths.map(inspectLocalImage));
    const conflicts = [];
    if (typeof vehicle.slug !== "string" || !vehicle.slug) conflicts.push("slug inválido");
    if (typeof vehicle.fullName !== "string" || !vehicle.fullName) conflicts.push("fullName inválido");
    if (typeof vehicle.image !== "string" || !vehicle.image) conflicts.push("image inválida");
    if (!Array.isArray(vehicle.gallery)) conflicts.push("gallery no es un array");
    if (vehicle.model?.toLowerCase().includes("c3") && sourcePaths.some((item) => item.replace(/\\/g, "/").startsWith("assets/vehiculos/titano/"))) {
      conflicts.push("C3_TITANO_REFERENCE: las referencias del Citroën C3 apuntan a assets/vehiculos/titano");
    }
    for (const image of images) {
      conflicts.push(...image.errors.map((error) => `${image.sourcePath}: ${error}`));
    }
    vehicles.push({ legacy: vehicle, sourcePaths, images, conflicts });
  }

  const duplicateSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
  const sharedPaths = [...sourceOwners.entries()].filter(([, owners]) => new Set(owners).size > 1);
  for (const [sourcePath, owners] of sharedPaths) {
    for (const owner of new Set(owners)) {
      vehicles.find((item) => item.legacy.slug === owner)?.conflicts.push(
        `ruta compartida por varios vehículos: ${sourcePath}`
      );
    }
  }
  return { vehicles, duplicateSlugs, sourceOwners, sharedPaths };
}

function printLocalAudit(audit) {
  const allImages = audit.vehicles.flatMap((vehicle) => vehicle.images);
  const formats = new Map();
  for (const image of allImages) {
    const key = image.extension || "sin extensión";
    formats.set(key, (formats.get(key) ?? 0) + 1);
  }
  console.log("\n=== Preflight local ===");
  console.log(`Vehículos analizados:       ${audit.vehicles.length}`);
  console.log(`Rutas únicas detectadas:    ${audit.sourceOwners.size}`);
  console.log(`Imágenes existentes:        ${allImages.filter((image) => image.exists).length}`);
  console.log(`Imágenes faltantes:         ${allImages.filter((image) => !image.exists).length}`);
  console.log(`Archivos mayores a 10 MB:   ${allImages.filter((image) => image.overLimit).length}`);
  console.log(`Slugs duplicados:           ${audit.duplicateSlugs.length}`);
  console.log(`Rutas entre autos repetidas:${audit.sharedPaths.length}`);
  console.log(`Formatos detectados:        ${[...formats].map(([ext, count]) => `${ext}=${count}`).join(", ")}`);
  for (const vehicle of audit.vehicles.filter((item) => item.conflicts.length)) {
    console.log(`Conflicto local ${vehicle.legacy.slug}:`);
    for (const conflict of vehicle.conflicts) console.log(`  - ${conflict}`);
  }
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

async function request(config, relativeUrl, options = {}) {
  const response = await fetch(`${config.baseUrl}${relativeUrl}`, {
    ...options,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Accept: "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${relativeUrl} respondió ${response.status}: ${text || response.statusText}`);
  return text ? JSON.parse(text) : null;
}

function encodeInFilter(values) {
  const quoted = values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `in.(${quoted.join(",")})`;
}

async function fetchVehicles(config, slugs) {
  const params = new URLSearchParams({ select: "id,slug,full_name", slug: encodeInFilter(slugs) });
  return request(config, `/rest/v1/vehicles?${params}`);
}

async function fetchVehicleImages(config, vehicleIds) {
  if (!vehicleIds.length) return [];
  const params = new URLSearchParams({ select: IMAGE_FIELDS.join(","), vehicle_id: encodeInFilter(vehicleIds) });
  return request(config, `/rest/v1/vehicle_images?${params}`);
}

function groupRowsByVehicle(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.vehicle_id) ?? [];
    group.push(row);
    groups.set(row.vehicle_id, group);
  }
  return groups;
}

async function listStorageFolder(config, vehicleId) {
  const objects = await request(config, `/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: `vehicles/${vehicleId}`, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } })
  });
  return objects.map((object) => ({ ...object, storagePath: `vehicles/${vehicleId}/${object.name}` }));
}

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`UUID inválido: ${uuid}`);
  return Buffer.from(hex, "hex");
}

function uuidV5(namespaceUuid, name) {
  const hash = createHash("sha1").update(uuidToBytes(namespaceUuid)).update(name, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function expectedImageRow(vehicle, localImage, position) {
  const id = uuidV5(vehicle.id, localImage.sourcePath);
  const storagePath = `vehicles/${vehicle.id}/${id}${localImage.extension}`;
  return {
    id,
    vehicle_id: vehicle.id,
    storage_path: storagePath,
    position,
    is_cover: position === 0,
    alt_text: `${vehicle.full_name} - foto ${position + 1}`,
    mime_type: localImage.mimeType,
    width: localImage.width,
    height: localImage.height,
    size_bytes: localImage.sizeBytes,
    sourcePath: localImage.sourcePath,
    absolutePath: localImage.absolutePath
  };
}

function databaseDifferences(expected, actual) {
  return IMAGE_FIELDS.flatMap((field) => {
    let expectedValue = expected[field];
    let actualValue = actual[field];
    if (["position", "width", "height", "size_bytes"].includes(field)) {
      expectedValue = expectedValue == null ? null : Number(expectedValue);
      actualValue = actualValue == null ? null : Number(actualValue);
    }
    return JSON.stringify(expectedValue) === JSON.stringify(actualValue) ? [] : [field];
  });
}

function storageDifferences(expected, object) {
  const metadata = object?.metadata ?? {};
  const differences = [];
  if (Number(metadata.size) !== Number(expected.size_bytes)) differences.push("size");
  const objectMime = metadata.mimetype ?? metadata.contentType ?? null;
  if (objectMime !== expected.mime_type) differences.push("mime_type");
  return differences;
}

async function buildRemotePreflight(config, localAudit) {
  const slugs = localAudit.vehicles.map((item) => item.legacy.slug);
  const dbVehicles = await fetchVehicles(config, slugs);
  const dbBySlug = new Map(dbVehicles.map((vehicle) => [vehicle.slug, vehicle]));
  const dbImages = await fetchVehicleImages(config, dbVehicles.map((vehicle) => vehicle.id));
  const rowsByVehicle = groupRowsByVehicle(dbImages);
  const storageEntries = await Promise.all(dbVehicles.map(async (vehicle) => [vehicle.id, await listStorageFolder(config, vehicle.id)]));
  const storageByVehicle = new Map(storageEntries);
  const results = [];

  for (const localVehicle of localAudit.vehicles) {
    const databaseVehicle = dbBySlug.get(localVehicle.legacy.slug);
    const conflicts = [...localVehicle.conflicts];
    if (!databaseVehicle) conflicts.push("vehículo no encontrado en Supabase");
    const expected = databaseVehicle
      ? localVehicle.images.map((image, index) => expectedImageRow(databaseVehicle, image, index))
      : [];
    const currentRows = databaseVehicle ? (rowsByVehicle.get(databaseVehicle.id) ?? []) : [];
    const currentObjects = databaseVehicle ? (storageByVehicle.get(databaseVehicle.id) ?? []) : [];
    const expectedIds = new Set(expected.map((image) => image.id));
    const expectedPaths = new Set(expected.map((image) => image.storage_path));
    const unexpectedRows = currentRows.filter((row) => !expectedIds.has(row.id));
    const unexpectedObjects = currentObjects.filter((object) => !expectedPaths.has(object.storagePath));
    if (unexpectedRows.length) conflicts.push(`${unexpectedRows.length} fila(s) vehicle_images no pertenecen al manifiesto determinístico`);
    if (unexpectedObjects.length) conflicts.push(`${unexpectedObjects.length} objeto(s) Storage no pertenecen al manifiesto determinístico`);

    const rowById = new Map(currentRows.map((row) => [row.id, row]));
    const objectByPath = new Map(currentObjects.map((object) => [object.storagePath, object]));
    const actions = [];
    let alreadyCorrect = 0;
    for (const image of expected) {
      const row = rowById.get(image.id);
      const object = objectByPath.get(image.storage_path);
      const rowDiffs = row ? databaseDifferences(image, row) : [];
      const objectDiffs = object ? storageDifferences(image, object) : [];
      if (rowDiffs.length) conflicts.push(`${image.sourcePath}: metadata DB incompatible (${rowDiffs.join(", ")})`);
      if (objectDiffs.length) conflicts.push(`${image.sourcePath}: metadata Storage incompatible (${objectDiffs.join(", ")})`);
      if (rowDiffs.length || objectDiffs.length) continue;
      if (row && object) alreadyCorrect += 1;
      else actions.push({ image, needsUpload: !object, needsInsert: !row });
    }
    results.push({
      slug: localVehicle.legacy.slug,
      vehicle: databaseVehicle,
      expected,
      currentRows,
      currentObjects,
      alreadyCorrect,
      actions,
      conflicts: [...new Set(conflicts)]
    });
  }
  return { dbVehicles, dbImages, results };
}

function printRemotePreflight(preflight) {
  const uploadActions = preflight.results.flatMap((result) => result.actions.filter((action) => action.needsUpload));
  const insertActions = preflight.results.flatMap((result) => result.actions.filter((action) => action.needsInsert));
  const correct = preflight.results.reduce((sum, result) => sum + result.alreadyCorrect, 0);
  const conflicted = preflight.results.filter((result) => result.conflicts.length);
  console.log("\n=== Preflight Supabase/Storage (sin escritura) ===");
  console.log(`Vehículos encontrados:      ${preflight.dbVehicles.length}`);
  console.log(`Filas vehicle_images:       ${preflight.dbImages.length}`);
  console.log(`Imágenes ya correctas:      ${correct}`);
  console.log(`Archivos a subir/reparar:   ${uploadActions.length}`);
  console.log(`Filas a insertar/reparar:   ${insertActions.length}`);
  console.log(`Vehículos con conflictos:   ${conflicted.length}`);
  for (const result of preflight.results) {
    console.log(`\n${result.slug}: esperadas=${result.expected.length}, correctas=${result.alreadyCorrect}, acciones=${result.actions.length}, conflictos=${result.conflicts.length}`);
    for (const conflict of result.conflicts) console.log(`  CONFLICTO: ${conflict}`);
    if (!result.conflicts.length) {
      for (const action of result.actions) {
        const operations = [action.needsUpload ? "SUBIR" : null, action.needsInsert ? "INSERTAR" : null].filter(Boolean).join("+");
        console.log(`  ${operations}: ${action.image.sourcePath} -> ${action.image.storage_path}`);
      }
    }
  }
}

async function uploadObject(config, image) {
  const encodedPath = image.storage_path.split("/").map(encodeURIComponent).join("/");
  const buffer = await readFile(image.absolutePath);
  return request(config, `/storage/v1/object/${BUCKET}/${encodedPath}`, {
    method: "POST",
    headers: { "Content-Type": image.mime_type, "x-upsert": "false" },
    body: buffer
  });
}

async function insertImageRows(config, rows) {
  if (!rows.length) return [];
  const params = new URLSearchParams({ on_conflict: "id" });
  return request(config, `/rest/v1/vehicle_images?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows.map(({ sourcePath, absolutePath, ...row }) => row))
  });
}

async function deleteObjects(config, storagePaths) {
  if (!storagePaths.length) return;
  await request(config, `/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: storagePaths })
  });
}

async function applyPreflight(config, preflight) {
  const outcome = { uploaded: 0, inserted: 0, omitted: 0, errors: [] };
  for (const result of preflight.results) {
    if (result.conflicts.length) {
      outcome.omitted += result.expected.length || result.currentRows.length;
      continue;
    }
    const uploadedThisVehicle = [];
    const rollbackCandidates = [];
    try {
      for (const action of result.actions.filter((item) => item.needsUpload)) {
        await uploadObject(config, action.image);
        uploadedThisVehicle.push(action.image.storage_path);
        if (action.needsInsert) rollbackCandidates.push(action.image.storage_path);
        outcome.uploaded += 1;
      }
      const rowsToInsert = result.actions.filter((item) => item.needsInsert).map((item) => item.image);
      const inserted = await insertImageRows(config, rowsToInsert);
      outcome.inserted += inserted.length;
      outcome.omitted += result.alreadyCorrect;
    } catch (error) {
      outcome.errors.push(`${result.slug}: ${error.message}`);
      if (rollbackCandidates.length) {
        try {
          await deleteObjects(config, rollbackCandidates);
          outcome.uploaded -= rollbackCandidates.length;
        } catch (rollbackError) {
          outcome.errors.push(`${result.slug}: falló la compensación de Storage: ${rollbackError.message}`);
        }
      }
      outcome.omitted += result.expected.length - uploadedThisVehicle.length;
    }
  }
  return outcome;
}

function summarizeFinal(preflight, outcome) {
  let complete = 0;
  let partial = 0;
  let omittedVehicles = 0;
  for (const result of preflight.results) {
    const totalCorrect = result.alreadyCorrect;
    if (!result.conflicts.length && result.actions.length === 0 && totalCorrect === result.expected.length) complete += 1;
    else if (totalCorrect > 0) partial += 1;
    else omittedVehicles += 1;
  }
  console.log("\n=== Resultado global ===");
  console.log(`Vehículos completos:        ${complete}`);
  console.log(`Vehículos parciales:        ${partial}`);
  console.log(`Vehículos omitidos:         ${omittedVehicles}`);
  console.log(`Imágenes subidas:           ${outcome.uploaded}`);
  console.log(`Filas insertadas:           ${outcome.inserted}`);
  console.log(`Imágenes omitidas:          ${outcome.omitted}`);
  console.log(`Errores de ejecución:       ${outcome.errors.length}`);
  console.log(`Conflictos:                 ${preflight.results.reduce((sum, result) => sum + result.conflicts.length, 0)}`);
  for (const error of outcome.errors) console.log(`  ERROR: ${error}`);
  return { complete, partial, omittedVehicles };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  console.log(`Fuente: ${args.source}`);
  const legacyVehicles = await loadLegacyVehicles(args.source);
  const localAudit = await buildLocalAudit(legacyVehicles);
  printLocalAudit(localAudit);
  if (localAudit.duplicateSlugs.length) throw new Error("Migración cancelada: vehicles.js contiene slugs duplicados.");
  if (args.sourceOnly) {
    console.log("\nResultado: auditoría local finalizada; no se consultó ni modificó Supabase.");
    if (localAudit.vehicles.some((vehicle) => vehicle.conflicts.length)) process.exitCode = 2;
    return;
  }

  const config = getConfig();
  const preflight = await buildRemotePreflight(config, localAudit);
  printRemotePreflight(preflight);
  if (!args.apply) {
    console.log("\nResultado: dry-run finalizado; no se modificó Supabase ni Storage.");
    console.log("Use --apply para ejecutar únicamente las acciones no conflictivas informadas.");
    if (preflight.results.some((result) => result.conflicts.length)) process.exitCode = 2;
    return;
  }

  console.log("\nAplicando migración de imágenes no conflictivas...");
  const outcome = await applyPreflight(config, preflight);
  const after = await buildRemotePreflight(config, localAudit);
  console.log("\nValidación posterior:");
  printRemotePreflight(after);
  const final = summarizeFinal(after, outcome);
  if (outcome.errors.length || final.partial || after.results.some((result) => result.conflicts.length)) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exitCode = 1;
});
