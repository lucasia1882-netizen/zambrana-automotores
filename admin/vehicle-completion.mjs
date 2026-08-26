const VALID_STATUSES = new Set(["available", "reserved", "preparing", "sold"]);

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function issue(code, label, severity = "error") {
  return { code, label, severity };
}

export function getVehicleIssues(vehicle = {}) {
  const issues = [];

  if (isBlank(vehicle.brand)) issues.push(issue("missing-brand", "Marca faltante"));
  if (isBlank(vehicle.model)) issues.push(issue("missing-model", "Modelo faltante"));
  if (isBlank(vehicle.full_name)) issues.push(issue("missing-full-name", "Nombre completo faltante"));
  if (isBlank(vehicle.slug)) issues.push(issue("missing-slug", "Slug faltante"));
  if (vehicle.year === null || vehicle.year === undefined || vehicle.year === "") {
    issues.push(issue("missing-year", "Año faltante"));
  }
  if (vehicle.mileage === null || vehicle.mileage === undefined || vehicle.mileage === "") {
    issues.push(issue("missing-mileage", "Kilometraje faltante"));
  }
  if (isBlank(vehicle.description) && isBlank(vehicle.short_description)) {
    issues.push(issue("missing-description", "Descripción faltante"));
  }
  if (isBlank(vehicle.status)) {
    issues.push(issue("missing-status", "Estado faltante"));
  } else if (!VALID_STATUSES.has(vehicle.status)) {
    issues.push(issue("invalid-status", "Estado inválido"));
  }

  const images = Array.isArray(vehicle.vehicle_images) ? vehicle.vehicle_images : [];
  if (!images.length) {
    issues.push(issue("missing-images", "Sin fotografías"));
  } else if (!images.some((image) => image?.is_cover)) {
    issues.push(issue("missing-cover-image", "Sin foto principal"));
  }

  if (vehicle.price_amount === null || vehicle.price_amount === undefined || vehicle.price_amount === "") {
    issues.push(issue("price-on-request", "Precio a consultar", "warning"));
  }

  return issues;
}

export function hasCriticalIssues(vehicle) {
  return getVehicleIssues(vehicle).some((item) => item.severity === "error");
}

export function getVehicleCompletionStatus(vehicle) {
  const issues = getVehicleIssues(vehicle);
  const criticalIssues = issues.filter((item) => item.severity === "error");
  const warnings = issues.filter((item) => item.severity === "warning");
  return {
    issues,
    criticalIssues,
    warnings,
    criticalCount: criticalIssues.length,
    warningCount: warnings.length,
    requiresAttention: criticalIssues.length > 0
  };
}
