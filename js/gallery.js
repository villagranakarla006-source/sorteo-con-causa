(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    const overlay = document.getElementById("galleryOverlay");
    const image = document.getElementById("galleryOverlayImage");
    const caption = document.getElementById("galleryOverlayCaption");
    const closeButton = document.getElementById("galleryOverlayClose");
    const previousButton = document.getElementById("galleryOverlayPrevious");
    const nextButton = document.getElementById("galleryOverlayNext");
    const items = Array.from(document.querySelectorAll("#galeria-premio [data-image]"));

    if (!overlay || !image || !items.length) return;

    let currentIndex = 0;

    function labelFor(item) {
      const label = item.querySelector("span");
      return label ? label.textContent.trim() : "Dodge Journey 2013";
    }

    function render(index) {
      currentIndex = (index + items.length) % items.length;
      const item = items[currentIndex];
      image.src = item.dataset.image;
      image.alt = labelFor(item);
      if (caption) caption.textContent = labelFor(item);
    }

    function openAt(index) {
      render(index);
      overlay.hidden = false;
      document.body.classList.add("gallery-open");
      closeButton?.focus();
    }

    function close() {
      overlay.hidden = true;
      document.body.classList.remove("gallery-open");
    }

    items.forEach(function (item, index) {
      item.addEventListener("click", function (event) {
        event.preventDefault();
        openAt(index);
      });
    });

    closeButton?.addEventListener("click", close);
    previousButton?.addEventListener("click", function () { render(currentIndex - 1); });
    nextButton?.addEventListener("click", function () { render(currentIndex + 1); });

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });

    document.addEventListener("keydown", function (event) {
      if (overlay.hidden) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") render(currentIndex - 1);
      if (event.key === "ArrowRight") render(currentIndex + 1);
    });

    let touchStartX = 0;
    overlay.addEventListener("touchstart", function (event) {
      touchStartX = event.changedTouches[0].screenX;
    }, { passive: true });
    overlay.addEventListener("touchend", function (event) {
      const distance = event.changedTouches[0].screenX - touchStartX;
      if (Math.abs(distance) < 45) return;
      render(currentIndex + (distance < 0 ? 1 : -1));
    }, { passive: true });
  });
})();