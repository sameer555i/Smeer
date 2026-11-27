let allProducts = [];
let allCategories = [];
let currentSettings = {};
let activeCategory = "All";
let selectedImagesBase64 = [];
let selectedImageHashes = [];
let logoBase64 = "";
let bannerImagesBase64 = [];
let bannerTimer = null;
let bannerIndex = 0;
let tapCount = 0;
let tapTimer = null;
let verifiedPassword = sessionStorage.getItem("verified_admin_pass") || "";
let lastDeletedProduct = null;
let isLongPressTriggered = false;

const GLOBAL_CONFIG_TAG = "[[GLOBAL_UI_CONFIG:";
const GLOBAL_CONFIG_END = "]]";

const DEFAULT_CUSTOM = {
  theme_mode: "dark",
  banner_speed: 3,
  banner_anim: "smooth-slide",
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

function extractGlobalConfigFromSettings(settings) {
  if (!settings) return null;
  if (settings.custom_ui_json) {
    try {
      return JSON.parse(settings.custom_ui_json);
    } catch (e) {}
  }
  const sources = [settings.about_us, settings.contact_us];
  for (const src of sources) {
    const str = String(src || "");
    const startIdx = str.indexOf(GLOBAL_CONFIG_TAG);
    if (startIdx !== -1) {
      const jsonStart = startIdx + GLOBAL_CONFIG_TAG.length;
      const endIdx = str.indexOf(GLOBAL_CONFIG_END, jsonStart);
      if (endIdx !== -1) {
        try {
          return JSON.parse(str.slice(jsonStart, endIdx));
        } catch (e) {}
      }
    }
  }
  return null;
}

function stripGlobalConfigTag(text) {
  const str = String(text || "");
  const startIdx = str.indexOf(GLOBAL_CONFIG_TAG);
  if (startIdx === -1) return str;
  const endIdx = str.indexOf(GLOBAL_CONFIG_END, startIdx + GLOBAL_CONFIG_TAG.length);
  if (endIdx === -1) return str;
  return (str.slice(0, startIdx) + str.slice(endIdx + GLOBAL_CONFIG_END.length)).trim();
}

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

function buildPricingHeader(mrp, price) {
  const m = String(mrp || "").trim();
  const p = String(price || "").trim();
  const parts = [];
  if (m) parts.push(`MRP: ${m}`);
  if (p) parts.push(`Price: ${p}`);
  return parts.length ? `[${parts.join(" | ")}]` : "";
}

function formatRupeeValue(val) {
  const clean = String(val || "").trim();
  if (!clean) return "";
  return clean.startsWith("₹") ? clean : `₹${clean}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  applyCustomizationUI();
  setupSecretAdminTrigger();
  await initCatalog();

  if (verifiedPassword) {
    showAdminPanelUI();
  }
});

function toggleThemeMode() {
  const isLight = document.body.classList.contains("light-theme");
  storeCustom.theme_mode = isLight ? "dark" : "light";
  localStorage.setItem("sameer_custom_ui", JSON.stringify(storeCustom));
  applyCustomizationUI();
}

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
  const isLight = storeCustom.theme_mode === "light";
  document.body.classList.toggle("light-theme", isLight);

  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.textContent = isLight ? "Dark" : "Light";
  }

  const anim = storeCustom.banner_anim || "smooth-slide";
  if (anim === "soft-glide") {
    document.documentElement.style.setProperty("--banner-ease", "cubic-bezier(0.16, 1, 0.3, 1)");
    document.documentElement.style.setProperty("--banner-duration", "0.65s");
  } else if (anim === "gentle-fade") {
    document.documentElement.style.setProperty("--banner-ease", "ease-in-out");
    document.documentElement.style.setProperty("--banner-duration", "0.5s");
  } else {
    document.documentElement.style.setProperty("--banner-ease", "cubic-bezier(0.22, 1, 0.36, 1)");
    document.documentElement.style.setProperty("--banner-duration", "0.45s");
  }

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
  const track = document.getElementById("heroBannerTrack");
  const dotsEl = document.getElementById("heroDots");
  const imgs = Array.isArray(storeCustom.banner_images) ? storeCustom.banner_images.filter(Boolean) : [];

  if (!wrap || !track) return;
  if (!storeCustom.show_banner || !imgs.length) {
    wrap.classList.remove("active");
    track.innerHTML = "";
    return;
  }

  wrap.classList.add("active");
  bannerIndex = 0;
  const isFade = storeCustom.banner_anim === "gentle-fade";

  track.innerHTML = imgs.map((src, i) => `
    <div class="hero-banner-slide" style="${isFade ? "opacity:0;" : ""}">
      <img src="${src}" alt="Banner ${i + 1}" />
    </div>
  `).join("");

  const slides = Array.from(track.querySelectorAll(".hero-banner-slide"));

  function updateVisualState(idx) {
    bannerIndex = ((idx % imgs.length) + imgs.length) % imgs.length;
    if (dotsEl) {
      dotsEl.innerHTML = imgs.map((_, i) =>
        `<span class="hero-dot ${i === bannerIndex ? "active" : ""}" onclick="goToBannerSlide(${i})"></span>`
      ).join("");
    }
    if (isFade) {
      slides.forEach((s, i) => {
        s.style.opacity = i === bannerIndex ? "1" : "0.25";
      });
    }
  }

  window.goToBannerSlide = (i) => {
    const targetIdx = ((i % imgs.length) + imgs.length) % imgs.length;
    track.scrollTo({
      left: targetIdx * track.clientWidth,
      behavior: "smooth"
    });
    updateVisualState(targetIdx);
    restartTimer();
  };

  function restartTimer() {
    clearInterval(bannerTimer);
    const sec = Math.max(2, Number(storeCustom.banner_speed) || 3) * 1000;
    if (imgs.length > 1) {
      bannerTimer = setInterval(() => {
        window.goToBannerSlide(bannerIndex + 1);
      }, sec);
    }
  }

  let scrollDebounce = null;
  track.addEventListener("scroll", () => {
    clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(() => {
      if (!track.clientWidth) return;
      const idx = Math.round(track.scrollLeft / track.clientWidth);
      updateVisualState(idx);
      restartTimer();
    }, 80);
  }, { passive: true });

  updateVisualState(0);
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

    const remoteCustom = extractGlobalConfigFromSettings(currentSettings);
    if (remoteCustom) {
      const localSaved = loadLocalCustom();
      storeCustom = {
        ...DEFAULT_CUSTOM,
        ...remoteCustom,
        theme_mode: localSaved.theme_mode || remoteCustom.theme_mode || "dark",
        banner_images: (Array.isArray(remoteCustom.banner_images) && remoteCustom.banner_images.length)
          ? remoteCustom.banner_images
          : (localSaved.banner_images || []),
        logo_url: remoteCustom.logo_url || localSaved.logo_url || ""
      };
      localStorage.setItem("sameer_custom_ui", JSON.stringify(storeCustom));
      applyCustomizationUI();
    }

    document.title = currentSettings.store_name || "K-TECH";
    setupNavigation(currentSettings.store_name);

    renderCategoryBar();
    renderDrawerCategories();
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

function renderDrawerCategories() {
  const listEl = document.getElementById("drawerCategoryList");
  if (!listEl) return;
  const cats = ["All", ...allCategories];

  listEl.innerHTML = cats.map((cat) => {
    const activeClass = cat === activeCategory ? "active" : "";
    return `<button class="drawer-cat-btn ${activeClass}" onclick="selectCategoryFromDrawer('${escapeJs(cat)}')">${escapeHtml(cat)}</button>`;
  }).join("");
}

function selectCategoryFromDrawer(cat) {
  selectCategory(cat);
  const drawer = document.getElementById("sideDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  if (drawer) drawer.classList.remove("open");
  if (backdrop) backdrop.classList.remove("open");
}

function selectCategory(cat) {
  activeCategory = cat;
  renderCategoryBar();
  renderDrawerCategories();
  renderProducts();
}

function openProductCard(url) {
  if (isLongPressTriggered) {
    isLongPressTriggered = false;
    return;
  }
  location.href = url;
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
    const { mrp, price, cleanDesc } = parsePricingFromDesc(item.description);

    const priceHighlightHtml = (mrp || price)
      ? `<div class="price-highlight-box">
          ${price ? `<span class="rate-pill">${escapeHtml(formatRupeeValue(price))}</span>` : ""}
          ${mrp ? `<span class="mrp-strike">MRP ${escapeHtml(formatRupeeValue(mrp))}</span>` : ""}
         </div>`
      : "";

    return `
      <article class="card" data-prod-id="${escapeHtml(item.id)}" data-admin="${isAdmin ? "1" : "0"}" onclick="openProductCard('${productUrl}')">
        <div class="card-img-wrap">
          ${firstImg ? `<img src="${firstImg}" alt="${escapeHtml(item.title)}" loading="lazy" />` : ""}
          <span class="badge-top">${escapeHtml(item.category || "General")}</span>
          ${count > 1 ? `<span class="badge-bottom">${count} photos</span>` : ""}
        </div>
        <div class="card-body">
          ${storeCustom.show_stock ? `<div class="stock-tag ${isOut ? "stock-out" : "stock-in"}">${escapeHtml(qtyText)}</div>` : ""}
          ${priceHighlightHtml}
          <div class="card-title">${escapeHtml(item.title)}</div>
          <div class="card-desc">${escapeHtml(cleanDesc)}</div>
          <div class="card-footer">
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
      isLongPressTriggered = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        isLongPressTriggered = true;
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
  document.getElementById("custBannerAnim").value = storeCustom.banner_anim || "smooth-slide";
  document.getElementById("custCardRadius").value = storeCustom.card_radius || 16;
  document.getElementById("custThemeMode").value = storeCustom.theme_mode || "dark";
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
  document.getElementById("setAbout").value = stripGlobalConfigTag(currentSettings.about_us || "");
  document.getElementById("setContact").value = stripGlobalConfigTag(currentSettings.contact_us || "");
}

function compressImageFile(file, maxWidth = 720, quality = 0.6) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / (img.width || maxWidth));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((img.width || maxWidth) * scale));
        canvas.height = Math.max(1, Math.round((img.height || maxWidth) * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function getSimpleFingerprint(dataUrl) {
  const s = String(dataUrl || "");
  return `${s.length}_${s.slice(0, 120)}_${s.slice(-120)}`;
}

async function handleLogoUpload(event) {
  const file = (event.target.files || [])[0];
  if (!file) return;
  logoBase64 = await compressImageFile(file, 260, 0.72);
  document.getElementById("logoPreviewBox").innerHTML = `<img src="${logoBase64}" alt="Logo Preview" />`;
}

async function handleBannerUpload(event) {
  const files = Array.from(event.target.files || []).slice(0, 5);
  const box = document.getElementById("bannerPreviewBox");
  box.innerHTML = "";
  bannerImagesBase64 = [];

  for (const file of files) {
    const compressed = await compressImageFile(file, 640, 0.55);
    bannerImagesBase64.push(compressed);
    const img = document.createElement("img");
    img.src = compressed;
    box.appendChild(img);
  }
}

async function saveCustomization() {
  const btn = document.getElementById("saveCustomizeBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const selectedTheme = document.getElementById("custThemeMode").value;
  storeCustom = {
    ...storeCustom,
    theme_mode: selectedTheme,
    banner_speed: Math.max(2, Number(document.getElementById("custBannerSpeed").value) || 3),
    banner_anim: document.getElementById("custBannerAnim").value || "smooth-slide",
    card_radius: Math.max(4, Math.min(28, Number(document.getElementById("custCardRadius").value) || 16)),
    show_banner: document.getElementById("custShowBanner").value === "true",
    show_stock: document.getElementById("custShowStock").value === "true",
    compact_cards: document.getElementById("custCompactCards").value === "true",
    show_date: document.getElementById("custShowDate").value === "true",
    logo_url: logoBase64 || storeCustom.logo_url || "",
    banner_images: bannerImagesBase64.length ? bannerImagesBase64 : (storeCustom.banner_images || [])
  };

  const serializedCustom = JSON.stringify(storeCustom);
  localStorage.setItem("sameer_custom_ui", serializedCustom);
  applyCustomizationUI();
  renderProducts();

  const cleanAbout = stripGlobalConfigTag(currentSettings.about_us || "");
  const embeddedAbout = `${cleanAbout}\n${GLOBAL_CONFIG_TAG}${serializedCustom}${GLOBAL_CONFIG_END}`.trim();

  try {
    const res = await StoreAPI.postAction({
      action: "save_settings",
      password: verifiedPassword,
      settings: {
        ...currentSettings,
        about_us: embeddedAbout,
        custom_ui_json: serializedCustom
      }
    });
    if (res && res.status === "success") {
      currentSettings.about_us = embeddedAbout;
      currentSettings.custom_ui_json = serializedCustom;
      showToast("Saved & synced to all phones");
    } else {
      showToast(res.message || "Saved locally");
    }
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

async function handleImagePreview(event) {
  const files = Array.from(event.target.files || []).slice(0, 4);
  const strip = document.getElementById("previewStrip");
  strip.innerHTML = "";
  selectedImagesBase64 = [];
  selectedImageHashes = [];

  for (const file of files) {
    const compressed = await compressImageFile(file, 900, 0.72);
    const fp = getSimpleFingerprint(compressed);
    if (selectedImageHashes.includes(fp)) {
      showToast("Duplicate photo skipped");
      continue;
    }
    selectedImageHashes.push(fp);
    selectedImagesBase64.push(compressed);
    const img = document.createElement("img");
    img.src = compressed;
    strip.appendChild(img);
  }
}

function startEditProduct(id) {
  const prod = allProducts.find((p) => p.id === id);
  if (!prod) return;

  switchAdminTab("tabProducts", document.querySelector('.tab-btn[data-tab="tabProducts"]'));
  document.getElementById("editProdId").value = prod.id;
  document.getElementById("prodFormHeading").textContent = "Edit Product";
  document.getElementById("prodTitle").value = prod.title;
  document.getElementById("prodCategory").value = prod.category || "General";

  const { mrp, price, cleanDesc } = parsePricingFromDesc(prod.description);
  document.getElementById("prodMrp").value = mrp;
  document.getElementById("prodPrice").value = price;

  document.getElementById("prodStockStatus").value = prod.stockStatus || "in_stock";
  document.getElementById("prodStockQty").value = Number(prod.stockQty ?? 10);
  document.getElementById("prodDesc").value = cleanDesc;
  document.getElementById("cancelEditBtn").style.display = "inline-flex";
  selectedImagesBase64 = [];
  selectedImageHashes = [];

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
  document.getElementById("prodMrp").value = "";
  document.getElementById("prodPrice").value = "";
  document.getElementById("prodStockStatus").value = "in_stock";
  document.getElementById("prodStockQty").value = "10";
  document.getElementById("prodDesc").value = "";
  document.getElementById("prodImages").value = "";
  document.getElementById("previewStrip").innerHTML = "";
  document.getElementById("cancelEditBtn").style.display = "none";
  selectedImagesBase64 = [];
  selectedImageHashes = [];
  populateAdminForms();
}

async function saveProduct() {
  const editId = document.getElementById("editProdId").value.trim();
  const title = document.getElementById("prodTitle").value.trim();
  const category = document.getElementById("prodCategory").value;
  const rawMrp = document.getElementById("prodMrp").value.trim();
  const rawPrice = document.getElementById("prodPrice").value.trim();
  const stockStatus = document.getElementById("prodStockStatus").value;
  const stockQty = Math.max(0, Number(document.getElementById("prodStockQty").value) || 0);
  const rawDesc = document.getElementById("prodDesc").value.trim();
  const btn = document.getElementById("saveProdBtn");

  if (!title || !rawDesc) {
    showToast("Title and description required");
    return;
  }

  const normalizedTitle = title.toLowerCase().replace(/\s+/g, " ");
  const duplicateExists = allProducts.some((p) => {
    if (editId && String(p.id) === String(editId)) return false;
    return String(p.title || "").trim().toLowerCase().replace(/\s+/g, " ") === normalizedTitle;
  });

  if (duplicateExists) {
    showToast("Duplicate product already exists");
    return;
  }

  const { cleanDesc } = parsePricingFromDesc(rawDesc);
  const header = buildPricingHeader(rawMrp, rawPrice);
  const finalDescription = header ? `${header}\n${cleanDesc}` : cleanDesc;
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
      description: finalDescription,
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

  const exists = allCategories.some((c) => c.toLowerCase() === name.toLowerCase());
  if (exists) {
    showToast("Category already exists");
    return;
  }

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

  const cleanAbout = document.getElementById("setAbout").value.trim();
  const serializedCustom = JSON.stringify(storeCustom);
  const embeddedAbout = `${cleanAbout}\n${GLOBAL_CONFIG_TAG}${serializedCustom}${GLOBAL_CONFIG_END}`.trim();

  try {
    const res = await StoreAPI.postAction({
      action: "save_settings",
      password: verifiedPassword,
      settings: {
        ...currentSettings,
        store_name: document.getElementById("setStoreName").value.trim(),
        whatsapp_number: document.getElementById("setWhatsapp").value.trim(),
        contact_email: document.getElementById("setEmail").value.trim(),
        about_us: embeddedAbout,
        contact_us: document.getElementById("setContact").value.trim(),
        custom_ui_json: serializedCustom
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
