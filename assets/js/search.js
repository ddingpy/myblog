function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function makeSnippet(content, query) {
  if (!content) {
    return "";
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  if (!query) {
    return normalized.slice(0, 180);
  }

  const index = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return normalized.slice(0, 180);
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(normalized.length, index + 120);
  return normalized.slice(start, end);
}

function renderResults(results, docsById, query) {
  const container = document.getElementById("search-results");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (query && results.length === 0) {
    container.innerHTML = "<li>No results found.</li>";
    return;
  }

  const entries = query ? results.map((result) => docsById[result.ref]) : Object.values(docsById);

  entries.slice(0, 30).forEach((doc) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <h3><a href="${doc.url}">${escapeHtml(doc.title)}</a></h3>
      <p class="post-meta">${escapeHtml(doc.date)}</p>
      <p class="search-snippet">${escapeHtml(makeSnippet(doc.content, query))}...</p>
    `;
    container.appendChild(item);
  });
}

async function initSearch() {
  const input = document.getElementById("search-input");
  if (!input) {
    return;
  }

  const response = await fetch(`${window.location.origin}${input.dataset.searchIndex}`);
  const documents = await response.json();
  const docsById = {};

  documents.forEach((doc) => {
    docsById[doc.id] = doc;
  });

  const index = lunr(function () {
    this.ref("id");
    this.field("title", { boost: 10 });
    this.field("tags", { boost: 6 });
    this.field("categories", { boost: 6 });
    this.field("content");

    documents.forEach((doc) => this.add(doc));
  });

  renderResults([], docsById, "");

  input.addEventListener("input", (event) => {
    const query = event.target.value.trim();
    if (!query) {
      renderResults([], docsById, "");
      return;
    }

    const results = index.search(`${query}* ${query}`);
    renderResults(results, docsById, query);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initSearch().catch((error) => {
    const container = document.getElementById("search-results");
    if (container) {
      container.innerHTML = `<li>Search failed to load: ${escapeHtml(error.message)}</li>`;
    }
  });
});
