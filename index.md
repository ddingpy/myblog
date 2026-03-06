---
layout: default
title: Home
---
# Latest Posts

Welcome to my blog. I share technical articles, tutorials, and practical tips.

<ul class="post-list">
  {% for post in site.posts %}
    <li>
      <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
      <p class="post-meta">
        {{ post.date | date: "%Y-%m-%d" }}
        {% if post.categories.size > 0 %}
          • Categories:
          {% for category in post.categories %}
            {% assign category_slug = category | slugify %}
            <a class="meta-link" href="{{ '/categories/#' | append: category_slug | relative_url }}">{{ category }}</a>{% unless forloop.last %}, {% endunless %}
          {% endfor %}
        {% endif %}
        {% if post.tags.size > 0 %}
          • Tags: {{ post.tags | join: ", " }}
        {% endif %}
      </p>
      <p>{{ post.excerpt | strip_html | truncate: 180 }}</p>
    </li>
  {% else %}
    <li>
      <h2>No posts yet</h2>
      <p>Add markdown files under <code>_posts/</code> to publish articles.</p>
    </li>
  {% endfor %}
</ul>
