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
  const imgs = product.images && product.images.length ? product.images : [];
  const mainImg = imgs[0] || "";

  const waNumber = String(settings.whatsapp_number || "917676729300").replace(/\D/g, "");
  const messageText =
    `Hello, I want to buy this product:\n\n` +
    `Product: ${product.title}\n` +
    `Category: ${product.category || "General"}\n` +
    `Description: ${product.description}\n` +
    `Link: ${window.location.href}`;

  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;

  const thumbsHtml = imgs.length > 1
    ? `<div class="thumb-row" id="thumbRow">` +
      imgs.map((url, i) => `<img src="${url}" class="${i === 0 ? "active" : ""}" onclick="changeMainPhoto('${url}', this)" alt="Thumb ${i + 1}" />`).join("") +
      `</div>`
    : "";

  detailBox.innerHTML = `
    <div class="detail-layout">
      <div>
        <div class="main-photo-box">
          ${mainImg ? `<img id="mainProductImg" src="${mainImg}" alt="${escapeHtml(product.title)}" />` : `<div class="empty-state">No Image</div>`}
        </div>
        ${thumbsHtml}
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <span class="chip" style="margin-top: 0;">${escapeHtml(product.category || "General")}</span>
        </div>
        <h1 style="font-size: 1.45rem; line-height: 1.3;">${escapeHtml(product.title)}</h1>
        <p style="color: var(--text-muted); line-height: 1.65; white-space: pre-line;">${escapeHtml(product.description)}</p>

        <div style="margin-top: 10px; display: flex; gap: 12px; flex-wrap: wrap;">
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">Buy on WhatsApp</a>
          <a href="index.html" class="btn">All Products</a>
        </div>
      </div>
    </div>
  `;
}

function changeMainPhoto(url, thumbEl) {
  const mainImg = document.getElementById("mainProductImg");
  if (mainImg) mainImg.src = url;
  document.querySelectorAll("#thumbRow img").forEach((img) => img.classList.remove("active"));
  if (thumbEl) thumbEl.classList.add("active");
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
            <a href="${url}" class="btn btn-sm btn-primary">View Product</a>
          </div>
        </div>
      </article>
    `;
  }).join("");
}
