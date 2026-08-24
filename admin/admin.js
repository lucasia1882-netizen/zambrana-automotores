const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
const STORAGE_BUCKET = "vehicle-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const STATUS_LABELS = {
  available: "Disponible",
  reserved: "Reservado",
  preparing: "En preparación",
  sold: "Vendido"
};

const dom = {
  setup: document.querySelector("#setup-screen"),
  loading: document.querySelector("#loading-screen"),
  login: document.querySelector("#login-screen"),
  unauthorized: document.querySelector("#unauthorized-screen"),
  dashboard: document.querySelector("#dashboard"),
  loginForm: document.querySelector("#login-form"),
  loginSubmit: document.querySelector("#login-submit"),
  loginError: document.querySelector("#login-error"),
  currentUser: document.querySelector("#current-user"),
  logoutButton: document.querySelector("#logout-button"),
  unauthorizedLogout: document.querySelector("#unauthorized-logout"),
  search: document.querySelector("#vehicle-search"),
  newVehicleButton: document.querySelector("#new-vehicle-button"),
  tableBody: document.querySelector("#vehicle-table-body"),
  tableEmpty: document.querySelector("#table-empty"),
  dashboardMessage: document.querySelector("#dashboard-message"),
  metricTotal: document.querySelector("#metric-total"),
  metricAvailable: document.querySelector("#metric-available"),
  metricReserved: document.querySelector("#metric-reserved"),
  metricSold: document.querySelector("#metric-sold"),
  backdrop: document.querySelector("#editor-backdrop"),
  editor: document.querySelector("#vehicle-editor"),
  editorTitle: document.querySelector("#editor-title"),
  editorSubtitle: document.querySelector("#editor-subtitle"),
  form: document.querySelector("#vehicle-form"),
  formError: document.querySelector("#form-error"),
  saveVehicle: document.querySelector("#save-vehicle"),
  closeEditor: document.querySelector("#close-editor"),
  cancelEditor: document.querySelector("#cancel-editor"),
  addHighlight: document.querySelector("#add-highlight"),
  highlightsList: document.querySelector("#highlights-list"),
  imageInput: document.querySelector("#image-input"),
  pendingImages: document.querySelector("#pending-images"),
  imageList: document.querySelector("#image-list"),
  featuredOrderField: document.querySelector("#featured-order-field"),
  dangerZone: document.querySelector("#danger-zone"),
  deleteVehicle: document.querySelector("#delete-vehicle"),
  toastRegion: document.querySelector("#toast-region")
};

const state = {
  supabase: null,
  user: null,
  profile: null,
  vehicles: [],
  editingVehicle: null,
  pendingFiles: [],
  editorDirty: false,
  slugTouched: false,
  imageUrlCache: new Map(),
  busy: false
};

function showOnly(target) {
  [dom.setup, dom.loading, dom.login, dom.unauthorized, dom.dashboard]
    .forEach((section) => { section.hidden = section !== target; });
}

function setMessage(element, message = "", isError = false) {
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle("form-message-error", isError);
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " is-error" : ""}`;
  toast.textContent = message;
  dom.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4800);
}

function errorMessage(error, fallback = "Ocurrió un error inesperado.") {
  if (!error) return fallback;
  if (error.code === "23505" && String(error.message).includes("slug")) {
    return "El slug ya está en uso. Elegí uno diferente.";
  }
  if (error.code === "42501") {
    return "Supabase bloqueó la operación. Revisá el perfil administrativo y las políticas RLS.";
  }
  return error.message || fallback;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function nullableText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value) {
  return value === null || value === undefined
    ? "Consultar"
    : new Intl.NumberFormat("es-AR").format(value);
}

function formatPrice(vehicle) {
  if (vehicle.price_amount === null || vehicle.price_amount === undefined) return "Consultar";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: vehicle.currency || "ARS",
    maximumFractionDigits: 2
  }).format(Number(vehicle.price_amount));
}

function createBadge(label, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = label;
  return badge;
}

function setBusy(busy, label = "Guardando…") {
  state.busy = busy;
  dom.saveVehicle.disabled = busy;
  dom.deleteVehicle.disabled = busy;
  dom.saveVehicle.textContent = busy ? label : "Guardar vehículo";
}

function renderMetrics() {
  dom.metricTotal.textContent = String(state.vehicles.length);
  dom.metricAvailable.textContent = String(state.vehicles.filter((item) => item.status === "available").length);
  dom.metricReserved.textContent = String(state.vehicles.filter((item) => item.status === "reserved").length);
  dom.metricSold.textContent = String(state.vehicles.filter((item) => item.status === "sold").length);
}

function filteredVehicles() {
  const query = dom.search.value.trim().toLocaleLowerCase("es");
  if (!query) return state.vehicles;
  return state.vehicles.filter((vehicle) =>
    [vehicle.full_name, vehicle.brand, vehicle.model, vehicle.slug]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("es").includes(query))
  );
}

function renderTable() {
  const vehicles = filteredVehicles();
  dom.tableBody.replaceChildren();
  dom.tableEmpty.hidden = vehicles.length > 0;

  vehicles.forEach((vehicle) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const name = document.createElement("div");
    name.className = "vehicle-name";
    const strong = document.createElement("strong");
    strong.textContent = vehicle.full_name;
    const meta = document.createElement("span");
    meta.textContent = `${vehicle.brand} · ${vehicle.model}`;
    name.append(strong, meta);
    nameCell.appendChild(name);

    const yearCell = document.createElement("td");
    yearCell.textContent = vehicle.year ?? "—";

    const priceCell = document.createElement("td");
    priceCell.textContent = formatPrice(vehicle);

    const mileageCell = document.createElement("td");
    mileageCell.textContent = vehicle.mileage === null || vehicle.mileage === undefined
      ? "Consultar"
      : `${formatNumber(vehicle.mileage)} km`;

    const statusCell = document.createElement("td");
    statusCell.appendChild(createBadge(STATUS_LABELS[vehicle.status] || vehicle.status, `badge-${vehicle.status}`));

    const publishedCell = document.createElement("td");
    publishedCell.appendChild(createBadge(
      vehicle.is_published ? "Sí" : "No",
      vehicle.is_published ? "badge-published" : "badge-unpublished"
    ));

    const actionsCell = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button button-secondary button-small";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => openEditor(vehicle));
    actionsCell.appendChild(editButton);

    row.append(nameCell, yearCell, priceCell, mileageCell, statusCell, publishedCell, actionsCell);
    dom.tableBody.appendChild(row);
  });
}

function renderDashboard() {
  renderMetrics();
  renderTable();
}

async function loadVehicles() {
  setMessage(dom.dashboardMessage, "Cargando vehículos…");
  const { data, error } = await state.supabase
    .from("vehicles")
    .select("*, vehicle_images(*)")
    .order("created_at", { ascending: false });

  if (error) {
    setMessage(dom.dashboardMessage, errorMessage(error, "No se pudo cargar el inventario."), true);
    throw error;
  }

  state.vehicles = (data || []).map((vehicle) => ({
    ...vehicle,
    vehicle_images: [...(vehicle.vehicle_images || [])].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  }));
  setMessage(dom.dashboardMessage);
  renderDashboard();
}

async function authorizeSession(session) {
  if (!session?.user) {
    state.user = null;
    state.profile = null;
    showOnly(dom.login);
    return;
  }

  state.user = session.user;
  const { data, error } = await state.supabase
    .from("admin_profiles")
    .select("role, active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !data?.active) {
    state.profile = null;
    showOnly(dom.unauthorized);
    return;
  }

  state.profile = data;
  dom.currentUser.textContent = `${session.user.email || "Usuario"} · ${data.role}`;
  showOnly(dom.dashboard);
  await loadVehicles();
}

async function signOut() {
  closeEditor(true);
  await state.supabase.auth.signOut();
  state.vehicles = [];
  showOnly(dom.login);
}

function addHighlightRow(value = "") {
  const row = document.createElement("div");
  row.className = "highlight-row";
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = "Ej.: Único dueño";
  input.dataset.highlight = "true";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-button";
  remove.textContent = "Eliminar";
  remove.addEventListener("click", () => {
    row.remove();
    state.editorDirty = true;
  });
  row.append(input, remove);
  dom.highlightsList.appendChild(row);
}

function renderHighlights(highlights = []) {
  dom.highlightsList.replaceChildren();
  highlights.forEach((highlight) => addHighlightRow(String(highlight)));
  if (!highlights.length) addHighlightRow();
}

function updateFeaturedField() {
  const featured = dom.form.elements.is_featured.checked;
  dom.featuredOrderField.hidden = !featured;
  dom.form.elements.featured_order.required = featured;
  if (!featured) dom.form.elements.featured_order.value = "";
}

function fillForm(vehicle) {
  const fields = [
    "brand", "model", "full_name", "slug", "type", "year", "mileage",
    "transmission", "fuel", "price_amount", "currency", "color", "status",
    "featured_order", "short_description", "description"
  ];

  fields.forEach((field) => {
    const control = dom.form.elements[field];
    control.value = vehicle?.[field] ?? (field === "currency" ? "ARS" : field === "status" ? "available" : "");
  });
  dom.form.elements.is_published.checked = Boolean(vehicle?.is_published);
  dom.form.elements.is_featured.checked = Boolean(vehicle?.is_featured);
  updateFeaturedField();
  renderHighlights(Array.isArray(vehicle?.highlights) ? vehicle.highlights : []);
}

async function signedImageUrl(storagePath) {
  if (state.imageUrlCache.has(storagePath)) return state.imageUrlCache.get(storagePath);
  const { data, error } = await state.supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 3600);
  if (error) return "";
  state.imageUrlCache.set(storagePath, data.signedUrl);
  return data.signedUrl;
}

async function renderImages() {
  dom.imageList.replaceChildren();
  const images = state.editingVehicle?.vehicle_images || [];

  if (!state.editingVehicle) {
    const note = document.createElement("p");
    note.className = "field-help";
    note.textContent = "Las imágenes se subirán después de crear el vehículo.";
    dom.imageList.appendChild(note);
    return;
  }

  if (!images.length) {
    const note = document.createElement("p");
    note.className = "field-help";
    note.textContent = "Este vehículo todavía no tiene imágenes.";
    dom.imageList.appendChild(note);
    return;
  }

  const urls = await Promise.all(images.map((image) => signedImageUrl(image.storage_path)));

  images.forEach((image, index) => {
    const item = document.createElement("article");
    item.className = "image-item";
    const preview = document.createElement("div");
    preview.className = "image-preview";
    const img = document.createElement("img");
    img.src = urls[index];
    img.alt = image.alt_text || `${state.editingVehicle.full_name} foto ${index + 1}`;
    preview.appendChild(img);

    if (image.is_cover) {
      const marker = document.createElement("span");
      marker.className = "cover-marker";
      marker.textContent = "Portada";
      preview.appendChild(marker);
    }

    const meta = document.createElement("div");
    meta.className = "image-meta";
    const path = document.createElement("p");
    path.title = image.storage_path;
    path.textContent = image.storage_path.split("/").pop();
    const actions = document.createElement("div");
    actions.className = "image-actions";

    const up = imageAction("↑", "Subir posición", () => moveImage(index, -1));
    up.disabled = index === 0;
    const down = imageAction("↓", "Bajar posición", () => moveImage(index, 1));
    down.disabled = index === images.length - 1;
    const cover = imageAction("Portada", "Elegir como portada", () => setCover(image.id));
    cover.disabled = image.is_cover;
    const remove = imageAction("Eliminar", "Eliminar imagen", () => deleteImage(image), true);
    actions.append(up, down, cover, remove);
    meta.append(path, actions);
    item.append(preview, meta);
    dom.imageList.appendChild(item);
  });
}

function imageAction(text, ariaLabel, action, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `image-action${danger ? " image-action-danger" : ""}`;
  button.textContent = text;
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", action);
  return button;
}

function renderPendingFiles() {
  dom.pendingImages.replaceChildren();
  state.pendingFiles.forEach((file, index) => {
    const row = document.createElement("div");
    row.className = "pending-image";
    const name = document.createElement("span");
    name.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-button";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => {
      state.pendingFiles.splice(index, 1);
      state.editorDirty = true;
      renderPendingFiles();
    });
    row.append(name, remove);
    dom.pendingImages.appendChild(row);
  });
}

async function openEditor(vehicle = null) {
  state.editingVehicle = vehicle ? structuredClone(vehicle) : null;
  state.pendingFiles = [];
  state.slugTouched = Boolean(vehicle);
  state.editorDirty = false;
  dom.form.reset();
  dom.form.querySelectorAll("[aria-invalid='true']").forEach((control) => control.removeAttribute("aria-invalid"));
  setMessage(dom.formError);
  dom.editorTitle.textContent = vehicle ? "Editar vehículo" : "Nuevo vehículo";
  dom.editorSubtitle.textContent = vehicle ? vehicle.full_name : "Completá la información de la unidad.";
  dom.dangerZone.hidden = !vehicle;
  fillForm(vehicle);
  renderPendingFiles();
  dom.backdrop.hidden = false;
  dom.editor.hidden = false;
  dom.editor.inert = false;
  window.requestAnimationFrame(() => dom.editor.classList.add("is-open"));
  dom.editor.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  await renderImages();
  window.setTimeout(() => dom.form.elements.brand.focus(), 80);
}

function closeEditor(force = false) {
  if (!force && state.editorDirty && !window.confirm("Hay cambios sin guardar. ¿Querés cerrar igualmente?")) return;
  dom.editor.classList.remove("is-open");
  dom.editor.setAttribute("aria-hidden", "true");
  dom.editor.inert = true;
  dom.backdrop.hidden = true;
  document.body.style.overflow = "";
  window.setTimeout(() => {
    if (!dom.editor.classList.contains("is-open")) dom.editor.hidden = true;
  }, 230);
  state.editingVehicle = null;
  state.pendingFiles = [];
  state.editorDirty = false;
}

function collectHighlights() {
  return [...dom.highlightsList.querySelectorAll("[data-highlight]")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function validateForm() {
  const currentYear = new Date().getFullYear();
  const required = ["brand", "model", "full_name", "slug"];
  const errors = [];

  dom.form.querySelectorAll("[aria-invalid='true']").forEach((control) => control.removeAttribute("aria-invalid"));
  required.forEach((name) => {
    const control = dom.form.elements[name];
    if (!control.value.trim()) {
      control.setAttribute("aria-invalid", "true");
      errors.push(`${control.closest("label").childNodes[0].textContent.trim()} es obligatorio.`);
    }
  });

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dom.form.elements.slug.value.trim())) {
    dom.form.elements.slug.setAttribute("aria-invalid", "true");
    errors.push("El slug solo puede contener minúsculas, números y guiones simples.");
  }

  const year = nullableNumber(dom.form.elements.year.value);
  if (year !== null && (!Number.isInteger(year) || year < 1886 || year > currentYear + 1)) {
    dom.form.elements.year.setAttribute("aria-invalid", "true");
    errors.push(`El año debe estar entre 1886 y ${currentYear + 1}.`);
  }

  for (const name of ["mileage", "price_amount", "featured_order"]) {
    const control = dom.form.elements[name];
    const value = nullableNumber(control.value);
    if (value !== null && value < 0) {
      control.setAttribute("aria-invalid", "true");
      errors.push(`${control.closest("label").childNodes[0].textContent.trim()} no puede ser negativo.`);
    }
  }

  if (dom.form.elements.is_featured.checked && nullableNumber(dom.form.elements.featured_order.value) === null) {
    dom.form.elements.featured_order.setAttribute("aria-invalid", "true");
    errors.push("Indicá el orden del vehículo destacado.");
  }

  if (!Object.hasOwn(STATUS_LABELS, dom.form.elements.status.value)) errors.push("El estado seleccionado no es válido.");
  if (!["ARS", "USD"].includes(dom.form.elements.currency.value)) errors.push("La moneda seleccionada no es válida.");

  setMessage(dom.formError, errors.join(" "), errors.length > 0);
  errors.length && dom.formError.scrollIntoView({ behavior: "smooth", block: "center" });
  return errors.length === 0;
}

function vehiclePayload() {
  const formData = new FormData(dom.form);
  const isFeatured = dom.form.elements.is_featured.checked;
  return {
    slug: String(formData.get("slug")).trim(),
    brand: String(formData.get("brand")).trim(),
    model: String(formData.get("model")).trim(),
    full_name: String(formData.get("full_name")).trim(),
    type: nullableText(formData.get("type")),
    year: nullableNumber(formData.get("year")),
    mileage: nullableNumber(formData.get("mileage")),
    transmission: nullableText(formData.get("transmission")),
    fuel: nullableText(formData.get("fuel")),
    price_amount: nullableNumber(formData.get("price_amount")),
    currency: String(formData.get("currency")),
    color: nullableText(formData.get("color")),
    status: String(formData.get("status")),
    short_description: nullableText(formData.get("short_description")),
    description: nullableText(formData.get("description")),
    highlights: collectHighlights(),
    is_published: dom.form.elements.is_published.checked,
    is_featured: isFeatured,
    featured_order: isFeatured ? nullableNumber(formData.get("featured_order")) : null
  };
}

function extensionFor(file) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  const original = file.name.split(".").pop()?.toLowerCase();
  return original === "jpeg" ? "jpeg" : "jpg";
}

function imageDimensions(file) {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

async function uploadPendingImages(vehicle) {
  if (!state.pendingFiles.length) return;
  const existingImages = vehicle.vehicle_images || [];
  let nextPosition = existingImages.length
    ? Math.max(...existingImages.map((image) => image.position)) + 1
    : 0;
  let hasCover = existingImages.some((image) => image.is_cover);

  for (const file of state.pendingFiles) {
    const imageId = crypto.randomUUID();
    const extension = extensionFor(file);
    const storagePath = `vehicles/${vehicle.id}/${imageId}.${extension}`;
    const dimensions = await imageDimensions(file);
    const isCover = !hasCover;

    const { error: uploadError } = await state.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { error: rowError } = await state.supabase.from("vehicle_images").insert({
      id: imageId,
      vehicle_id: vehicle.id,
      storage_path: storagePath,
      position: nextPosition,
      is_cover: isCover,
      alt_text: `${vehicle.full_name} foto ${nextPosition + 1}`,
      mime_type: file.type,
      width: dimensions.width,
      height: dimensions.height,
      size_bytes: file.size
    });

    if (rowError) {
      await state.supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw rowError;
    }

    hasCover = true;
    nextPosition += 1;
  }
}

async function saveVehicle(event) {
  event.preventDefault();
  if (state.busy || !validateForm()) return;

  const wasEditing = Boolean(state.editingVehicle);
  setBusy(true);
  setMessage(dom.formError);
  try {
    const payload = vehiclePayload();
    let savedVehicle;

    if (state.editingVehicle) {
      const { data, error } = await state.supabase
        .from("vehicles")
        .update(payload)
        .eq("id", state.editingVehicle.id)
        .select("*")
        .single();
      if (error) throw error;
      savedVehicle = { ...data, vehicle_images: state.editingVehicle.vehicle_images || [] };
    } else {
      const { data, error } = await state.supabase
        .from("vehicles")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      savedVehicle = { ...data, vehicle_images: [] };
    }

    await uploadPendingImages(savedVehicle);
    state.editorDirty = false;
    closeEditor(true);
    await loadVehicles();
    showToast(wasEditing ? "Vehículo actualizado." : "Vehículo creado.");
  } catch (error) {
    setMessage(dom.formError, errorMessage(error, "No se pudo guardar el vehículo."), true);
    dom.formError.scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    setBusy(false);
  }
}

async function refreshEditingVehicle(vehicleId) {
  await loadVehicles();
  const updated = state.vehicles.find((vehicle) => vehicle.id === vehicleId);
  if (!updated) return;
  state.editingVehicle = structuredClone(updated);
  await renderImages();
}

async function setCover(imageId) {
  if (!state.editingVehicle || state.busy) return;
  setBusy(true, "Actualizando…");
  try {
    const { error } = await state.supabase.rpc("set_vehicle_cover", {
      p_vehicle_id: state.editingVehicle.id,
      p_image_id: imageId
    });
    if (error) throw error;
    await refreshEditingVehicle(state.editingVehicle.id);
    showToast("Portada actualizada.");
  } catch (error) {
    showToast(errorMessage(error, "No se pudo actualizar la portada."), true);
  } finally {
    setBusy(false);
  }
}

async function moveImage(index, direction) {
  if (!state.editingVehicle || state.busy) return;
  const nextIndex = index + direction;
  const images = [...state.editingVehicle.vehicle_images];
  if (nextIndex < 0 || nextIndex >= images.length) return;
  [images[index], images[nextIndex]] = [images[nextIndex], images[index]];

  setBusy(true, "Reordenando…");
  try {
    const { error } = await state.supabase.rpc("reorder_vehicle_images", {
      p_vehicle_id: state.editingVehicle.id,
      p_image_ids: images.map((image) => image.id)
    });
    if (error) throw error;
    await refreshEditingVehicle(state.editingVehicle.id);
  } catch (error) {
    showToast(errorMessage(error, "No se pudo cambiar el orden."), true);
  } finally {
    setBusy(false);
  }
}

async function deleteImage(image) {
  if (!state.editingVehicle || state.busy) return;
  if (!window.confirm("¿Eliminar esta fotografía? Esta acción no se puede deshacer.")) return;
  const vehicleId = state.editingVehicle.id;
  const remaining = state.editingVehicle.vehicle_images.filter((item) => item.id !== image.id);

  setBusy(true, "Eliminando…");
  try {
    const { error: rowError } = await state.supabase.from("vehicle_images").delete().eq("id", image.id);
    if (rowError) throw rowError;

    const { error: storageError } = await state.supabase.storage.from(STORAGE_BUCKET).remove([image.storage_path]);
    if (storageError) {
      showToast("La imagen dejó de publicarse, pero quedó un archivo huérfano en Storage para limpiar manualmente.", true);
    }

    if (image.is_cover && remaining.length) {
      const { error: coverError } = await state.supabase.rpc("set_vehicle_cover", {
        p_vehicle_id: vehicleId,
        p_image_id: remaining[0].id
      });
      if (coverError) throw coverError;
    }

    state.imageUrlCache.delete(image.storage_path);
    await refreshEditingVehicle(vehicleId);
    showToast("Fotografía eliminada.");
  } catch (error) {
    showToast(errorMessage(error, "No se pudo eliminar la fotografía."), true);
  } finally {
    setBusy(false);
  }
}

async function deleteVehicle() {
  if (!state.editingVehicle || state.busy) return;
  const confirmation = window.prompt(`Escribí ELIMINAR para borrar “${state.editingVehicle.full_name}”.`);
  if (confirmation !== "ELIMINAR") return;

  const vehicle = state.editingVehicle;
  const storagePaths = vehicle.vehicle_images.map((image) => image.storage_path);
  setBusy(true, "Eliminando…");
  try {
    const { error } = await state.supabase.from("vehicles").delete().eq("id", vehicle.id);
    if (error) throw error;

    if (storagePaths.length) {
      const { error: storageError } = await state.supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
      if (storageError) {
        showToast("El vehículo se eliminó, pero quedaron archivos huérfanos en Storage para limpiar manualmente.", true);
      }
    }

    state.editorDirty = false;
    closeEditor(true);
    await loadVehicles();
    showToast("Vehículo eliminado.");
  } catch (error) {
    setMessage(dom.formError, errorMessage(error, "No se pudo eliminar el vehículo."), true);
  } finally {
    setBusy(false);
  }
}

function handleFiles(files) {
  const errors = [];
  const accepted = [];
  [...files].forEach((file) => {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      errors.push(`${file.name}: formato no permitido.`);
    } else if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`${file.name}: supera el máximo de 10 MB.`);
    } else {
      accepted.push(file);
    }
  });
  state.pendingFiles.push(...accepted);
  if (accepted.length) state.editorDirty = true;
  renderPendingFiles();
  setMessage(dom.formError, errors.join(" "), errors.length > 0);
  dom.imageInput.value = "";
}

async function initialize() {
  const config = window.zambranaAdminConfig || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    showOnly(dom.setup);
    return;
  }

  try {
    const { createClient } = await import(SUPABASE_JS_URL);
    state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    const { data, error } = await state.supabase.auth.getSession();
    if (error) throw error;
    await authorizeSession(data.session);

    state.supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") showOnly(dom.login);
      if (event === "SIGNED_IN" && session?.user?.id !== state.user?.id) {
        window.setTimeout(() => authorizeSession(session), 0);
      }
    });
  } catch (error) {
    showOnly(dom.setup);
    dom.setup.querySelector("p").textContent = `No se pudo inicializar Supabase: ${errorMessage(error)}`;
  }
}

dom.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(dom.loginError);
  dom.loginSubmit.disabled = true;
  dom.loginSubmit.textContent = "Ingresando…";
  try {
    const { data, error } = await state.supabase.auth.signInWithPassword({
      email: dom.loginForm.elements.email.value.trim(),
      password: dom.loginForm.elements.password.value
    });
    if (error) throw error;
    await authorizeSession(data.session);
    dom.loginForm.reset();
  } catch (error) {
    setMessage(dom.loginError, "Email o contraseña incorrectos, o no fue posible iniciar sesión.", true);
  } finally {
    dom.loginSubmit.disabled = false;
    dom.loginSubmit.textContent = "Ingresar";
  }
});

dom.logoutButton.addEventListener("click", signOut);
dom.unauthorizedLogout.addEventListener("click", signOut);
dom.search.addEventListener("input", renderTable);
dom.newVehicleButton.addEventListener("click", () => openEditor());
dom.closeEditor.addEventListener("click", () => closeEditor());
dom.cancelEditor.addEventListener("click", () => closeEditor());
dom.backdrop.addEventListener("click", () => closeEditor());
dom.form.addEventListener("submit", saveVehicle);
dom.form.addEventListener("input", () => { state.editorDirty = true; });
dom.form.elements.full_name.addEventListener("input", (event) => {
  if (!state.editingVehicle && !state.slugTouched) dom.form.elements.slug.value = slugify(event.target.value);
});
dom.form.elements.slug.addEventListener("input", () => { state.slugTouched = true; });
dom.form.elements.is_featured.addEventListener("change", updateFeaturedField);
dom.addHighlight.addEventListener("click", () => {
  addHighlightRow();
  state.editorDirty = true;
  dom.highlightsList.lastElementChild.querySelector("input").focus();
});
dom.imageInput.addEventListener("change", (event) => handleFiles(event.target.files));
dom.deleteVehicle.addEventListener("click", deleteVehicle);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && dom.editor.classList.contains("is-open")) closeEditor();
});

initialize();
