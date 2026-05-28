(() => {
  const site = window.ZambranaSite;
  if (!site || document.body.dataset.page !== "catalog") {
    return;
  }

  const { vehicles, createVehicleCard } = site;

  const grid = document.querySelector("#catalog-grid");
  const summary = document.querySelector("#catalog-summary");
  const orderSelect = document.querySelector("#catalog-order");
  const searchForm = document.querySelector("#catalog-search-form");
  const queryInput = document.querySelector("#catalog-query");
  const clearFiltersButton = document.querySelector("#clear-filters");

  const filterEls = {
    type: document.querySelector("#filter-type"),
    brand: document.querySelector("#filter-brand"),
    fuel: document.querySelector("#filter-fuel"),
    transmission: document.querySelector("#filter-transmission"),
    yearMin: document.querySelector("#year-min"),
    yearMax: document.querySelector("#year-max"),
    priceMin: document.querySelector("#price-min"),
    priceMax: document.querySelector("#price-max"),
    yearOutput: document.querySelector("#year-range-output"),
    priceOutput: document.querySelector("#price-range-output")
  };

  const PRICE_FILTER_LIMIT = 90000000;

  const years = vehicles.map((vehicle) => vehicle.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const pricedVehicles = vehicles.filter((vehicle) => Number.isFinite(vehicle.priceValue));
  const minPrice = 0;
  const maxPrice = PRICE_FILTER_LIMIT;

  let state = {
    query: "",
    type: "",
    brand: "",
    yearMin: minYear,
    yearMax: maxYear,
    priceMin: minPrice,
    priceMax: maxPrice,
    order: "featured"
  };

  function formatPriceRange(value) {
    if (!Number.isFinite(value) || value <= 0) {
      return "$0";
    }
    const millions = value / 1000000;
    const formatted = Number.isInteger(millions)
      ? `${millions}`
      : millions.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `$${formatted}M`;
  }

  function populateSelect(select, values) {
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function populateFilters() {
    populateSelect(filterEls.type, [...new Set(vehicles.map((vehicle) => vehicle.type))]);
    populateSelect(filterEls.brand, [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort());
    if (filterEls.fuel) {
      populateSelect(filterEls.fuel, [...new Set(vehicles.map((vehicle) => vehicle.fuel))]);
    }
    if (filterEls.transmission) {
      populateSelect(filterEls.transmission, [...new Set(vehicles.map((vehicle) => vehicle.transmission))]);
    }

    filterEls.yearMin.min = String(minYear);
    filterEls.yearMin.max = String(maxYear);
    filterEls.yearMin.value = String(minYear);
    filterEls.yearMax.min = String(minYear);
    filterEls.yearMax.max = String(maxYear);
    filterEls.yearMax.value = String(maxYear);

    filterEls.priceMin.min = "0";
    filterEls.priceMin.max = String(PRICE_FILTER_LIMIT);
    filterEls.priceMin.value = String(minPrice);
    filterEls.priceMin.step = "1000000";
    filterEls.priceMax.min = "0";
    filterEls.priceMax.max = String(PRICE_FILTER_LIMIT);
    filterEls.priceMax.value = String(maxPrice);
    filterEls.priceMax.step = "1000000";
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || params.get("model") || "";
    state.brand = params.get("brand") || "";
    state.type = params.get("type") || "";
    state.yearMin = Number(params.get("yearMin") || params.get("year") || minYear);
    state.yearMax = Number(params.get("yearMax") || params.get("year") || maxYear);
    state.priceMin = Number(params.get("priceMin") || minPrice);
    state.priceMax = Number(params.get("priceMax") || maxPrice);
    state.order = params.get("order") || "featured";
  }

  function syncInputsFromState() {
    queryInput.value = state.query;
    filterEls.type.value = state.type;
    filterEls.brand.value = state.brand;
    if (filterEls.fuel) filterEls.fuel.value = state.fuel;
    if (filterEls.transmission) filterEls.transmission.value = state.transmission;
    filterEls.yearMin.value = String(state.yearMin);
    filterEls.yearMax.value = String(state.yearMax);
    filterEls.priceMin.value = String(state.priceMin);
    filterEls.priceMax.value = String(state.priceMax);
    orderSelect.value = state.order;
    updateRangeOutputs();
  }

  function updateRangeOutputs() {
    const yearLow = Math.min(Number(filterEls.yearMin.value), Number(filterEls.yearMax.value));
    const yearHigh = Math.max(Number(filterEls.yearMin.value), Number(filterEls.yearMax.value));
    filterEls.yearOutput.textContent = `${yearLow} - ${yearHigh}`;

    const priceLow = Math.min(Number(filterEls.priceMin.value), Number(filterEls.priceMax.value));
    const priceHigh = Math.max(Number(filterEls.priceMin.value), Number(filterEls.priceMax.value));
    filterEls.priceOutput.textContent = priceHigh >= PRICE_FILTER_LIMIT
      ? `${formatPriceRange(priceLow)} - Sin tope`
      : `${formatPriceRange(priceLow)} - ${formatPriceRange(priceHigh)}`;
  }

  function normalizeState() {
    state.yearMin = Math.min(Number(filterEls.yearMin.value), Number(filterEls.yearMax.value));
    state.yearMax = Math.max(Number(filterEls.yearMin.value), Number(filterEls.yearMax.value));
    state.priceMin = Math.min(Number(filterEls.priceMin.value), Number(filterEls.priceMax.value));
    state.priceMax = Math.max(Number(filterEls.priceMin.value), Number(filterEls.priceMax.value));
  }

  function sortVehicles(items) {
    const list = [...items];
    switch (state.order) {
      case "price-asc":
        return list.sort((a, b) => {
          const aPrice = Number.isFinite(a.priceValue) ? a.priceValue : Number.POSITIVE_INFINITY;
          const bPrice = Number.isFinite(b.priceValue) ? b.priceValue : Number.POSITIVE_INFINITY;
          return aPrice - bPrice;
        });
      case "price-desc":
        return list.sort((a, b) => {
          const aPrice = Number.isFinite(a.priceValue) ? a.priceValue : Number.NEGATIVE_INFINITY;
          const bPrice = Number.isFinite(b.priceValue) ? b.priceValue : Number.NEGATIVE_INFINITY;
          return bPrice - aPrice;
        });
      case "year-desc":
        return list.sort((a, b) => b.year - a.year);
      case "year-asc":
        return list.sort((a, b) => a.year - b.year);
      case "brand-asc":
        return list.sort((a, b) => a.brand.localeCompare(b.brand));
      default:
        return list;
    }
  }

  function matchesFilters(vehicle) {
    const query = state.query.trim().toLowerCase();
    const searchable = `${vehicle.brand} ${vehicle.model} ${vehicle.fullName}`.toLowerCase();

    if (query && !searchable.includes(query)) return false;
    if (state.type && vehicle.type !== state.type) return false;
    if (state.brand && vehicle.brand !== state.brand) return false;
    if (vehicle.year < state.yearMin || vehicle.year > state.yearMax) return false;

    if (Number.isFinite(vehicle.priceValue)) {
      const hasUpperLimit = state.priceMax < PRICE_FILTER_LIMIT;
      if (vehicle.priceValue < state.priceMin) return false;
      if (hasUpperLimit && vehicle.priceValue > state.priceMax) return false;
    }

    return true;
  }

  function renderCatalog() {
    normalizeState();
    updateRangeOutputs();

    const filtered = sortVehicles(vehicles.filter(matchesFilters));
    grid.innerHTML = "";

    filtered.forEach((vehicle) => {
      grid.appendChild(createVehicleCard(vehicle, true));
    });

    summary.textContent = filtered.length === 1
      ? "Mostrando 1 unidad"
      : `Mostrando ${filtered.length} unidades`;

    if (!filtered.length) {
      grid.innerHTML = `
        <article class="catalog-empty">
          <p class="eyebrow">Sin resultados</p>
          <h3>No encontramos vehículos con esa combinación de filtros.</h3>
          <p>Probá limpiando algunos criterios o buscá una marca o modelo diferente.</p>
        </article>
      `;
    }
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.type) params.set("type", state.type);
    if (state.brand) params.set("brand", state.brand);
    if (state.yearMin !== minYear) params.set("yearMin", String(state.yearMin));
    if (state.yearMax !== maxYear) params.set("yearMax", String(state.yearMax));
    if (state.priceMin !== minPrice) params.set("priceMin", String(state.priceMin));
    if (state.priceMax !== maxPrice) params.set("priceMax", String(state.priceMax));
    if (state.order !== "featured") params.set("order", state.order);
    history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
  }

  function applyStateFromInputs() {
    state.query = queryInput.value.trim();
    state.type = filterEls.type.value;
    state.brand = filterEls.brand.value;
    state.order = orderSelect.value;
    normalizeState();
    updateUrl();
    renderCatalog();
  }

  function resetFilters() {
    state = {
      query: "",
      type: "",
      brand: "",
      yearMin: minYear,
      yearMax: maxYear,
      priceMin: minPrice,
      priceMax: maxPrice,
      order: "featured"
    };
    syncInputsFromState();
    updateUrl();
    renderCatalog();
  }

  populateFilters();
  filterEls.fuel?.closest("label")?.remove();
  filterEls.transmission?.closest("label")?.remove();
  readUrlState();
  syncInputsFromState();
  renderCatalog();

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyStateFromInputs();
  });

  [filterEls.type, filterEls.brand, filterEls.fuel, filterEls.transmission, orderSelect]
    .filter(Boolean)
    .forEach((input) => input.addEventListener("change", applyStateFromInputs));

  [filterEls.yearMin, filterEls.yearMax, filterEls.priceMin, filterEls.priceMax]
    .forEach((input) => input.addEventListener("input", applyStateFromInputs));

  clearFiltersButton.addEventListener("click", resetFilters);
})();
