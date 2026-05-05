const whatsappNumber = "5493512308551";
const vehicles = window.zambranaVehicles || [];

const grid = document.querySelector("#vehicles-grid");

function createWhatsAppLink(vehicle) {
  const message = `Hola Zambrana Automotores, quiero consultar por el ${vehicle.model} ${vehicle.year}.`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function renderThumbs(vehicle) {
  if (!vehicle.gallery || vehicle.gallery.length === 0) {
    return "";
  }

  return `
    <div class="vehicle-thumbs">
      ${vehicle.gallery.slice(0, 3).map((image, index) => `
        <button class="vehicle-thumb" type="button" data-image="${image}" aria-label="Ver foto ${index + 1} de ${vehicle.model}">
          <img src="${image}" alt="${vehicle.model} vista ${index + 1}">
        </button>
      `).join("")}
    </div>
  `;
}

function renderHighlights(vehicle) {
  if (!vehicle.highlights || vehicle.highlights.length === 0) {
    return "";
  }

  return `
    <div class="vehicle-highlights">
      ${vehicle.highlights.map((highlight) => `<span>${highlight}</span>`).join("")}
    </div>
  `;
}

function renderVehicles() {
  if (!grid) {
    return;
  }

  grid.innerHTML = "";

  vehicles.forEach((vehicle) => {
    const card = document.createElement("article");
    card.className = "vehicle-card reveal-up";

    card.innerHTML = `
      <div class="vehicle-media">
        <img class="vehicle-image" src="${vehicle.image}" alt="${vehicle.model}">
        ${vehicle.gallery ? `<span class="vehicle-photo-count">${vehicle.gallery.length + 1} fotos</span>` : ""}
        ${renderThumbs(vehicle)}
      </div>
      <div class="vehicle-body">
        <div class="vehicle-topline">
          <div>
            <span class="vehicle-tag">${vehicle.status}</span>
            <h3 class="vehicle-title">${vehicle.model}</h3>
            <p class="vehicle-price">${vehicle.price}</p>
          </div>
        </div>
        <ul class="vehicle-specs">
          <li><strong>Ano</strong><span>${vehicle.year}</span></li>
          <li><strong>Kilometraje</strong><span>${vehicle.kms}</span></li>
          <li><strong>Transmision</strong><span>${vehicle.transmission}</span></li>
          <li><strong>Combustible</strong><span>${vehicle.fuel}</span></li>
          <li><strong>Color</strong><span>${vehicle.color}</span></li>
          <li><strong>Estado</strong><span>${vehicle.status}</span></li>
        </ul>
        <p class="vehicle-description">${vehicle.description}</p>
        ${renderHighlights(vehicle)}
        <div class="vehicle-actions">
          <a class="primary-btn" href="${createWhatsAppLink(vehicle)}" target="_blank" rel="noreferrer">Consultar esta unidad</a>
        </div>
      </div>
    `;

    grid.appendChild(card);

    const mainImage = card.querySelector(".vehicle-image");
    const thumbButtons = card.querySelectorAll(".vehicle-thumb");

    if (thumbButtons[0]) {
      thumbButtons[0].classList.add("is-active");
    }

    thumbButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextImage = button.getAttribute("data-image");

        if (!nextImage || !mainImage) {
          return;
        }

        mainImage.src = nextImage;

        thumbButtons.forEach((thumb) => thumb.classList.remove("is-active"));
        button.classList.add("is-active");
      });
    });
  });
}

renderVehicles();

const revealItems = document.querySelectorAll(".reveal-up");

if ("IntersectionObserver" in window && revealItems.length > 0) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.18,
    rootMargin: "0px 0px -40px 0px"
  });

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
