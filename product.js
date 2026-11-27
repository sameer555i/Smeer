document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const prodId = params.get("id");
  const detailBox = document.getElementById("productDetailBox");

  if (!prodId) {
    detailBox.innerHTML = `<div class="empty-state">Product ID missing. <br/><br/><a href="index.html" class="btn btn-primary">Back to Catalog</a></div>`;
    return;
  }

  try {
    const data = await StoreAPI.fetchAll(false);
    if (data.status !== "success") {
      detailBox.innerHTML = `<div class="empty-state">${escapeHtml(data.message || "Failed to load product.")}</div>`;
      return;
    }

    const settings = data.settings || {};
    const products = data.products || [];
    document.title = `${settings.store_name || "Store"} - Product Details`;
    setupNavigation(settings.store_name);

    const product = products.find((p) => String(p.id) === String(prodId));
    if (!product) {
      detailBox.innerHTML = `<div class="empty-state">Product not found. <br/><br/><a href="index.html" class="btn btn-primary">Back to Catalog</a></div>`;
      return;
    }

    document.title = `${product.title} - ${settings.store_name || "Store"}`;
    renderProductDetail(product, settings);
    renderSuggestedProducts(product, products);
  } catch (err) {
    detailBox.innerHTML = `<div class="empty-state">Error loading product details.</div>`;
  }
});

function renderProductDetail(product, settings) {
  const detailBox = document.getElementById("productDetailBox");
  const stickyBar = document.getElementById("stickyBuyBar");
  const imgs = product.images && product.images.length ? product.images : [];

  const waNumber = String(settings.whatsapp_number || "917676729300").replace(/\D/g, "");
  const messageText =
    `Hello, I want to buy this product:\n\n` +
    `Product: ${product.title}\n` +
    `Category: ${product.category || "General"}\n` +
    `Description: ${product.description}\n` +
    `Link: ${window.location.href}`;

  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;

  const carouselHtml = imgs.length
    ? `
      <div id="swipeCarousel" class="swipe-carousel">
        ${imgs.map((url, i) => `
          <div class="swipe-slide">
            <img src="${url}" alt="${escapeHtml(product.title)} ${i + 1}" />
          </div>
        `).join("")}
      </div>
      ${imgs.length > 1 ? `
        <div id="carouselDots" class="carousel-dots">
          ${imgs.map((_, i) => `<span class="carousel-dot ${i === 0 ? "active" : ""}"></span>`).join("")}
        </div>
      ` : ""}
    `
    : `<div class="empty-state">No Image</div>`;

  detailBox.innerHTML = `
    ${carouselHtml}
    <div class="product-info-body">
      <div style="margin-bottom: 8px;">
        <span class="chip" style="margin-top: 0;">${escapeHtml(product.category || "General")}</span>
      </div>
      <h1 style="font-size: 1.25rem; line-height: 1.35; margin-bottom: 10px;">${escapeHtml(product.title)}</h1>
      <p style="color: var(--text-muted); font-size: 0.94rem; line-height: 1.6; white-space: pre-line;">${escapeHtml(product.description)}</p>
    </div>
  `;

  stickyBar.style.display = "flex";
  stickyBar.innerHTML = `
    <a href="index.html" class="btn">Catalog</a>
    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">Buy on WhatsApp</a>
  `;

  const carousel = document.getElementById("swipeCarousel");
  const dots = document.querySelectorAll("#carouselDots .carousel-dot");
  if (carousel && dots.length > 1) {
    carousel.addEventListener("scroll", () => {
      const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
      dots.forEach((dot, i) => dot.classList.toggle("active", i === idx));
    }, { passive: true });
  }
}

function renderSuggestedProducts(currentProduct, allProducts) {
  const suggestedIds = currentProduct.suggestedIds || [];
  if (!suggestedIds.length) return;

  const suggestedItems = suggestedIds
    .map((id) => allProducts.find((p) => String(p.id) === String(id)))
    .filter(Boolean);

  if (!suggestedItems.length) return;

  const section = document.getElementById("suggestedSection");
  const grid = document.getElementById("suggestedGrid");
  section.style.display = "block";

  grid.innerHTML = suggestedItems.map((item) => {
    const firstImg = item.images && item.images[0] ? item.images[0] : "";
    const url = `product.html?id=${encodeURIComponent(item.id)}`;
    return `
      <article class="card">
        <div class="card-img-wrap" onclick="location.href='${url}'">
          ${firstImg ? `<img src="${firstImg}" alt="${escapeHtml(item.title)}" loading="lazy" />` : ""}
          <span class="badge-top">${escapeHtml(item.category || "General")}</span>
        </div>
        <div class="card-body">
          <div class="card-title" onclick="location.href='${url}'">${escapeHtml(item.title)}</div>
          <div class="card-desc">${escapeHtml(item.description)}</div>
          <div class="card-footer">
            <a href="${url}" class="btn btn-sm btn-primary">View</a>
          </div>
        </div>
      </article>
    `;
  }).join("");
}
