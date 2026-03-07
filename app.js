import { filterItems } from "./search.js";

const acc = document.getElementById("acc");
const datasetSelect = document.getElementById("datasetSelect");
const searchInput = document.getElementById("searchInput");
const categorySelect = document.getElementById("categorySelect");
const formSelect = document.getElementById("formSelect");

let allItems = [];

// ---------- helpers ----------
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(s) {
  return (s ?? "").toString().trim();
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "no", { sensitivity: "base" })
  );
}

function fillSelect(selectEl, values, allLabel) {
  const current = selectEl.value || "all";

  selectEl.innerHTML =
    `<option value="all">${escapeHtml(allLabel)}</option>` +
    values
      .map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
      .join("");

  if (["all", ...values].includes(current)) {
    selectEl.value = current;
  } else {
    selectEl.value = "all";
  }
}

function resetFilters() {
  searchInput.value = "";
  categorySelect.value = "all";
  formSelect.value = "all";
}

// læringsform is derived from aktiviteter[].laeringsform
function getLearningForms(item) {
  return (item.aktiviteter || [])
    .map((a) => normalize(a.laeringsform))
    .filter(Boolean);
}

// ---------- render ----------
function renderAccordion(items) {
  acc.innerHTML = items
    .map((item) => {
      const temaHtml = item.tema
        ? `<div class="acc-tema">${escapeHtml(item.tema)}</div>`
        : "";

      const categoryHtml = item.category
        ? `<div class="acc-sub">${escapeHtml(item.category)}</div>`
        : "";

      const laeringsmaalHtml = item.laeringsmaal
        ? `<p class="acc-desc">${escapeHtml(item.laeringsmaal)}</p>`
        : "";

      const aktiviteterTitleHtml = item.sectionsTitle
        ? `<div class="acc-bullets-title">${escapeHtml(item.sectionsTitle)}</div>`
        : "";

      const aktiviteterHtml = (item.aktiviteter || [])
        .filter((a) => a && a.laeringsform)
        .map((a) => {
          const beskrivelseHtml =
            a.beskrivelse && a.beskrivelse.trim()
              ? `<div class="sub-desc">${escapeHtml(a.beskrivelse)}</div>`
              : "";

          const innerItems = (a.items || [])
            .map((it) => {
              if (typeof it === "string") {
                return `<li>${escapeHtml(it)}</li>`;
              }

              if (it && it.laeringsaktivitet) {
                const titleHtml = it.link
                  ? `
                    <a href="${escapeHtml(it.link)}"
                       target="_blank"
                       rel="noopener noreferrer">
                      ${escapeHtml(it.laeringsaktivitet)}
                    </a>
                  `
                  : `${escapeHtml(it.laeringsaktivitet)}`;

                const itemDescHtml =
                  it.beskrivelse && it.beskrivelse.trim()
                    ? `<div class="item-desc">${escapeHtml(it.beskrivelse)}</div>`
                    : "";

                return `
                  <li class="sub-li">
                    <div class="sub-li-title">${titleHtml}</div>
                    ${itemDescHtml}
                  </li>
                `;
              }

              return "";
            })
            .join("");

          const innerContent = innerItems
            ? `<ul class="sub-bullets">${innerItems}</ul>`
            : "";

          return `
            <div class="sub-item">
              <button class="sub-row" type="button" aria-expanded="false">
                <div class="sub-title">${escapeHtml(a.laeringsform)}</div>
                <span class="sub-chevron" aria-hidden="true">⌄</span>
              </button>

              <div class="sub-panel" hidden>
                <div class="sub-content">
                  ${beskrivelseHtml}
                  ${innerContent}
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      const linkLabel = item.linkText || "See more";
      const linkHtml = item.link
        ? `
          <a class="acc-link"
             href="${escapeHtml(item.link)}"
             target="_blank"
             rel="noopener noreferrer">
            ${escapeHtml(linkLabel)} →
          </a>
        `
        : "";

      return `
        <div class="acc-item">
          <button class="acc-row" type="button" aria-expanded="false">
            <div class="acc-left">
              <div class="acc-title">${escapeHtml(item.korttekst_lm)}</div>
              ${temaHtml}
              ${categoryHtml}
            </div>

            <div class="acc-right">
              <span class="acc-code">${escapeHtml(item.kode)}</span>
              <span class="acc-chevron" aria-hidden="true">⌄</span>
            </div>
          </button>

          <div class="acc-panel" hidden>
            ${laeringsmaalHtml}

            ${aktiviteterTitleHtml}
            <div class="sub-acc">
              ${aktiviteterHtml}
            </div>

            ${linkHtml}
          </div>
        </div>
      `;
    })
    .join("");
}

// ---------- accordion behavior ----------
function attachAccordionBehavior() {
  const rows = document.querySelectorAll(".acc-row");

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      rows.forEach((r) => (r.dataset.active = "false"));
      row.dataset.active = "true";

      const panel = row.parentElement.querySelector(".acc-panel");
      const isOpen = row.getAttribute("aria-expanded") === "true";
      const item = row.closest(".acc-item");

      row.setAttribute("aria-expanded", String(!isOpen));
      row.dataset.open = String(!isOpen);

      if (item) item.classList.toggle("is-open", !isOpen);
      if (panel) panel.hidden = isOpen;
    });
  });
}

let subAccordionAttached = false;
function attachSubAccordionBehavior() {
  if (subAccordionAttached) return;
  subAccordionAttached = true;

  acc.addEventListener("click", (e) => {
    const row = e.target.closest(".sub-row");
    if (!row) return;

    e.stopPropagation();

    const panel = row.parentElement.querySelector(".sub-panel");
    const isOpen = row.getAttribute("aria-expanded") === "true";

    row.setAttribute("aria-expanded", String(!isOpen));
    row.dataset.open = String(!isOpen);

    if (panel) panel.hidden = isOpen;
  });
}

// ---------- filtering ----------
function applyFilters() {
  const filters = {
    searchText: searchInput.value.trim(),
    selectedTema: categorySelect.value,
    selectedForm: formSelect.value,
  };

  const filteredItems = filterItems(allItems, filters);

  renderAccordion(filteredItems);
  attachAccordionBehavior();
}

// ---------- data loading ----------
async function loadDataset(datasetName) {
  const fileMap = {
    lm: "./json_data/alm.json",
    sam: "./json_data/sam.json",
    fkm: "./json_data/fkm.json"
  };

  const filePath = fileMap[datasetName];
  const res = await fetch(filePath);
  const data = await res.json();

  allItems = data.map((x) => ({
    ...x,
    kode: normalize(x.kode).replace(/\s+/g, " "),
    tema: normalize(x.tema),
  }));

  const temaer = uniqueSorted(allItems.map((x) => normalize(x.tema)));
  const former = uniqueSorted(allItems.flatMap((x) => getLearningForms(x)));

  fillSelect(categorySelect, temaer, "Alle tema");
  fillSelect(formSelect, former, "Alle læringsformer");

  formSelect.disabled = former.length === 0;

  applyFilters();
}

// ---------- main ----------
async function main() {
  attachSubAccordionBehavior();

  await loadDataset(datasetSelect.value);

  searchInput.addEventListener("input", applyFilters);
  categorySelect.addEventListener("change", applyFilters);
  formSelect.addEventListener("change", applyFilters);

  datasetSelect.addEventListener("change", async () => {
    resetFilters();
    await loadDataset(datasetSelect.value);
  });
}

main();