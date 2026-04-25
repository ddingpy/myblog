---
layout: default
---
{{ content }}

<input
  id="search-input"
  class="search-box"
  type="search"
  placeholder="Search by title, tags, categories, or content"
  aria-label="Search posts"
  data-search-index="{{ '/search.json' | relative_url }}"
/>

<ul id="search-results" class="search-results"></ul>

<script src="https://cdn.jsdelivr.net/npm/lunr@2.3.9/lunr.min.js"></script>
<script src="{{ '/assets/js/search.js' | relative_url }}?v={{ site.time | date: '%s' }}"></script>
