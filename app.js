let allProducts = [];
let allCategories = [];
let currentSettings = {};
let activeCategory = "All";
let selectedImagesBase64 = [];
let tapCount = 0;
let tapTimer = null;
let verifiedPassword = sessionStorage.getItem("verified_admin_pass") || "";

document.addEventListener("DOMContentLoaded", async () => {
  setupSecretAdminTrigger();
  await initCatalog();

  if (verifiedPassword) {
    showAdminPanelUI();
  }
});

function setupSecretAdminTrigger() {
  const brand = document.getElementById("brandTitle");
  if (!brand) return;

  brand.addEventListener("click", () => {
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
        document.getElementById("adminPassInput").value = "";
        document.getElementById("authModal").classList.add("open");
        document.getElementById("adminPassInput").focus();
      }
    }
  });
}

function closeAuthModal() {
  document.getElementById("authModal").classList.remove("open");
}

// पासवर्ड पहले वेरिफाई होगा; गलत होने पर एडमिन पैनल खुलेगा ही नहीं
async function verifyAdminLogin() {
  const pass = document.getElementById("adminPassInput").value.trim();
  const btn = document.getElementById("unlockBtn");

  if (!pass) {
    showToast("पासवर्ड डालें");
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
      showToast(res.message || "गलत पासवर्ड!");
    }
  } catch (err) {
    showToast("सर्वर से कनेक्ट नहीं हो सका");
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

    document.title = currentSettings.store_name || "Product Catalog";
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
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No products in this category yet.</div>`;
    return;
  }

  const isAdmin = Boolean(verifiedPassword);

  grid.innerHTML = list.map((item) => {
    const firstImg = item.images && item.images[0] ? item.images[0] : "";
    const count = item.images ? item.images.length : 0;
    const productUrl = `product.html?id=${encodeURIComponent(item.id)}`;

    return `
      <article class="card">
        <div class="card-img-wrap" onclick="location.href='${productUrl}'">
          ${firstImg ? `<img src="${firstImg}" alt="${escapeHtml(item.title)}" loading="lazy" />` : ""}
          <span class="badge-top">${escapeHtml(item.category || "General")}</span>
          ${count > 1 ? `<span class="badge-bottom">${count} photos</span>` : ""}
        </div>
        <div class="card-body">
          <div class="card-title" onclick="location.href='${productUrl}'">${escapeHtml(item.title)}</div>
          <div class="card-desc">${escapeHtml(item.description)}</div>
          <div class="card-footer">
            <a href="${productUrl}" class="btn btn-sm btn-primary">View Details</a>
            ${isAdmin ? `
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-sm" onclick="startEditProduct('${escapeJs(item.id)}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${escapeJs(item.id)}')">Delete</button>
              </div>
            ` : `<span style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(item.date || "")}</span>`}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function populateAdminForms() {
  // Product Category dropdown
  const select = document.getElementById("prodCategory");
  const options = ["General", ...allCategories.filter((c) => c.toLowerCase() !== "general")];
  select.innerHTML = options.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  // Suggested products checklist
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

  // Category chips
  const chips = document.getElementById("categoryChips");
  chips.innerHTML = allCategories.map((cat) => `
    <span class="chip">
      ${escapeHtml(cat)}
      <button onclick="deleteCategory('${escapeJs(cat)}')" title="Remove">&times;</button>
    </span>
  `).join("");

  // Settings values
  document.getElementById("setStoreName").value = currentSettings.store_name || "";
  document.getElementById("setWhatsapp").value = currentSettings.whatsapp_number || "";
  document.getElementById("setEmail").value = currentSettings.contact_email || "";
  document.getElementById("setAbout").value = currentSettings.about_us || "";
  document.getElementById("setContact").value = currentSettings.contact_us || "";
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
  const description = document.getElementById("prodDesc").value.trim();
  const btn = document.getElementById("saveProdBtn");

  if (!title || !description) {
    showToast("Title और Description ज़रूरी है");
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
      description,
      images: selectedImagesBase64,
      suggestedIds
    };

    const res = await StoreAPI.postAction(payload);
    if (res.status === "success") {
      showToast(res.message || "Saved!");
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
  if (!id) return;
  showToast("Deleting...");

  try {
    const res = await StoreAPI.postAction({
      action: "delete_product",
      password: verifiedPassword,
      id
    });
    if (res.status === "success") {
      showToast("Product deleted");
      await initCatalog(true);
    } else {
      showToast(res.message || "Delete failed");
    }
  } catch (err) {
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
        store_name: document.getElementById("setStoreName").value.trim(),
        whatsapp_number: document.getElementById("setWhatsapp").value.trim(),
        contact_email: document.getElementById("setEmail").value.trim(),
        about_us: document.getElementById("setAbout").value.trim(),
        contact_us: document.getElementById("setContact").value.trim()
      }
    });

    if (res.status === "success") {
      showToast("Settings saved!");
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
    showToast("पुराना और नया पासवर्ड दोनों डालें");
    return;
  }

  if (oldPass !== verifiedPassword) {
    showToast("मौजूदा पासवर्ड गलत है");
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
      showToast("Password updated!");
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
