(() => {
  const config = window.zambranaConfig || {};
  const vehicles = window.zambranaVehicles || [];
  const whatsappNumber = config.whatsappNumber || "5493512308551";

  const STATUS_MAP = {
    disponible: "status-disponible",
    señalado: "status-senado",
    senado: "status-senado",
    "en preparación": "status-en-preparacion",
    "en preparacion": "status-en-preparacion"
  };

  const BRAND_LOGO_MAP = {
    audi: "assets/brands/audi.png",
    bajaj: "assets/brands/bajaj.webp",
    brava: "assets/brands/brava.png",
    chevrolet: "assets/brands/chevrolet.png",
    citroen: "assets/brands/citroen.png",
    fiat: "assets/brands/fiat.png",
    ford: "assets/brands/ford.png",
    honda: "assets/brands/honda.png",
    jeep: "assets/brands/jeep.png",
    mercedes: "assets/brands/mercedes.png",
    "mercedes-benz": "assets/brands/mercedes.png",
    motomel: "assets/brands/motomel.png",
    nissan: "assets/brands/nissan.png",
    peugeot: "assets/brands/peugeot.png",
    renault: "assets/brands/renault.png",
    suzuki: "assets/brands/suzuki.png",
    toyota: "assets/brands/toyota.png",
    volkswagen: "assets/brands/volkswagen.png",
    yamaha: "assets/brands/yamaha.png",
    zanella: "assets/brands/zanella.png"
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

  function getBrandLogoPath(brand) {
    return BRAND_LOGO_MAP[slugify(brand)] || "";
  }

  function createWhatsAppLink(vehicle) {
    const message = `Hola Zambrana Automotores, quiero consultar por el ${vehicle.fullName} ${vehicle.year}.`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function createVehicleCard(vehicle, compact = false) {
    const article = document.createElement("article");
    const brandLogo = getBrandLogoPath(vehicle.brand);
    const cardImage = vehicle.cardImage || vehicle.image;
    const cardImagePosition = vehicle.cardImagePosition || vehicle.imagePosition || "center 50%";
    article.className = `vehicle-card ${compact ? "vehicle-card-compact" : ""}`;

    article.innerHTML = `
      <a class="vehicle-card-overlay" href="vehiculo.html?slug=${vehicle.slug}" aria-label="Ver ficha de ${vehicle.fullName}"></a>
      <a class="vehicle-media-link" href="vehiculo.html?slug=${vehicle.slug}">
        <div class="vehicle-media">
          <div class="vehicle-image-backdrop" style="background-image:url('${cardImage}');"></div>
          <img class="vehicle-image" src="${cardImage}" alt="${vehicle.fullName}" style="object-position:${cardImagePosition};">
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
              <span class="vehicle-spec-basic">${formatKms(vehicle.kms)}</span>
              <span class="vehicle-spec-basic">${vehicle.year}</span>
              <span class="vehicle-spec-fuel">
                <img src="assets/icons/gasolinera.png" alt="">
                <span>${vehicle.fuel}</span>
              </span>
            </div>
          <div class="vehicle-card-footer">
            <strong class="vehicle-price ${shouldShowPrice(vehicle) ? "" : "is-hidden"}">${vehicle.price}</strong>
            ${brandLogo ? `<div class="vehicle-card-footer-right"><div class="vehicle-brand-mark" aria-hidden="true"><img src="${brandLogo}" alt="${vehicle.brand}"></div></div>` : ""}
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
      <article class="seller-card reveal-up seller-card-drive" style="transition-delay:${120 + (index * 110)}ms">
        <div class="seller-avatar">${seller.name.charAt(0)}</div>
        <strong>${seller.name}</strong>
        <span>${seller.role}</span>
      </article>
    `).join("");
  }

  function initBrandStrip() {
    const track = document.querySelector(".brands-track");
    if (!track) return;

    const motoBrands = [
      { name: "Honda", src: "assets/brands/honda.png" },
      { name: "Yamaha", src: "assets/brands/yamaha.png" },
      { name: "Suzuki", src: "assets/brands/suzuki.png" },
      { name: "Bajaj", src: "assets/brands/bajaj.webp" },
      { name: "Motomel", src: "assets/brands/motomel.png" },
      { name: "Brava", src: "assets/brands/brava.png" },
      { name: "Zanella", src: "assets/brands/zanella.png" }
    ];

    const existing = new Set(
      [...track.querySelectorAll("img")]
        .map((img) => (img.getAttribute("alt") || "").trim().toLowerCase())
        .filter(Boolean)
    );

    motoBrands.forEach((brand) => {
      if (existing.has(brand.name.toLowerCase())) return;
      const logo = document.createElement("img");
      logo.src = brand.src;
      logo.alt = brand.name;
      track.appendChild(logo);
    });

    motoBrands.forEach((brand) => {
      const clone = document.createElement("img");
      clone.src = brand.src;
      clone.alt = "";
      track.appendChild(clone);
    });
  }

  function relocateUsedCarSection() {
    const usedSection = document.querySelector("#vendetuauto");
    const contactSection = document.querySelector("#ubicacion");
    const sellersSection = document.querySelector("#vendedores");
    if (!usedSection || !contactSection || !sellersSection) return;
    if (usedSection.compareDocumentPosition(contactSection) & Node.DOCUMENT_POSITION_FOLLOWING) {
      sellersSection.parentNode.insertBefore(usedSection, sellersSection);
    }
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

  function initHeroIntro() {
    const hero = document.querySelector(".hero-home");
    if (!hero) return;

    window.requestAnimationFrame(() => {
      hero.classList.add("is-ready");
    });
  }

  function initPageTransitions() {
    document.body.classList.add("page-is-entering");

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.body.classList.remove("page-is-entering");
      });
    });

    const pageLinks = document.querySelectorAll('a[href$=".html"], a[href*=".html?"]');
    pageLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");
        if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.getAttribute("target") === "_blank") return;

        event.preventDefault();
        document.body.classList.add("page-is-leaving");

        window.setTimeout(() => {
          window.location.href = href;
        }, 420);
      });
    });
  }

  function initHeroSlider() {
    const slides = [...document.querySelectorAll(".hero-slide")];
    if (slides.length < 2) return;

    let currentIndex = 0;
    const prev = document.querySelector("[data-hero-prev]");
    const next = document.querySelector("[data-hero-next]");
    let intervalId = null;

    slides.forEach((slide) => {
      const video = slide.querySelector("video");
      if (!video) return;

      const markReady = () => {
        slide.classList.add("is-video-ready");
      };

      const markFallback = () => {
        slide.classList.remove("is-video-ready");
      };

      video.addEventListener("loadeddata", markReady, { once: true });
      video.addEventListener("canplay", markReady);
      video.addEventListener("playing", markReady);
      video.addEventListener("timeupdate", markReady);
      video.addEventListener("stalled", markFallback);
      video.addEventListener("abort", markFallback);
      video.addEventListener("error", markFallback);

      const playPromise = video.play?.();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          markFallback();
        });
      }
    });

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
    const now = new Date().toISOString();
    const payload = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      source: "zambrana-home",
      channel: "Web",
      status: "Nuevo",
      vendor: "",
      pageUrl: window.location.href,
      pageTitle: document.title,
      createdAt: now,
      submittedAt: now
    };

    if (!endpoint) {
      const demoLeads = JSON.parse(localStorage.getItem("zambrana-demo-leads") || "[]");
      demoLeads.push(payload);
      localStorage.setItem("zambrana-demo-leads", JSON.stringify(demoLeads));
      return { mode: "demo" };
    }

    const isGoogleAppsScript = /script\.google\.com/i.test(endpoint);

    if (isGoogleAppsScript) {
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      return { mode: "live" };
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
          ? "Consulta guardada en modo demo. Cuando definamos el endpoint real de Google Sheets, este formulario queda conectado."
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
      const galleryImagePosition = vehicle.galleryImagePosition || vehicle.imagePosition || "center 50%";
      const brandLogo = getBrandLogoPath(vehicle.brand);

    container.innerHTML = `
        <div class="vehicle-detail-shell">
          <div class="vehicle-detail-gallery">
            <div class="vehicle-detail-carousel">
              <div class="vehicle-detail-carousel-track" id="vehicle-detail-track">
                ${gallery.map((image, index) => `
                  <button
                    class="vehicle-detail-slide ${index === 0 ? "is-active" : ""}"
                    type="button"
                    data-gallery-slide="${index}"
                    style="--slide-image:url('${image}')"
                    aria-label="Ver foto ${index + 1}"
                  >
                    <img
                      src="${image}"
                      alt="${vehicle.fullName} foto ${index + 1}"
                      style="object-position:${galleryImagePosition};"
                    >
                  </button>
                `).join("")}
                <button class="vehicle-gallery-arrow vehicle-gallery-arrow-left" type="button" data-gallery-prev aria-label="Ver foto anterior">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 10.83 12l4.58 4.59L14 18l-6-6 6-6z"/></svg>
                </button>
                <button class="vehicle-gallery-arrow vehicle-gallery-arrow-right" type="button" data-gallery-next aria-label="Ver foto siguiente">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 4.58-4.59-4.58-4.59L10 6l6 6-6 6z"/></svg>
                </button>
              </div>
              <div class="vehicle-gallery-dots" id="vehicle-gallery-dots" aria-label="Indicadores de galería">
                ${gallery.map((_, index) => `
                  <button
                    class="vehicle-gallery-dot ${index === 0 ? "is-active" : ""}"
                    type="button"
                    data-gallery-dot="${index}"
                    aria-label="Ir a foto ${index + 1}"
                  ></button>
                `).join("")}
              </div>
            </div>
          </div>
        <div class="vehicle-detail-copy">
          <a class="text-link" href="catalog.html">Volver al catálogo</a>
          <div class="vehicle-detail-top">
            <div class="vehicle-detail-heading">
              <p class="eyebrow">${vehicle.brand} · ${vehicle.type}</p>
              <h1>${vehicle.fullName}</h1>
              <div class="vehicle-detail-header">
                <span class="vehicle-tag ${getStatusClass(vehicle.status)}">${vehicle.status}</span>
              </div>
            </div>
            ${brandLogo ? `
              <div class="vehicle-detail-brand-mark" aria-hidden="true">
                <img src="${brandLogo}" alt="${vehicle.brand}">
              </div>
            ` : ""}
          </div>
            <p class="vehicle-description">${vehicle.description}</p>
            <ul class="vehicle-specs">
              <li><strong><img class="vehicle-spec-icon" src="assets/icons/etiqueta.png" alt="">Año</strong><span>${vehicle.year}</span></li>
              <li><strong><img class="vehicle-spec-icon" src="assets/icons/coche.png" alt="">Kilómetros</strong><span>${formatKms(vehicle.kms)}</span></li>
              <li><strong><img class="vehicle-spec-icon" src="assets/icons/vehiculo.png" alt="">Transmisión</strong><span>${vehicle.transmission}</span></li>
              <li><strong><img class="vehicle-spec-icon" src="assets/icons/gasolinera.png" alt="">Combustible</strong><span>${vehicle.fuel}</span></li>
              <li><strong><img class="vehicle-spec-icon" src="assets/icons/etiqueta.png" alt="">Color</strong><span>${vehicle.color}</span></li>
              <li><strong><img class="vehicle-spec-icon" src="assets/icons/etiqueta.png" alt="">Estado</strong><span>${vehicle.status}</span></li>
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

      const slides = Array.from(container.querySelectorAll("[data-gallery-slide]"));
      const dots = Array.from(container.querySelectorAll("[data-gallery-dot]"));
      const prev = container.querySelector("[data-gallery-prev]");
      const next = container.querySelector("[data-gallery-next]");
      let currentIndex = 0;

      function updateGallery(index) {
        currentIndex = (index + gallery.length) % gallery.length;

        slides.forEach((slide, slideIndex) => {
          slide.classList.remove("is-active", "is-prev", "is-next", "is-hidden");

          if (slideIndex === currentIndex) {
            slide.classList.add("is-active");
            return;
          }

          if (slideIndex === (currentIndex - 1 + gallery.length) % gallery.length) {
            slide.classList.add("is-prev");
            return;
          }

          if (slideIndex === (currentIndex + 1) % gallery.length) {
            slide.classList.add("is-next");
            return;
          }

          slide.classList.add("is-hidden");
        });

        dots.forEach((dot, dotIndex) => {
          dot.classList.toggle("is-active", dotIndex === currentIndex);
        });
      }

      slides.forEach((slide) => {
        slide.addEventListener("click", () => {
          const nextIndex = Number(slide.dataset.gallerySlide);
          if (!Number.isNaN(nextIndex)) {
            updateGallery(nextIndex);
          }
        });
      });

      dots.forEach((dot) => {
        dot.addEventListener("click", () => {
          const nextIndex = Number(dot.dataset.galleryDot);
          if (!Number.isNaN(nextIndex)) {
            updateGallery(nextIndex);
          }
        });
      });

      prev?.addEventListener("click", () => {
        updateGallery(currentIndex - 1);
      });

      next?.addEventListener("click", () => {
        updateGallery(currentIndex + 1);
      });

      updateGallery(0);
    }

    function initTestimonialsCarousel() {
      const slider = document.querySelector("#testimonials-slider");
      const track = slider?.querySelector(".testimonial-track");
      const cards = track ? Array.from(track.querySelectorAll(".testimonial-card")) : [];
      const prev = slider?.querySelector(".testimonial-arrow-prev");
      const next = slider?.querySelector(".testimonial-arrow-next");
      const dotsContainer = document.querySelector("#testimonial-dots");

      if (!slider || !track || !cards.length || !dotsContainer) {
        return;
      }

      let currentPage = 0;
      let perView = 3;
      let pageCount = 1;
      let dots = [];

      const getPerView = () => {
        if (window.innerWidth <= 640) return 1;
        if (window.innerWidth <= 980) return 2;
        return 3;
      };

      const buildDots = () => {
        dotsContainer.innerHTML = "";
        dots = Array.from({ length: pageCount }, (_, index) => {
          const dot = document.createElement("button");
          dot.type = "button";
          dot.className = "testimonial-dot";
          dot.setAttribute("aria-label", `Ir a la página ${index + 1} de testimonios`);
          dot.addEventListener("click", () => {
            currentPage = index;
            update();
          });
          dotsContainer.appendChild(dot);
          return dot;
        });
      };

      const update = () => {
        const firstCard = cards[currentPage * perView] ?? cards[0];
        const offset = firstCard ? firstCard.offsetLeft : 0;

        track.style.transform = `translate3d(${-offset}px, 0, 0)`;

        dots.forEach((dot, index) => {
          dot.classList.toggle("is-active", index === currentPage);
        });

        prev?.classList.toggle("is-disabled", pageCount <= 1);
        next?.classList.toggle("is-disabled", pageCount <= 1);
      };

      const refresh = () => {
        perView = getPerView();
        pageCount = Math.max(1, Math.ceil(cards.length / perView));
        currentPage = Math.min(currentPage, pageCount - 1);
        slider.style.setProperty("--testimonial-per-view", String(perView));
        buildDots();
        update();
      };

      prev?.addEventListener("click", () => {
        currentPage = (currentPage - 1 + pageCount) % pageCount;
        update();
      });

      next?.addEventListener("click", () => {
        currentPage = (currentPage + 1) % pageCount;
        update();
      });

      window.addEventListener("resize", refresh);
      refresh();
    }

  window.ZambranaSite = {
    vehicles,
    config,
    slugify,
    formatKms,
    getBrandLogoPath,
    getStatusClass,
    createVehicleCard,
    createWhatsAppLink
  };

  document.addEventListener("DOMContentLoaded", () => {
    initPageTransitions();
    initHeroIntro();
    initVehicleDetail();

    if (document.body.dataset.page === "home") {
      initHeroSlider();
      initBrandStrip();
      populateQuickSearch();
      initQuickSearch();
      initLeadForm();
      initOpportunitiesCarousel();
      relocateUsedCarSection();
      renderSellers();
      initTestimonialsCarousel();
    }

    initReveals();
  });
})();
