---
layout: default
title: Search
permalink: /search/
search: false
---
# Search Articles

Type keywords to search across all markdown posts.

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
<script src="{{ '/assets/js/search.js' | relative_url }}"></script>
