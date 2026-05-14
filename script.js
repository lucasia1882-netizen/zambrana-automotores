(() => {
  const config = window.zambranaConfig || {};
  const vehicles = window.zambranaVehicles || [];
  const whatsappNumber = config.whatsappNumber || "5493512308551";

  const STATUS_MAP = {
    disponible: "status-disponible",
    señado: "status-senado",
    senado: "status-senado",
    "en preparación": "status-en-preparacion",
    "en preparacion": "status-en-preparacion"
  };

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function formatKms(value) {
    if (value === null || value === undefined || value === "") {
      return "Consultar";
    }
    return `${new Intl.NumberFormat("es-AR").format(value)} km`;
  }

  function shouldShowPrice(vehicle) {
    return vehicle.price && String(vehicle.price).trim().toLowerCase() !== "consultar";
  }

  function getStatusClass(status) {
    return STATUS_MAP[String(status || "").toLowerCase()] || "status-disponible";
  }

  function createWhatsAppLink(vehicle) {
    const message = `Hola Zambrana Automotores, quiero consultar por el ${vehicle.fullName} ${vehicle.year}.`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function createVehicleCard(vehicle, compact = false) {
    const article = document.createElement("article");
    article.className = `vehicle-card ${compact ? "vehicle-card-compact" : ""}`;

    article.innerHTML = `
      <a class="vehicle-media-link" href="vehiculo.html?slug=${vehicle.slug}">
        <div class="vehicle-media">
          <img class="vehicle-image" src="${vehicle.image}" alt="${vehicle.fullName}"${vehicle.imagePosition ? ` style="object-position:${vehicle.imagePosition};"` : ""}>
          <span class="vehicle-tag ${getStatusClass(vehicle.status)}">${vehicle.status}</span>
        </div>
      </a>
      <div class="vehicle-body">
        <div class="vehicle-meta">
          <span>${vehicle.brand}</span>
          <span>${vehicle.type}</span>
        </div>
        <a class="vehicle-title-link" href="vehiculo.html?slug=${vehicle.slug}">
          <h3 class="vehicle-title">${vehicle.fullName}</h3>
        </a>
          <div class="vehicle-inline-specs">
            <span>${formatKms(vehicle.kms)}</span>
            <span>${vehicle.year}</span>
            <span>${vehicle.fuel}</span>
          </div>
          <div class="vehicle-card-footer">
            <strong class="vehicle-price ${shouldShowPrice(vehicle) ? "" : "is-hidden"}">${vehicle.price}</strong>
            <div class="vehicle-card-actions">
              <a class="card-action-primary" href="${createWhatsAppLink(vehicle)}" target="_blank" rel="noreferrer">Consultar</a>
              <a class="card-action-secondary" href="vehiculo.html?slug=${vehicle.slug}">Ver ficha</a>
            </div>
          </div>
      </div>
    `;

    return article;
  }

  function renderSellers() {
    const grid = document.querySelector("#sellers-grid");
    if (!grid) return;

    const sellers = config.sellers || [];
    grid.innerHTML = sellers.map((seller, index) => `
      <article class="seller-card">
        <div class="seller-avatar">${seller.name.charAt(0)}</div>
        <strong>${seller.name}</strong>
        <span>${seller.role}</span>
      </article>
    `).join("");
  }

  function initReveals() {
    const revealItems = document.querySelectorAll(".reveal-up");
    if (!revealItems.length) return;

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.16,
        rootMargin: "0px 0px -40px 0px"
      });

      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    }
  }

  function initHeroSlider() {
    const slides = [...document.querySelectorAll(".hero-slide")];
    if (slides.length < 2) return;

    let currentIndex = 0;
    const prev = document.querySelector("[data-hero-prev]");
    const next = document.querySelector("[data-hero-next]");
    let intervalId = null;

    const showSlide = (index) => {
      slides[currentIndex].classList.remove("is-active");
      currentIndex = (index + slides.length) % slides.length;
      slides[currentIndex].classList.add("is-active");
    };

    const startAutoPlay = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      intervalId = window.setInterval(() => {
        showSlide(currentIndex + 1);
      }, 4600);
    };

    prev?.addEventListener("click", () => {
      showSlide(currentIndex - 1);
      startAutoPlay();
    });

    next?.addEventListener("click", () => {
      showSlide(currentIndex + 1);
      startAutoPlay();
    });

    startAutoPlay();
  }

  function populateQuickSearch() {
    const brandSelect = document.querySelector('.quick-search-form select[name="brand"]');
    const yearSelect = document.querySelector('.quick-search-form select[name="year"]');
    if (!brandSelect || !yearSelect) return;

    const brands = [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort();
    const years = [...new Set(vehicles.map((vehicle) => vehicle.year))].sort((a, b) => b - a);

    brands.forEach((brand) => {
      const option = document.createElement("option");
      option.value = brand;
      option.textContent = brand;
      brandSelect.appendChild(option);
    });

    years.forEach((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.appendChild(option);
    });
  }

  function initQuickSearch() {
    const form = document.querySelector("#quick-search-form");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const params = new URLSearchParams();

      if (formData.get("brand")) params.set("brand", String(formData.get("brand")));
      if (formData.get("model")) params.set("model", String(formData.get("model")).trim());
      if (formData.get("year")) params.set("year", String(formData.get("year")));

      window.location.href = `catalog.html${params.toString() ? `?${params}` : ""}`;
    });
  }

  async function submitLeadForm(formData) {
    const endpoint = (config.googleSheetsEndpoint || "").trim();
    const payload = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      message: formData.get("message"),
      source: "zambrana-home",
      createdAt: new Date().toISOString()
    };

    if (!endpoint) {
      const demoLeads = JSON.parse(localStorage.getItem("zambrana-demo-leads") || "[]");
      demoLeads.push(payload);
      localStorage.setItem("zambrana-demo-leads", JSON.stringify(demoLeads));
      return { mode: "demo" };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("No se pudo enviar la consulta");
    }

    return { mode: "live" };
  }

  function initLeadForm() {
    const form = document.querySelector("#lead-form");
    const feedback = document.querySelector("#lead-form-feedback");
    if (!form || !feedback) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      feedback.textContent = "Enviando consulta...";
      feedback.className = "form-feedback is-pending";

      try {
        const result = await submitLeadForm(new FormData(form));
        feedback.textContent = result.mode === "demo"
          ? "Consulta guardada en modo demo. Cuando definamos el endpoint real de Google Sheets, este formulario quedará conectado."
          : "Consulta enviada correctamente. Te vamos a contactar a la brevedad.";
        feedback.className = "form-feedback is-success";
        form.reset();
      } catch (error) {
        feedback.textContent = "No pudimos enviar la consulta en este momento. Probá de nuevo o escribinos por WhatsApp.";
        feedback.className = "form-feedback is-error";
      }
    });
  }

  function initOpportunitiesCarousel() {
    const track = document.querySelector("#opportunities-track");
    if (!track) return;

    const baseItems = vehicles.slice(0, 6);
    const selected = [];

    while (selected.length < 8 && baseItems.length > 0) {
      selected.push(...baseItems);
    }

    track.innerHTML = "";
    selected.slice(0, Math.max(8, baseItems.length)).forEach((vehicle) => {
      track.appendChild(createVehicleCard(vehicle, true));
    });

    const prev = document.querySelector("[data-carousel-prev]");
    const next = document.querySelector("[data-carousel-next]");
    const step = () => Math.max(track.clientWidth * 0.86, 280);
    let autoScroll = null;

    const scrollNext = () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= maxScroll - 8) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        track.scrollBy({ left: step(), behavior: "smooth" });
      }
    };

    const restartAuto = () => {
      if (autoScroll) {
        window.clearInterval(autoScroll);
      }
      autoScroll = window.setInterval(scrollNext, 3400);
    };

    prev?.addEventListener("click", () => {
      if (track.scrollLeft <= 8) {
        track.scrollTo({ left: track.scrollWidth, behavior: "smooth" });
      } else {
        track.scrollBy({ left: -step(), behavior: "smooth" });
      }
      restartAuto();
    });

    next?.addEventListener("click", () => {
      scrollNext();
      restartAuto();
    });

    restartAuto();
  }

  function initVehicleDetail() {
    const container = document.querySelector("#vehicle-detail");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    const vehicle = vehicles.find((item) => item.slug === slug);

    if (!vehicle) {
      container.innerHTML = `
        <section class="vehicle-empty">
          <p class="eyebrow">Unidad no encontrada</p>
          <h1>No encontramos esa ficha dentro de esta maqueta.</h1>
          <a class="primary-btn" href="catalog.html">Volver al catálogo</a>
        </section>
      `;
      return;
    }

    const gallery = [vehicle.image, ...(vehicle.gallery || []).filter((image) => image !== vehicle.image)];

    container.innerHTML = `
      <div class="vehicle-detail-shell">
        <div class="vehicle-detail-gallery">
          <div class="vehicle-detail-main">
            <img id="vehicle-detail-image" src="${vehicle.image}" alt="${vehicle.fullName}"${vehicle.imagePosition ? ` style="object-position:${vehicle.imagePosition};"` : ""}>
          </div>
          <div class="vehicle-detail-thumbs">
            ${gallery.map((image, index) => `
              <button class="vehicle-detail-thumb ${index === 0 ? "is-active" : ""}" type="button" data-image="${image}">
                <img src="${image}" alt="${vehicle.fullName} foto ${index + 1}">
              </button>
            `).join("")}
          </div>
        </div>
        <div class="vehicle-detail-copy">
          <a class="text-link" href="catalog.html">Volver al catálogo</a>
          <p class="eyebrow">${vehicle.brand} · ${vehicle.type}</p>
          <h1>${vehicle.fullName}</h1>
          <div class="vehicle-detail-header">
            <span class="vehicle-tag ${getStatusClass(vehicle.status)}">${vehicle.status}</span>
            <strong class="vehicle-price">${vehicle.price}</strong>
          </div>
          <p class="vehicle-description">${vehicle.description}</p>
          <ul class="vehicle-specs">
            <li><strong>Año</strong><span>${vehicle.year}</span></li>
            <li><strong>Kilómetros</strong><span>${formatKms(vehicle.kms)}</span></li>
            <li><strong>Transmisión</strong><span>${vehicle.transmission}</span></li>
            <li><strong>Combustible</strong><span>${vehicle.fuel}</span></li>
            <li><strong>Color</strong><span>${vehicle.color}</span></li>
            <li><strong>Estado</strong><span>${vehicle.status}</span></li>
          </ul>
          <div class="vehicle-highlights">
            ${vehicle.highlights.map((highlight) => `<span>${highlight}</span>`).join("")}
          </div>
          <div class="hero-actions">
            <a class="primary-btn" href="${createWhatsAppLink(vehicle)}" target="_blank" rel="noreferrer">Consultar esta unidad</a>
            <a class="secondary-dark-btn" href="catalog.html">Seguir viendo vehículos</a>
          </div>
        </div>
      </div>
    `;

    const mainImage = container.querySelector("#vehicle-detail-image");
    const thumbs = container.querySelectorAll(".vehicle-detail-thumb");
    thumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const image = thumb.getAttribute("data-image");
        if (!image || !mainImage) return;
        mainImage.src = image;
        thumbs.forEach((item) => item.classList.remove("is-active"));
        thumb.classList.add("is-active");
      });
    });
  }

  window.ZambranaSite = {
    vehicles,
    config,
    slugify,
    formatKms,
    getStatusClass,
    createVehicleCard,
    createWhatsAppLink
  };

  document.addEventListener("DOMContentLoaded", () => {
    initReveals();
    initVehicleDetail();

    if (document.body.dataset.page === "home") {
      initHeroSlider();
      populateQuickSearch();
      initQuickSearch();
      initLeadForm();
      initOpportunitiesCarousel();
      renderSellers();
    }
  });
})();
