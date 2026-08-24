(() => {
  const site = window.ZambranaSite;
  if (!site || document.body.dataset.page !== "catalog") {
    return;
  }

  site.ready.then(() => {
  const { vehicles, createVehicleCard } = site;

  const grid = document.querySelector("#catalog-grid");
  const pagination = document.querySelector("#catalog-pagination");
  const summary = document.querySelector("#catalog-summary");
  const orderSelect = document.querySelector("#catalog-order");
  const searchForm = document.querySelector("#catalog-search-form");
  const queryInput = document.querySelector("#catalog-query");
  const clearFiltersButton = document.querySelector("#clear-filters");

  const filterEls = {
    type: document.querySelector("#filter-type"),
    brand: document.querySelector("#filter-brand"),
    yearMin: document.querySelector("#year-min"),
    yearMax: document.querySelector("#year-max"),
    priceMin: document.querySelector("#price-min"),
    priceMax: document.querySelector("#price-max"),
    yearOutput: document.querySelector("#year-range-output"),
    priceOutput: document.querySelector("#price-range-output")
  };

  const PRICE_FILTER_LIMIT = 90000000;
  const years = vehicles.map((vehicle) => vehicle.year).filter(Number.isFinite);
  const currentYear = new Date().getFullYear();
  const minYear = years.length ? Math.min(...years) : currentYear;
  const maxYear = years.length ? Math.max(...years) : currentYear;
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
    order: "featured",
    page: 1
  };

  let lastItemsPerPage = getItemsPerPage();

  function getItemsPerPage() {
    return window.matchMedia("(max-width: 640px)").matches ? 12 : 15;
  }

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
    if (!select) return;

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function populateFilters() {
    populateSelect(filterEls.type, [...new Set(vehicles.map((vehicle) => vehicle.type).filter(Boolean))]);
    populateSelect(filterEls.brand, [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort());

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
    state.page = Math.max(1, Number(params.get("page") || 1));
  }

  function syncInputsFromState() {
    queryInput.value = state.query;
    filterEls.type.value = state.type;
    filterEls.brand.value = state.brand;
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

    updateRangeTrackStyles(filterEls.yearMin, filterEls.yearMax);
    updateRangeTrackStyles(filterEls.priceMin, filterEls.priceMax);
  }

  function updateRangeTrackStyles(minInput, maxInput) {
    if (!minInput || !maxInput) return;

    const min = Number(minInput.min);
    const max = Number(minInput.max);
    const lowValue = Math.min(Number(minInput.value), Number(maxInput.value));
    const highValue = Math.max(Number(minInput.value), Number(maxInput.value));
    const start = ((lowValue - min) / (max - min)) * 100;
    const end = ((highValue - min) / (max - min)) * 100;
    const gradient = `linear-gradient(90deg,
      rgba(255, 255, 255, 0.28) 0%,
      rgba(255, 255, 255, 0.28) ${start}%,
      #ff2f37 ${start}%,
      #d71920 ${end}%,
      rgba(255, 255, 255, 0.28) ${end}%,
      rgba(255, 255, 255, 0.28) 100%)`;

    minInput.style.background = gradient;
    maxInput.style.background = gradient;
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
        return list.sort((a, b) => {
          if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
          const aOrder = a.featuredOrder ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.featuredOrder ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0);
        });
    }
  }

  function matchesFilters(vehicle) {
    const query = state.query.trim().toLowerCase();
    const searchable = `${vehicle.brand} ${vehicle.model} ${vehicle.fullName}`.toLowerCase();

    if (query && !searchable.includes(query)) return false;
    if (state.type && vehicle.type !== state.type) return false;
    if (state.brand && vehicle.brand !== state.brand) return false;
    if (Number.isFinite(vehicle.year) && (vehicle.year < state.yearMin || vehicle.year > state.yearMax)) return false;

    if (Number.isFinite(vehicle.priceValue)) {
      const hasUpperLimit = state.priceMax < PRICE_FILTER_LIMIT;
      if (vehicle.priceValue < state.priceMin) return false;
      if (hasUpperLimit && vehicle.priceValue > state.priceMax) return false;
    }

    return true;
  }

  function getVisiblePageItems(totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set([1, totalPages, state.page - 1, state.page, state.page + 1]);
    const normalized = [...pages]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);

    const result = [];
    normalized.forEach((page, index) => {
      const previous = normalized[index - 1];
      if (previous && page - previous > 1) {
        result.push("ellipsis");
      }
      result.push(page);
    });

    return result;
  }

  function scrollToCatalogTop() {
    const target = document.querySelector(".catalog-results");
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  }

  function renderPagination(totalItems, itemsPerPage) {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    pagination.innerHTML = "";

    if (totalItems <= itemsPerPage) {
      pagination.hidden = true;
      return;
    }

    pagination.hidden = false;

    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.className = "pagination-btn";
    previousButton.textContent = "Anterior";
    previousButton.disabled = state.page === 1;
    previousButton.addEventListener("click", () => {
      if (state.page === 1) return;
      state.page -= 1;
      updateUrl();
      renderCatalog({ scrollToTop: true });
    });
    pagination.appendChild(previousButton);

    getVisiblePageItems(totalPages).forEach((item) => {
      if (item === "ellipsis") {
        const ellipsis = document.createElement("span");
        ellipsis.className = "pagination-ellipsis";
        ellipsis.textContent = "...";
        pagination.appendChild(ellipsis);
        return;
      }

      const pageButton = document.createElement("button");
      pageButton.type = "button";
      pageButton.className = `pagination-number${item === state.page ? " pagination-active" : ""}`;
      pageButton.textContent = String(item);
      pageButton.setAttribute("aria-label", `Ir a la página ${item}`);
      if (item === state.page) {
        pageButton.setAttribute("aria-current", "page");
      }
      pageButton.addEventListener("click", () => {
        if (item === state.page) return;
        state.page = item;
        updateUrl();
        renderCatalog({ scrollToTop: true });
      });
      pagination.appendChild(pageButton);
    });

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "pagination-btn";
    nextButton.textContent = "Siguiente";
    nextButton.disabled = state.page === totalPages;
    nextButton.addEventListener("click", () => {
      if (state.page === totalPages) return;
      state.page += 1;
      updateUrl();
      renderCatalog({ scrollToTop: true });
    });
    pagination.appendChild(nextButton);
  }

  function renderCatalog({ scrollToTop = false } = {}) {
    normalizeState();
    updateRangeOutputs();

    const filtered = sortVehicles(vehicles.filter(matchesFilters));
    const itemsPerPage = getItemsPerPage();
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    state.page = Math.min(Math.max(state.page, 1), totalPages);

    const startIndex = (state.page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const visibleVehicles = filtered.slice(startIndex, endIndex);

    grid.innerHTML = "";
    grid.removeAttribute("aria-busy");

    visibleVehicles.forEach((vehicle) => {
      grid.appendChild(createVehicleCard(vehicle, true));
    });

    if (!filtered.length) {
      summary.textContent = "Mostrando 0 unidades";
      grid.innerHTML = `
        <article class="catalog-empty">
          <p class="eyebrow">${vehicles.length ? "Sin resultados" : "Catálogo vacío"}</p>
          <h3>${vehicles.length ? "No encontramos vehículos con esa combinación de filtros." : "No hay vehículos publicados en este momento."}</h3>
          <p>${vehicles.length ? "Probá limpiando algunos criterios o buscá una marca o modelo diferente." : "Volvé a consultar pronto o escribinos por WhatsApp."}</p>
        </article>
      `;
    } else {
      summary.textContent = `Mostrando ${startIndex + 1}-${Math.min(endIndex, filtered.length)} de ${filtered.length} unidades`;
    }

    renderPagination(filtered.length, itemsPerPage);

    if (scrollToTop) {
      scrollToCatalogTop();
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
    if (state.page > 1) params.set("page", String(state.page));
    history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
  }

  function applyStateFromInputs() {
    state.query = queryInput.value.trim();
    state.type = filterEls.type.value;
    state.brand = filterEls.brand.value;
    state.order = orderSelect.value;
    state.page = 1;
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
      order: "featured",
      page: 1
    };
    syncInputsFromState();
    updateUrl();
    renderCatalog();
  }

  populateFilters();
  readUrlState();
  syncInputsFromState();
  renderCatalog();

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyStateFromInputs();
  });

  [filterEls.type, filterEls.brand, orderSelect]
    .filter(Boolean)
    .forEach((input) => input.addEventListener("change", applyStateFromInputs));

  [filterEls.yearMin, filterEls.yearMax, filterEls.priceMin, filterEls.priceMax]
    .forEach((input) => input.addEventListener("input", applyStateFromInputs));

  clearFiltersButton.addEventListener("click", resetFilters);

  window.addEventListener("resize", () => {
    const nextItemsPerPage = getItemsPerPage();
    if (nextItemsPerPage === lastItemsPerPage) return;
    lastItemsPerPage = nextItemsPerPage;
    renderCatalog();
  });
  });
})();

