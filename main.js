document.addEventListener("DOMContentLoaded", () => {
  setupThemeDots();
  setupCopyButtons();
  setupContactFormMessageClear();
  setupStickyDetailsAutoClose();
  setupSafeAccordion();
  setupOptionalModal();
  setupOptionalToolsScroll();
});

/* -----------------------------
   Theme switcher
----------------------------- */
function setupThemeDots() {
  const body = document.body;
  const lightDot = document.querySelector(".themeDots .dot.light");
  const darkDot = document.querySelector(".themeDots .dot.dark");
  const basicDot = document.querySelector(".themeDots .dot.basic");

  lightDot?.addEventListener("click", () => body.setAttribute("data-theme", "light"));
  darkDot?.addEventListener("click", () => body.setAttribute("data-theme", "dark"));
  basicDot?.addEventListener("click", () => body.setAttribute("data-theme", "basic"));
}

/* -----------------------------
   Copy buttons
----------------------------- */
function setupCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy");
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        const old = btn.textContent;
        btn.textContent = "Copied ✅";
        setTimeout(() => {
          btn.textContent = old;
        }, 1200);
      } catch (error) {
        const old = btn.textContent;
        btn.textContent = "Copy failed";
        setTimeout(() => {
          btn.textContent = old;
        }, 1200);
      }
    });
  });
}

/* -----------------------------
   Contact helper
----------------------------- */
function setupContactFormMessageClear() {
  const form = document.getElementById("contact-form");
  const resultEl = document.getElementById("form-result");

  if (!form || !resultEl) return;

  form.querySelectorAll("input, textarea").forEach((field) => {
    field.addEventListener("input", () => {
      resultEl.textContent = "";
      resultEl.className = "";
    });
  });
}

/* -----------------------------
   Sticky details auto close
----------------------------- */
function setupStickyDetailsAutoClose() {
  window.addEventListener("scroll", () => {
    const stickyDetails = document.querySelector("details.sticky[open]");
    if (stickyDetails && window.scrollY > 0) {
      stickyDetails.removeAttribute("open");
    }
  });
}

/* -----------------------------
   Optional accordion support
   Only runs if such elements exist
----------------------------- */
function setupSafeAccordion() {
  const accordionItems = document.querySelectorAll(".accordion-item");
  if (!accordionItems.length) return;

  accordionItems.forEach((item) => {
    item.addEventListener("click", () => {
      const currentActive = document.querySelector(".accordion-item.active");

      if (currentActive && currentActive !== item) {
        currentActive.classList.remove("active");
        const currentContent = currentActive.querySelector(".accordion-content");
        if (currentContent) currentContent.style.maxHeight = "0px";
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

/* -----------------------------
   Optional tools scroll logic
----------------------------- */
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

  const scrollLeft = selectedTool.offsetLeft - (containerWidth / 2) + (toolWidth / 2);
  container.style.transform = `translateX(-${scrollLeft}px)`;

  selectedTool.style.transform = "scale(1.05)";
}

/* -----------------------------
   Optional modal logic
----------------------------- */
function setupOptionalModal() {
  window.addEventListener("click", (event) => {
    ["constructionModal", "constructionModal1", "constructionModal2", "constructionModal3"].forEach((id) => {
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
