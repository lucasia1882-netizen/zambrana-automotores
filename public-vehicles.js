(() => {
  const config = window.zambranaPublicConfig || {};
  const legacyVehicles = Array.from(window.zambranaVehicles || []);
  const C3_SLUG = "citroen-c3-exclusive-14-hdi-2007";
  const PLACEHOLDER_IMAGE = "assets/branding/logo-zambrana-negativo.png";
  const C3_LEGACY_IMAGES = [
    "assets/vehiculos/c3/c3-frente-3-4.jpeg",
    "assets/vehiculos/c3/c3-frente.jpeg",
    "assets/vehiculos/c3/c3-frente-lateral.jpeg",
    "assets/vehiculos/c3/c3-lateral.jpeg",
    "assets/vehiculos/c3/c3-cola.jpeg",
    "assets/vehiculos/c3/c3-cola-3-4.jpeg",
    "assets/vehiculos/c3/c3-asientos.jpeg",
    "assets/vehiculos/c3/c3-tablero.jpeg"
  ];
  const STATUS_MAP = {
    available: "Disponible",
    reserved: "Reservado",
    preparing: "En preparación",
    sold: "Vendido"
  };
  const VEHICLE_SELECT = [
    "id", "slug", "brand", "model", "full_name", "type", "year", "mileage",
    "transmission", "fuel", "price_amount", "currency", "color", "status",
    "short_description", "description", "highlights", "is_published",
    "is_featured", "featured_order", "created_at",
    "vehicle_images(id,storage_path,position,is_cover,alt_text)"
  ].join(",");

  function normalizeLegacyVehicles() {
    return legacyVehicles.map((vehicle, index) => ({
      ...vehicle,
      isFeatured: index < 6,
      featuredOrder: index < 6 ? index + 1 : null,
      isPublished: true,
      sourceOrder: index
    }));
  }

  function formatPrice(priceAmount, currency = "ARS") {
    if (priceAmount === null || priceAmount === undefined || priceAmount === "") return "Consultar";
    const amount = Number(priceAmount);
    if (!Number.isFinite(amount)) return "Consultar";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "ARS",
      maximumFractionDigits: 0
    }).format(amount);
  }

  function headers() {
    return {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${config.supabasePublishableKey}`,
      Accept: "application/json"
    };
  }

  async function fetchJson(url, options = {}, signal) {
    const response = await fetch(url, {
      ...options,
      signal,
      headers: { ...headers(), ...(options.headers || {}) }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase respondió ${response.status}: ${text || response.statusText}`);
    return text ? JSON.parse(text) : null;
  }

  function chunks(items, size) {
    const result = [];
    for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
    return result;
  }

  function absoluteSignedUrl(signedUrl) {
    if (!signedUrl) return null;
    if (/^https?:\/\//i.test(signedUrl)) return signedUrl;
    const suffix = signedUrl.startsWith("/storage/v1/")
      ? signedUrl
      : `/storage/v1${signedUrl.startsWith("/") ? "" : "/"}${signedUrl}`;
    return `${String(config.supabaseUrl).replace(/\/$/, "")}${suffix}`;
  }

  async function signImagePaths(storagePaths, signal) {
    const uniquePaths = [...new Set(storagePaths.filter(Boolean))];
    const signedByPath = new Map();
    if (!uniquePaths.length) return signedByPath;
    const baseUrl = String(config.supabaseUrl).replace(/\/$/, "");
    const expiresIn = Number(config.signedUrlExpiresIn) || 3600;
    const groups = chunks(uniquePaths, 100);
    const responses = await Promise.all(groups.map((paths) => fetchJson(
      `${baseUrl}/storage/v1/object/sign/vehicle-images`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn, paths })
      },
      signal
    )));

    for (const response of responses) {
      for (const item of response || []) {
        const storagePath = item.path || item.storagePath;
        const signedUrl = absoluteSignedUrl(item.signedURL || item.signedUrl);
        if (storagePath && signedUrl && !item.error) signedByPath.set(storagePath, signedUrl);
      }
    }
    return signedByPath;
  }

  function transformVehicle(vehicle, signedByPath, sourceOrder) {
    const images = Array.from(vehicle.vehicle_images || [])
      .sort((a, b) => Number(a.position) - Number(b.position) || String(a.id).localeCompare(String(b.id)));
    const resolved = images
      .map((image) => ({ ...image, url: signedByPath.get(image.storage_path) }))
      .filter((image) => image.url);
    const cover = resolved.find((image) => image.is_cover) || resolved[0] || null;
    let image = cover?.url || PLACEHOLDER_IMAGE;
    let gallery = resolved.filter((item) => item.id !== cover?.id).map((item) => item.url);
    let usesLegacyC3Images = false;

    if (vehicle.slug === C3_SLUG && resolved.length === 0) {
      image = C3_LEGACY_IMAGES[0];
      gallery = C3_LEGACY_IMAGES.slice(1);
      usesLegacyC3Images = true;
    }

    const priceValue = vehicle.price_amount == null ? null : Number(vehicle.price_amount);
    return {
      id: vehicle.id,
      slug: vehicle.slug,
      brand: vehicle.brand,
      model: vehicle.model,
      fullName: vehicle.full_name,
      type: vehicle.type || "Consultar",
      year: vehicle.year == null ? null : Number(vehicle.year),
      kms: vehicle.mileage == null ? null : Number(vehicle.mileage),
      transmission: vehicle.transmission || "Consultar",
      fuel: vehicle.fuel || "Consultar",
      price: formatPrice(priceValue, vehicle.currency),
      priceValue,
      color: vehicle.color || "Consultar",
      status: STATUS_MAP[vehicle.status] || "Disponible",
      shortDescription: vehicle.short_description || "",
      description: vehicle.description || vehicle.short_description || "",
      highlights: Array.isArray(vehicle.highlights) ? vehicle.highlights : [],
      image,
      gallery,
      cardImage: image,
      imagePosition: "center 50%",
      cardImagePosition: "center 50%",
      galleryImagePosition: "center 50%",
      isFeatured: Boolean(vehicle.is_featured),
      featuredOrder: vehicle.featured_order == null ? null : Number(vehicle.featured_order),
      isPublished: Boolean(vehicle.is_published),
      createdAt: vehicle.created_at,
      sourceOrder,
      usesLegacyC3Images
    };
  }

  async function loadFromSupabase() {
    const supabaseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
    const publishableKey = String(config.supabasePublishableKey || "").trim();
    if (!supabaseUrl || !publishableKey) throw new Error("Configuración pública de Supabase incompleta");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || 12000);
    try {
      const params = new URLSearchParams({
        select: VEHICLE_SELECT,
        is_published: "eq.true",
        order: "is_featured.desc,featured_order.asc.nullslast,created_at.desc",
        "vehicle_images.order": "position.asc"
      });
      const vehicles = await fetchJson(`${supabaseUrl}/rest/v1/vehicles?${params}`, {}, controller.signal);
      if (!Array.isArray(vehicles)) throw new Error("Respuesta de vehículos inválida");
      const storagePaths = vehicles.flatMap((vehicle) =>
        Array.from(vehicle.vehicle_images || []).map((image) => image.storage_path)
      );
      const signedByPath = await signImagePaths(storagePaths, controller.signal);
      return vehicles.map((vehicle, index) => transformVehicle(vehicle, signedByPath, index));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function loadPublicVehicles() {
    if (config.USE_SUPABASE_VEHICLES === false) {
      return { vehicles: normalizeLegacyVehicles(), source: "legacy", reason: "feature-flag", error: null };
    }
    try {
      const vehicles = await loadFromSupabase();
      return { vehicles, source: "supabase", reason: null, error: null };
    } catch (error) {
      console.error("No se pudo cargar el catálogo público desde Supabase. Se utilizará el rollback legacy.", error);
      return { vehicles: normalizeLegacyVehicles(), source: "legacy", reason: "supabase-error", error };
    }
  }

  window.ZambranaPublicVehicles = {
    ready: loadPublicVehicles(),
    formatPrice,
    transformVehicle,
    constants: { C3_SLUG, C3_LEGACY_IMAGES, PLACEHOLDER_IMAGE }
  };
})();
