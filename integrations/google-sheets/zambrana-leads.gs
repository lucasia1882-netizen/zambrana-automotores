const SPREADSHEET_ID = "PEGAR_SPREADSHEET_ID_ACA";
const SHEET_NAME = "📋 Leads";
const HEADER_ROW = 3;

function doGet() {
  return jsonOutput_({
    ok: true,
    service: "zambrana-leads",
    message: "Web app activo"
  });
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    validatePayload_(payload);

    const sheet = getTargetSheet_();
    const nextId = getNextLeadId_(sheet);
    const targetRow = getNextLeadRow_(sheet);
    const createdAt = payload.createdAt ? new Date(payload.createdAt) : new Date();

    const row = [
      nextId,
      createdAt,
      payload.name,
      payload.phone,
      payload.message,
      payload.source || "zambrana-web",
      payload.status || "Nuevo",
      payload.vendor || "",
      "",
      payload.channel || "Web",
      buildFollowUpNotes_(payload),
      "",
      ""
    ];

    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

    return jsonOutput_({
      ok: true,
      id: nextId
    });
  } catch (error) {
    return jsonOutput_({
      ok: false,
      error: error.message || "No se pudo guardar el lead"
    });
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("No llegaron datos al endpoint");
  }

  return JSON.parse(e.postData.contents);
}

function validatePayload_(payload) {
  if (!payload.name) throw new Error("Falta el nombre");
  if (!payload.phone) throw new Error("Falta el telefono");
  if (!payload.message) throw new Error("Falta la consulta");
}

function getTargetSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(`No existe la hoja ${SHEET_NAME}`);
  }

  return sheet;
}

function getNextLeadId_(sheet) {
  const startRow = HEADER_ROW + 1;
  const ids = getFilledLeadIds_(sheet, startRow);
  if (!ids.length) return "001";

  const values = ids.map((value) => [value]).flat();
  const maxNumeric = values.reduce((max, current) => {
    const parsed = parseInt(String(current).replace(/\D/g, ""), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return String(maxNumeric + 1).padStart(3, "0");
}

function getNextLeadRow_(sheet) {
  const startRow = HEADER_ROW + 1;
  const ids = getFilledLeadIds_(sheet, startRow);
  return startRow + ids.length;
}

function getFilledLeadIds_(sheet, startRow) {
  const maxRows = Math.max(sheet.getMaxRows() - startRow + 1, 1);
  const values = sheet.getRange(startRow, 1, maxRows, 1).getDisplayValues().flat();
  return values.filter((value) => String(value).trim() !== "");
}

function buildFollowUpNotes_(payload) {
  const notes = [];

  if (payload.pageTitle) notes.push(`Pagina: ${payload.pageTitle}`);
  if (payload.pageUrl) notes.push(`URL: ${payload.pageUrl}`);
  if (payload.submittedAt) notes.push(`Enviado: ${payload.submittedAt}`);

  return notes.join(" | ");
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
