
window.RifaUI = {
  toast(message, type = "info") {
    let root = document.getElementById("toastRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "toastRoot";
      root.className = "toast-root";
      document.body.appendChild(root);
    }
    const item = document.createElement("div");
    item.className = `toast toast-${type}`;
    item.textContent = message;
    root.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 250);
    }, 3200);
  },
  setLoading(button, loading, label = "Procesando…") {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = label;
      button.classList.add("is-loading");
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
      button.classList.remove("is-loading");
    }
  },
  normalizePhone(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 10);
  },
  money(value) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  },
  escape(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }
};
