function parsePricingFromDesc(desc) {
  const raw = String(desc || "");
  const headerMatch = raw.match(/^\[([^\]]+)\]\s*\n?/);
  if (!headerMatch) {
    return { mrp: "", price: "", cleanDesc: raw.trim() };
  }
  const metaPart = headerMatch[1];
  const hasMrpOrPrice = /\b(mrp|price)\s*:/i.test(metaPart);
  if (!hasMrpOrPrice) {
    return { mrp: "", price: "", cleanDesc: raw.trim() };
  }

  const mrpMatch = metaPart.match(/mrp\s*:\s*([^|]+)/i);
  const priceMatch = metaPart.match(/price\s*:\s*([^|]+)/i);

  return {
    mrp: mrpMatch ? mrpMatch[1].trim() : "",
    price: priceMatch ? priceMatch[1].trim() : "",
    cleanDesc: raw.slice(headerMatch[0].length).trim()
  };
}

function formatRupeeValue(val) {
  const clean = String(val || "").trim();
  if (!clean) return "";
  return clean.startsWith("₹") ? clean : `₹${clean}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const custom = JSON.parse(localStorage.getItem("sameer_custom_ui") || "{}");
    document.documentElement.style.setProperty("--card-radius", `${Number(custom.card_radius) || 16}px`);
    document.body.classList.toggle("compact-cards", Boolean(custom.compact_cards));
    document.body.classList.toggle("hide-dates", !custom.show_date);
  } catch (e) {}

  const params = new URLSearchParams(window.location.search);
  const prodId = params.get("id");
  const detailBox = document.getElementById("productDetailBox");

  if (!prodId) {
    detailBox.innerHTML = `<div class="empty-state">Product ID missing.<br/><br/><a href="index.html" class="btn btn-white">Back to Catalog</a></div>`;
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
    document.title = `${settings.store_name || "K-TECH"} - Product Details`;
    setupNavigation(settings.store_name);

    const product = products.find((p) => String(p.id) === String(prodId));
    if (!product) {
      detailBox.innerHTML = `<div class="empty-state">Product not found.<br/><br/><a href="index.html" class="btn btn-white">Back to Catalog</a></div>`;
      return;
    }

    document.title = `${product.title} - ${settings.store_name || "K-TECH"}`;
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
  const isOut = product.stockStatus === "out_of_stock" || Number(product.stockQty) <= 0;
  const stockLabel = isOut ? "Out of Stock" : `In Stock (${Number(product.stockQty ?? 10)} available)`;
  const { mrp, price, cleanDesc } = parsePricingFromDesc(product.description);
  const mrpFormatted = formatRupeeValue(mrp);
  const priceFormatted = formatRupeeValue(price);

  const waNumber = String(settings.whatsapp_number || "917676729300").replace(/\D/g, "");
  const messageText =
    `Hello, I want to inquire about this product:\n\n` +
    `Product: ${product.title}\n` +
    (priceFormatted ? `Rate: ${priceFormatted}\n` : "") +
    (mrpFormatted ? `MRP: ${mrpFormatted}\n` : "") +
    `Category: ${product.category || "General"}\n` +
    `Stock: ${stockLabel}\n` +
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

  const priceBlockHtml = (mrpFormatted || priceFormatted)
    ? `<div class="price-highlight-box" style="padding: 8px 12px; margin-bottom: 12px; width: fit-content;">
        ${priceFormatted ? `<span class="rate-pill" style="font-size: 1.15rem;">${escapeHtml(priceFormatted)}</span>` : ""}
        ${mrpFormatted ? `<span class="mrp-strike" style="font-size: 0.92rem;">MRP ${escapeHtml(mrpFormatted)}</span>` : ""}
       </div>`
    : "";

  detailBox.innerHTML = `
    ${carouselHtml}
    <div class="product-info-body">
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px;">
        <span class="chip" style="margin-top: 0;">${escapeHtml(product.category || "General")}</span>
        <span class="stock-tag ${isOut ? "stock-out" : "stock-in"}">${escapeHtml(stockLabel)}</span>
      </div>
      <h1 style="font-size: 1.25rem; line-height: 1.35; margin-bottom: 8px;">${escapeHtml(product.title)}</h1>
      ${priceBlockHtml}
      <p style="color: var(--text-muted); font-size: 0.94rem; line-height: 1.6; white-space: pre-line;">${escapeHtml(cleanDesc)}</p>
    </div>
  `;

  stickyBar.style.display = "flex";
  stickyBar.innerHTML = `
    <a href="index.html" class="btn btn-white">Catalog</a>
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
    const { mrp, price, cleanDesc } = parsePricingFromDesc(item.description);
    return `
      <article class="card" onclick="location.href='${url}'">
        <div class="card-img-wrap">
          ${firstImg ? `<img src="${firstImg}" alt="${escapeHtml(item.title)}" loading="lazy" />` : ""}
          <span class="badge-top">${escapeHtml(item.category || "General")}</span>
        </div>
        <div class="card-body">
          ${(mrp || price) ? `<div class="price-highlight-box">${price ? `<span class="rate-pill">${escapeHtml(formatRupeeValue(price))}</span>` : ""}${mrp ? `<span class="mrp-strike">MRP ${escapeHtml(formatRupeeValue(mrp))}</span>` : ""}</div>` : ""}
          <div class="card-title">${escapeHtml(item.title)}</div>
          <div class="card-desc">${escapeHtml(cleanDesc)}</div>
        </div>
      </article>
    `;
  }).join("");
}
