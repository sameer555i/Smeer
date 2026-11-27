let allProducts = [];
let allCategories = [];
let currentSettings = {};
let activeCategory = "All";
let selectedImagesBase64 = [];
let logoBase64 = "";
let bannerImagesBase64 = [];
let bannerTimer = null;
let bannerIndex = 0;
let tapCount = 0;
let tapTimer = null;
let verifiedPassword = sessionStorage.getItem("verified_admin_pass") || "";
let lastDeletedProduct = null;

const DEFAULT_CUSTOM = {
  banner_speed: 3,
  card_radius: 16,
  show_banner: true,
  show_stock: true,
  compact_cards: false,
  show_date: true,
  logo_url: "",
  banner_images: []
};

let storeCustom = loadLocalCustom();

function loadLocalCustom() {
  try {
    const saved = JSON.parse(localStorage.getItem("sameer_custom_ui") || "{}");
    return { ...DEFAULT_CUSTOM, ...saved };
  } catch (e) {
    return { ...DEFAULT_CUSTOM };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  applyCustomizationUI();
  setupSecretAdminTrigger();
  await initCatalog();

  if (verifiedPassword) {
    showAdminPanelUI();
  }
});

function togglePassVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btnEl.textContent = "Hide";
  } else {
    input.type = "password";
    btnEl.textContent = "Show";
  }
}

function applyCustomizationUI() {
  document.documentElement.style.setProperty("--card-radius", `${Number(storeCustom.card_radius) || 16}px`);
  document.body.classList.toggle("compact-cards", Boolean(storeCustom.compact_cards));
  document.body.classList.toggle("hide-dates", !storeCustom.show_date);

  const logoImg = document.getElementById("topLogoImg");
  if (logoImg) {
    if (storeCustom.logo_url) {
      logoImg.src = storeCustom.logo_url;
      logoImg.classList.add("visible");
    } else {
      logoImg.removeAttribute("src");
      logoImg.classList.remove("visible");
    }
  }

  setupHeroBanner();
}

function setupHeroBanner() {
  clearInterval(bannerTimer);
  const wrap = document.getElementById("heroBannerWrap");
  const imgEl = document.getElementById("heroBannerImg");
  const dotsEl = document.getElementById("heroDots");
  const imgs = Array.isArray(storeCustom.banner_images) ? storeCustom.banner_images.filter(Boolean) : [];

  if (!wrap || !imgEl) return;
  if (!storeCustom.show_banner || !imgs.length) {
    wrap.classList.remove("active");
    return;
  }

  wrap.classList.add("active");
  bannerIndex = 0;

  function showSlide(idx) {
    bannerIndex = idx % imgs.length;
    imgEl.src = imgs[bannerIndex];
    if (dotsEl) {
      dotsEl.innerHTML = imgs.map((_, i) =>
        `<span class="hero-dot ${i === bannerIndex ? "active" : ""}" onclick="jumpBannerSlide(${i})"></span>`
      ).join("");
    }
  }

  window.jumpBannerSlide = (i) => {
    showSlide(i);
    restartTimer();
  };

  function restartTimer() {
    clearInterval(bannerTimer);
    const sec = Math.max(2, Number(storeCustom.banner_speed) || 3) * 1000;
    if (imgs.length > 1) {
      bannerTimer = setInterval(() => showSlide(bannerIndex + 1), sec);
    }
  }

  showSlide(0);
  restartTimer();
}

function setupSecretAdminTrigger() {
  const trigger = document.getElementById("brandTrigger");
  if (!trigger) return;

  trigger.addEventListener("click", () => {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      tapCount = 0;
    }, 1500);

    if (tapCount >= 5) {
      tapCount = 0;
      if (verifiedPassword) {
        showAdminPanelUI();
      } else {
        const passInput = document.getElementById("adminPassInput");
        passInput.value = "";
        passInput.type = "password";
        document.getElementById("authModal").classList.add("open");
        passInput.focus();
      }
    }
  });
}

function closeAuthModal() {
  document.getElementById("authModal").classList.remove("open");
}

async function verifyAdminLogin() {
  const pass = document.getElementById("adminPassInput").value.trim();
  const btn = document.getElementById("unlockBtn");

  if (!pass) {
    showToast("Enter password");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Checking...";

  try {
    const res = await StoreAPI.postAction({
      action: "verify_password",
      password: pass
    });

    if (res.status === "success") {
      verifiedPassword = pass;
      sessionStorage.setItem("verified_admin_pass", pass);
      closeAuthModal();
      showAdminPanelUI();
      showToast("Admin panel unlocked");
    } else {
      showToast(res.message || "Invalid password");
    }
  } catch (err) {
    showToast("Server connection failed");
  } finally {
    btn.disabled = false;
    btn.textContent = "Unlock";
  }
}

function showAdminPanelUI() {
  document.getElementById("adminPanel").style.display = "block";
  document.getElementById("exitAdminBtn").style.display = "inline-flex";
  populateAdminForms();
  renderProducts();
}

function logoutAdmin() {
  verifiedPassword = "";
  sessionStorage.removeItem("verified_admin_pass");
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("exitAdminBtn").style.display = "none";
  renderProducts();
  showToast("Admin mode closed");
}

function switchAdminTab(tabId, btnEl) {
  document.querySelectorAll(".admin-section").forEach((sec) => sec.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  if (btnEl) btnEl.classList.add("active");
}

async function initCatalog(forceRefresh = false) {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">Loading catalog...</div>`;

  try {
    const data = await StoreAPI.fetchAll(forceRefresh);
    if (data.status !== "success") {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">${escapeHtml(data.message || "Error loading data")}</div>`;
      return;
    }

    allProducts = data.products || [];
    allCategories = data.categories || [];
    currentSettings = data.settings || {};

    if (currentSettings.custom_ui_json) {
      try {
        const remoteCustom = JSON.parse(currentSettings.custom_ui_json);
        storeCustom = { ...DEFAULT_CUSTOM, ...storeCustom, ...remoteCustom };
        localStorage.setItem("sameer_custom_ui", JSON.stringify(storeCustom));
        applyCustomizationUI();
      } catch (e) {}
    }

    document.title = currentSettings.store_name || "Sameer Store";
    setupNavigation(currentSettings.store_name);

    renderCategoryBar();
    renderProducts();
    if (verifiedPassword) {
      populateAdminForms();
    }
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">Failed to load products.</div>`;
  }
}

function renderCategoryBar() {
  const bar = document.getElementById("categoryBar");
  const cats = ["All", ...allCategories];

  bar.innerHTML = cats.map((cat) => {
    const activeClass = cat === activeCategory ? "active" : "";
    return `<button class="cat-pill ${activeClass}" onclick="selectCategory('${escapeJs(cat)}')">${escapeHtml(cat)}</button>`;
  }).join("");
}

function selectCategory(cat) {
  activeCategory = cat;
  renderCategoryBar();
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  const list = activeCategory === "All"
    ? allProducts
    : allProducts.filter((p) => p.category === activeCategory);

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No products in this category.</div>`;
    return;
  }

  const isAdmin = Boolean(verifiedPassword);

  grid.innerHTML = list.map((item) => {
    const firstImg = item.images && item.images[0] ? item.images[0] : "";
    const count = item.images ? item.images.length : 0;
    const productUrl = `product.html?id=${encodeURIComponent(item.id)}`;
    const isOut = item.stockStatus === "out_of_stock" || Number(item.stockQty) <= 0;
    const qtyText = isOut ? "Out of Stock" : `In Stock (${Number(item.stockQty ?? 10)})`;

    return `
      <article class="card" data-prod-id="${escapeHtml(item.id)}" data-admin="${isAdmin ? "1" : "0"}">
        <div class="card-img-wrap" onclick="location.href='${productUrl}'">
          ${firstImg ? `<img src="${firstImg}" alt="${escapeHtml(item.title)}" loading="lazy" />` : ""}
          <span class="badge-top">${escapeHtml(item.category || "General")}</span>
          ${count > 1 ? `<span class="badge-bottom">${count} photos</span>` : ""}
        </div>
        <div class="card-body">
          ${storeCustom.show_stock ? `<div class="stock-tag ${isOut ? "stock-out" : "stock-in"}">${escapeHtml(qtyText)}</div>` : ""}
          <div class="card-title" onclick="location.href='${productUrl}'">${escapeHtml(item.title)}</div>
          <div class="card-desc">${escapeHtml(item.description)}</div>
          <div class="card-footer">
            <a href="${productUrl}" class="btn btn-sm btn-white">View Details</a>
            <span class="card-date">${escapeHtml(item.date || "")}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (isAdmin) {
    attachLongPressHandlers();
  }
}

function attachLongPressHandlers() {
  document.querySelectorAll('.card[data-admin="1"]').forEach((card) => {
    let pressTimer = null;
    const prodId = card.getAttribute("data-prod-id");

    const startPress = () => {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        openLongPressModal(prodId);
      }, 550);
    };

    const cancelPress = () => clearTimeout(pressTimer);

    card.addEventListener("touchstart", startPress, { passive: true });
    card.addEventListener("touchend", cancelPress);
    card.addEventListener("touchmove", cancelPress);
    card.addEventListener("mousedown", startPress);
    card.addEventListener("mouseup", cancelPress);
    card.addEventListener("mouseleave", cancelPress);
  });
}

function openLongPressModal(prodId) {
  const prod = allProducts.find((p) => String(p.id) === String(prodId));
  if (!prod) return;

  document.getElementById("lpProductTitle").textContent = prod.title;
  document.getElementById("lpEditBtn").onclick = () => {
    closeLongPressModal();
    startEditProduct(prod.id);
  };
  document.getElementById("lpDeleteBtn").onclick = () => {
    closeLongPressModal();
    deleteProduct(prod.id);
  };
  document.getElementById("longPressModal").classList.add("open");
}

function closeLongPressModal() {
  document.getElementById("longPressModal").classList.remove("open");
}

function populateAdminForms() {
  const select = document.getElementById("prodCategory");
  const options = ["General", ...allCategories.filter((c) => c.toLowerCase() !== "general")];
  select.innerHTML = options.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  const editingId = document.getElementById("editProdId").value;
  const suggBox = document.getElementById("suggestedList");
  const candidates = allProducts.filter((p) => p.id !== editingId);

  if (!candidates.length) {
    suggBox.innerHTML = `<div style="font-size: 0.84rem; color: var(--text-muted);">Add more products to select suggestions.</div>`;
  } else {
    suggBox.innerHTML = candidates.map((p) => `
      <label class="check-item">
        <input type="checkbox" class="sugg-checkbox" value="${escapeHtml(p.id)}" />
        <span>${escapeHtml(p.title)} (${escapeHtml(p.category || "General")})</span>
      </label>
    `).join("");
  }

  const chips = document.getElementById("categoryChips");
  chips.innerHTML = allCategories.map((cat) => `
    <span class="chip">
      ${escapeHtml(cat)}
      <button onclick="deleteCategory('${escapeJs(cat)}')" title="Remove">&times;</button>
    </span>
  `).join("");

  document.getElementById("custBannerSpeed").value = storeCustom.banner_speed || 3;
  document.getElementById("custCardRadius").value = storeCustom.card_radius || 16;
  document.getElementById("custShowBanner").value = String(Boolean(storeCustom.show_banner));
  document.getElementById("custShowStock").value = String(Boolean(storeCustom.show_stock));
  document.getElementById("custCompactCards").value = String(Boolean(storeCustom.compact_cards));
  document.getElementById("custShowDate").value = String(Boolean(storeCustom.show_date));

  const logoBox = document.getElementById("logoPreviewBox");
  logoBox.innerHTML = storeCustom.logo_url ? `<img src="${storeCustom.logo_url}" alt="Logo" />` : "";

  const bannerBox = document.getElementById("bannerPreviewBox");
  bannerBox.innerHTML = (storeCustom.banner_images || []).map((u) => `<img src="${u}" alt="Banner" />`).join("");

  document.getElementById("setStoreName").value = currentSettings.store_name || "";
  document.getElementById("setWhatsapp").value = currentSettings.whatsapp_number || "";
  document.getElementById("setEmail").value = currentSettings.contact_email || "";
  document.getElementById("setAbout").value = currentSettings.about_us || "";
  document.getElementById("setContact").value = currentSettings.contact_us || "";
}

function handleLogoUpload(event) {
  const file = (event.target.files || [])[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    logoBase64 = e.target.result;
    document.getElementById("logoPreviewBox").innerHTML = `<img src="${logoBase64}" alt="Logo Preview" />`;
  };
  reader.readAsDataURL(file);
}

function handleBannerUpload(event) {
  const files = Array.from(event.target.files || []).slice(0, 5);
  const box = document.getElementById("bannerPreviewBox");
  box.innerHTML = "";
  bannerImagesBase64 = [];

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      bannerImagesBase64.push(e.target.result);
      const img = document.createElement("img");
      img.src = e.target.result;
      box.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

async function saveCustomization() {
  const btn = document.getElementById("saveCustomizeBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  storeCustom = {
    ...storeCustom,
    banner_speed: Math.max(2, Number(document.getElementById("custBannerSpeed").value) || 3),
    card_radius: Math.max(4, Math.min(28, Number(document.getElementById("custCardRadius").value) || 16)),
    show_banner: document.getElementById("custShowBanner").value === "true",
    show_stock: document.getElementById("custShowStock").value === "true",
    compact_cards: document.getElementById("custCompactCards").value === "true",
    show_date: document.getElementById("custShowDate").value === "true",
    logo_url: logoBase64 || storeCustom.logo_url || "",
    banner_images: bannerImagesBase64.length ? bannerImagesBase64 : (storeCustom.banner_images || [])
  };

  localStorage.setItem("sameer_custom_ui", JSON.stringify(storeCustom));
  applyCustomizationUI();
  renderProducts();

  try {
    await StoreAPI.postAction({
      action: "save_settings",
      password: verifiedPassword,
      settings: {
        ...currentSettings,
        custom_ui_json: JSON.stringify(storeCustom)
      }
    });
    showToast("Customization saved");
  } catch (e) {
    showToast("Saved locally");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Customization";
  }
}

function resetCustomization() {
  storeCustom = { ...DEFAULT_CUSTOM };
  logoBase64 = "";
  bannerImagesBase64 = [];
  localStorage.removeItem("sameer_custom_ui");
  applyCustomizationUI();
  populateAdminForms();
  renderProducts();
  showToast("Defaults restored");
}

function handleImagePreview(event) {
  const files = Array.from(event.target.files || []).slice(0, 4);
  const strip = document.getElementById("previewStrip");
  strip.innerHTML = "";
  selectedImagesBase64 = [];

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedImagesBase64.push(e.target.result);
      const img = document.createElement("img");
      img.src = e.target.result;
      strip.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

function startEditProduct(id) {
  const prod = allProducts.find((p) => p.id === id);
  if (!prod) return;

  switchAdminTab("tabProducts", document.querySelector('.tab-btn[data-tab="tabProducts"]'));
  document.getElementById("editProdId").value = prod.id;
  document.getElementById("prodFormHeading").textContent = "Edit Product";
  document.getElementById("prodTitle").value = prod.title;
  document.getElementById("prodCategory").value = prod.category || "General";
  document.getElementById("prodStockStatus").value = prod.stockStatus || "in_stock";
  document.getElementById("prodStockQty").value = Number(prod.stockQty ?? 10);
  document.getElementById("prodDesc").value = prod.description;
  document.getElementById("cancelEditBtn").style.display = "inline-flex";
  selectedImagesBase64 = [];

  populateAdminForms();

  const suggSet = new Set(prod.suggestedIds || []);
  document.querySelectorAll(".sugg-checkbox").forEach((cb) => {
    cb.checked = suggSet.has(cb.value);
  });

  document.getElementById("adminPanel").scrollIntoView({ behavior: "smooth" });
}

function resetProductForm() {
  document.getElementById("editProdId").value = "";
  document.getElementById("prodFormHeading").textContent = "Add New Product";
  document.getElementById("prodTitle").value = "";
  document.getElementById("prodStockStatus").value = "in_stock";
  document.getElementById("prodStockQty").value = "10";
  document.getElementById("prodDesc").value = "";
  document.getElementById("prodImages").value = "";
  document.getElementById("previewStrip").innerHTML = "";
  document.getElementById("cancelEditBtn").style.display = "none";
  selectedImagesBase64 = [];
  populateAdminForms();
}

async function saveProduct() {
  const editId = document.getElementById("editProdId").value.trim();
  const title = document.getElementById("prodTitle").value.trim();
  const category = document.getElementById("prodCategory").value;
  const stockStatus = document.getElementById("prodStockStatus").value;
  const stockQty = Math.max(0, Number(document.getElementById("prodStockQty").value) || 0);
  const description = document.getElementById("prodDesc").value.trim();
  const btn = document.getElementById("saveProdBtn");

  if (!title || !description) {
    showToast("Title and description required");
    return;
  }

  const suggestedIds = Array.from(document.querySelectorAll(".sugg-checkbox:checked")).map((cb) => cb.value);

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const payload = {
      action: editId ? "update_product" : "add_product",
      password: verifiedPassword,
      id: editId,
      title,
      category,
      stockStatus,
      stockQty,
      description,
      images: selectedImagesBase64,
      suggestedIds
    };

    const res = await StoreAPI.postAction(payload);
    if (res.status === "success") {
      showToast(res.message || "Saved");
      resetProductForm();
      await initCatalog(true);
    } else {
      showToast(res.message || "Save failed");
    }
  } catch (err) {
    showToast("Network error while saving");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Product";
  }
}

async function deleteProduct(id) {
  const target = allProducts.find((p) => String(p.id) === String(id));
  if (!target) return;

  lastDeletedProduct = { ...target };
  allProducts = allProducts.filter((p) => String(p.id) !== String(id));
  renderProducts();
  showToast("Product deleted", true);

  try {
    const res = await StoreAPI.postAction({
      action: "delete_product",
      password: verifiedPassword,
      id
    });
    if (res.status !== "success") {
      showToast(res.message || "Delete failed");
      await initCatalog(true);
    }
  } catch (err) {
    showToast("Network error");
  }
}

async function undoLastDelete() {
  if (!lastDeletedProduct) return;
  const restored = { ...lastDeletedProduct };
  lastDeletedProduct = null;
  hideToast();
  showToast("Restoring product...");

  try {
    const res = await StoreAPI.postAction({
      action: "add_product",
      password: verifiedPassword,
      title: restored.title,
      category: restored.category || "General",
      stockStatus: restored.stockStatus || "in_stock",
      stockQty: Number(restored.stockQty ?? 10),
      description: restored.description,
      images: restored.images || [],
      suggestedIds: restored.suggestedIds || []
    });
    if (res.status === "success") {
      showToast("Product restored");
      await initCatalog(true);
    } else {
      showToast("Restore failed");
    }
  } catch (e) {
    showToast("Network error");
  }
}

async function addCategory() {
  const input = document.getElementById("newCategoryInput");
  const name = input.value.trim();
  if (!name) return;

  const res = await StoreAPI.postAction({
    action: "add_category",
    password: verifiedPassword,
    name
  });

  if (res.status === "success") {
    input.value = "";
    showToast("Category added");
    await initCatalog(true);
  } else {
    showToast(res.message || "Failed to add category");
  }
}

async function deleteCategory(name) {
  const res = await StoreAPI.postAction({
    action: "delete_category",
    password: verifiedPassword,
    name
  });

  if (res.status === "success") {
    showToast("Category removed");
    await initCatalog(true);
  } else {
    showToast(res.message || "Failed to remove");
  }
}

async function saveSiteSettings() {
  const btn = document.getElementById("saveSettingsBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const res = await StoreAPI.postAction({
      action: "save_settings",
      password: verifiedPassword,
      settings: {
        ...currentSettings,
        store_name: document.getElementById("setStoreName").value.trim(),
        whatsapp_number: document.getElementById("setWhatsapp").value.trim(),
        contact_email: document.getElementById("setEmail").value.trim(),
        about_us: document.getElementById("setAbout").value.trim(),
        contact_us: document.getElementById("setContact").value.trim()
      }
    });

    if (res.status === "success") {
      showToast("Settings saved");
      await initCatalog(true);
    } else {
      showToast(res.message || "Failed to save settings");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Settings";
  }
}

async function changeAdminPassword() {
  const oldPass = document.getElementById("oldPassInput").value.trim();
  const newPass = document.getElementById("newPassInput").value.trim();
  const btn = document.getElementById("changePassBtn");

  if (!oldPass || !newPass) {
    showToast("Enter current and new password");
    return;
  }

  if (oldPass !== verifiedPassword) {
    showToast("Current password incorrect");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    const res = await StoreAPI.postAction({
      action: "change_password",
      password: verifiedPassword,
      newPassword: newPass
    });

    if (res.status === "success") {
      verifiedPassword = newPass;
      sessionStorage.setItem("verified_admin_pass", newPass);
      document.getElementById("oldPassInput").value = "";
      document.getElementById("newPassInput").value = "";
      showToast("Password updated");
    } else {
      showToast(res.message || "Failed to update password");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Update Password";
  }
}

function escapeJs(str) {
  return String(str || "").replace(/'/g, "\\'");
}
