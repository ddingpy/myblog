---
layout: default
title: Categories
permalink: /categories/
---
# Categories

Browse posts by topic.

{% assign sorted_categories = site.categories | sort %}

<ul class="category-index">
  {% for category in sorted_categories %}
    {% assign category_name = category[0] %}
    {% assign posts = category[1] %}
    <li>
      <a href="#{{ category_name | slugify }}">{{ category_name }}</a>
      <span class="category-count">({{ posts | size }})</span>
    </li>
  {% endfor %}
</ul>

{% for category in sorted_categories %}
  {% assign category_name = category[0] %}
  {% assign posts = category[1] %}
  <section id="{{ category_name | slugify }}" class="category-section">
    <h2>{{ category_name }}</h2>
    <ul class="post-list">
      {% for post in posts %}
        <li>
          <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
          <p class="post-meta">{{ post.date | date: "%Y-%m-%d" }}{% if post.tags.size > 0 %} • Tags: {{ post.tags | join: ", " }}{% endif %}</p>
          <p>{{ post.excerpt | strip_html | truncate: 180 }}</p>
        </li>
      {% endfor %}
    </ul>
  </section>
{% endfor %}
