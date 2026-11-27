const StoreAPI = {
  async fetchAll(forceRefresh = false) {
    if (!forceRefresh) {
      const sessionCached = sessionStorage.getItem("store_cache");
      if (sessionCached) {
        try {
          return JSON.parse(sessionCached);
        } catch (e) {}
      }
    }

    try {
      const res = await fetch(APP_CONFIG.API_URL);
      const data = await res.json();
      if (data.status === "success") {
        const serialized = JSON.stringify(data);
        sessionStorage.setItem("store_cache", serialized);
        localStorage.setItem("store_offline_backup", serialized);
      }
      return data;
    } catch (networkErr) {
      const offlineBackup = localStorage.getItem("store_offline_backup");
      if (offlineBackup) {
        try {
          const parsed = JSON.parse(offlineBackup);
          parsed._offline = true;
          setTimeout(() => showToast("Offline mode: showing saved catalog"), 500);
          return parsed;
        } catch (e) {}
      }
      throw networkErr;
    }
  },

  async postAction(payload) {
    if (!navigator.onLine) {
      return { status: "error", message: "Internet connection required for admin updates." };
    }
    const res = await fetch(APP_CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status === "success") {
      sessionStorage.removeItem("store_cache");
    }
    return result;
  }
};

function setupNavigation(storeName) {
  const brandEls = document.querySelectorAll(".js-store-name");
  brandEls.forEach((el) => {
    el.textContent = storeName || "Sameer Store";
  });

  try {
    const custom = JSON.parse(localStorage.getItem("sameer_custom_ui") || "{}");
    const logoImg = document.getElementById("topLogoImg");
    if (logoImg && custom.logo_url) {
      logoImg.src = custom.logo_url;
      logoImg.classList.add("visible");
    }
  } catch (e) {}

  const menuBtn = document.getElementById("menuBtn");
  const drawer = document.getElementById("sideDrawer");
  const backdrop = document.getElementById("drawerBackdrop");

  if (menuBtn && drawer && backdrop) {
    menuBtn.addEventListener("click", () => {
      drawer.classList.add("open");
      backdrop.classList.add("open");
    });

    backdrop.addEventListener("click", () => {
      drawer.classList.remove("open");
      backdrop.classList.remove("open");
    });
  }
}

function showToast(msg, showUndo = false) {
  const toast = document.getElementById("toast");
  const textEl = document.getElementById("toastText");
  const undoBtn = document.getElementById("toastUndoBtn");
  if (!toast) return;

  if (textEl) {
    textEl.textContent = msg;
  } else {
    toast.textContent = msg;
  }

  if (undoBtn) {
    undoBtn.style.display = showUndo ? "inline-flex" : "none";
  }

  toast.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, showUndo ? 5000 : 2800);
}

function hideToast() {
  const toast = document.getElementById("toast");
  if (toast) toast.classList.remove("show");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
