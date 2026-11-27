const StoreAPI = {
  async fetchAll(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = sessionStorage.getItem("store_cache");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
    }

    const res = await fetch(APP_CONFIG.API_URL);
    const data = await res.json();
    if (data.status === "success") {
      sessionStorage.setItem("store_cache", JSON.stringify(data));
    }
    return data;
  },

  async postAction(payload) {
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
    el.textContent = storeName || "Store";
  });

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

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
