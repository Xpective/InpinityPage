document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupThemeDots();
  setupCopyButtons();
  setupContactFormHelpers();
  setupStickyDetailsAutoClose();
  setupAccordionIfPresent();
  setupOptionalToolsScroll();
  setupOptionalModals();
});

/* =========================================================
   THEME
========================================================= */
function initTheme() {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("inpinity-theme");

  if (savedTheme && ["light", "dark", "basic"].includes(savedTheme)) {
    root.setAttribute("data-theme", savedTheme);
  } else {
    root.setAttribute("data-theme", "basic");
  }
}

function setupThemeDots() {
  const root = document.documentElement;

  const lightDot = document.querySelector(".themeDots .dot.light");
  const darkDot = document.querySelector(".themeDots .dot.dark");
  const basicDot = document.querySelector(".themeDots .dot.basic");

  lightDot?.addEventListener("click", () => setTheme(root, "light"));
  darkDot?.addEventListener("click", () => setTheme(root, "dark"));
  basicDot?.addEventListener("click", () => setTheme(root, "basic"));
}

function setTheme(root, themeName) {
  root.setAttribute("data-theme", themeName);
  localStorage.setItem("inpinity-theme", themeName);
}

/* =========================================================
   COPY BUTTONS
========================================================= */
function setupCopyButtons() {
  const buttons = document.querySelectorAll(".copy-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy");
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        const oldText = btn.textContent;
        btn.textContent = "Copied ✅";

        setTimeout(() => {
          btn.textContent = oldText;
        }, 1200);
      } catch (error) {
        const oldText = btn.textContent;
        btn.textContent = "Copy failed";

        setTimeout(() => {
          btn.textContent = oldText;
        }, 1200);
      }
    });
  });
}

/* =========================================================
   CONTACT FORM
========================================================= */
function setupContactFormHelpers() {
  const form = document.getElementById("contact-form");
  const resultEl = document.getElementById("form-result");

  if (!form || !resultEl) return;

  const fields = form.querySelectorAll("input, textarea");

  fields.forEach((field) => {
    field.addEventListener("input", () => {
      resultEl.textContent = "";
      resultEl.className = "";
    });
  });

  if (typeof Forminit !== "undefined") {
    const forminit = new Forminit();
    const FORM_ID = "7ktpdl3xza8";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const response = await forminit.submit(FORM_ID, formData);
      const error = response?.error;

      if (error) {
        resultEl.innerHTML = `<span class="error-message">❌ ${error.message}</span>`;
        return;
      }

      resultEl.innerHTML =
        '<span class="success-message">✅ Message sent successfully! We will get back to you soon.</span>';
      form.reset();
    });
  }
}

/* =========================================================
   DETAILS / STICKY
========================================================= */
function setupStickyDetailsAutoClose() {
  window.addEventListener("scroll", () => {
    const stickyDetails = document.querySelector("details.sticky[open]");
    if (stickyDetails && window.scrollY > 0) {
      stickyDetails.removeAttribute("open");
    }
  });
}

/* =========================================================
   OPTIONAL ACCORDION
   Runs only if accordion exists on a page
========================================================= */
function setupAccordionIfPresent() {
  const accordionItems = document.querySelectorAll(".accordion-item");
  if (!accordionItems.length) return;

  accordionItems.forEach((item) => {
    item.addEventListener("click", () => {
      const activeItem = document.querySelector(".accordion-item.active");

      if (activeItem && activeItem !== item) {
        activeItem.classList.remove("active");
        const activeContent = activeItem.querySelector(".accordion-content");
        if (activeContent) {
          activeContent.style.maxHeight = "0px";
        }
      }

      item.classList.toggle("active");

      const content = item.querySelector(".accordion-content");
      if (!content) return;

      if (item.classList.contains("active")) {
        content.style.maxHeight = content.scrollHeight + "px";
      } else {
        content.style.maxHeight = "0px";
      }
    });
  });
}

/* =========================================================
   OPTIONAL TOOLS SCROLL
========================================================= */
function setupOptionalToolsScroll() {
  const container = document.getElementById("tools-scroll-container");
  if (!container) return;

  container.addEventListener("scroll", () => {
    if (container.scrollLeft + container.clientWidth >= container.scrollWidth) {
      container.scrollLeft = 0;
      showModal("constructionModal");
    }
  });
}

function focusTool(selectedTool) {
  const container = document.querySelector(".tools-container");
  const tools = document.querySelectorAll(".tool");

  if (!container || !selectedTool || !tools.length) return;

  const containerWidth = container.offsetWidth;
  const toolWidth = selectedTool.offsetWidth;

  tools.forEach((tool) => {
    tool.style.backgroundColor = "";
    tool.style.transform = "scale(1)";
  });

  selectedTool.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
  selectedTool.style.transform = "scale(1.05)";

  const scrollLeft =
    selectedTool.offsetLeft - containerWidth / 2 + toolWidth / 2;

  container.style.transform = `translateX(-${scrollLeft}px)`;
}

/* =========================================================
   OPTIONAL MODALS
========================================================= */
function setupOptionalModals() {
  window.addEventListener("click", (event) => {
    const modalIds = [
      "constructionModal",
      "constructionModal1",
      "constructionModal2",
      "constructionModal3"
    ];

    modalIds.forEach((id) => {
      const modal = document.getElementById(id);
      if (modal && event.target === modal) {
        modal.style.display = "none";
      }
    });
  });
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = "flex";
}

function doSomething(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = "block";
}
