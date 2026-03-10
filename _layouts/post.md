---
layout: default
---
{% assign page_path_parts = page.path | split: '/' %}
{% assign current_category = page_path_parts[1] %}
{% assign prev_in_category = nil %}
{% assign next_in_category = nil %}
{% assign found_current = false %}

{% for candidate in site.posts %}
  {% assign candidate_path_parts = candidate.path | split: '/' %}
  {% assign candidate_category = candidate_path_parts[1] %}
  {% if found_current and current_category and candidate_category == current_category %}
      {% assign prev_in_category = candidate %}
      {% break %}
  {% endif %}
  {% if candidate.url == page.url %}
    {% assign found_current = true %}
  {% endif %}
{% endfor %}

{% for candidate in site.posts %}
  {% if candidate.url == page.url %}
    {% break %}
  {% endif %}
  {% assign candidate_path_parts = candidate.path | split: '/' %}
  {% assign candidate_category = candidate_path_parts[1] %}
  {% if current_category and candidate_category == current_category %}
    {% assign next_in_category = candidate %}
  {% endif %}
{% endfor %}

<article class="post{% if current_category %} post-category-{{ current_category | slugify }}{% endif %}">
  <header>
    <h1>{{ page.title }}</h1>
    <p class="post-meta">
      {{ page.date | date: "%B %-d, %Y" }}
      {% if current_category %}
        {% assign current_category_slug = current_category | slugify %}
        • Category:
        <a class="meta-link" href="{{ '/categories/' | append: current_category_slug | append: '/' | relative_url }}">{{ current_category }}</a>
      {% endif %}
      {% if page.tags.size > 0 %}
        • Tags: {{ page.tags | join: ", " }}
      {% endif %}
    </p>
  </header>
  {{ content }}

  <nav class="post-pager" aria-label="Post navigation">
    <div class="post-pager-slot">
      {% if prev_in_category %}
        <a href="{{ prev_in_category.url | relative_url }}">← Previous (same category): {{ prev_in_category.title }}</a>
      {% endif %}
    </div>
    <div class="post-pager-slot post-pager-center">
      {% if current_category %}
        {% assign current_category_slug = current_category | slugify %}
        <a href="{{ '/categories/' | append: current_category_slug | append: '/' | relative_url }}">List</a>
      {% else %}
        <a href="{{ '/categories/' | relative_url }}">All Categories</a>
      {% endif %}
    </div>
    <div class="post-pager-slot post-pager-right">
      {% if next_in_category %}
        <a href="{{ next_in_category.url | relative_url }}">Next (same category): {{ next_in_category.title }} →</a>
      {% endif %}
    </div>
  </nav>
</article>
