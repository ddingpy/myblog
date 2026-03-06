---
layout: default
---
<h1>Category: {{ page.category_name | default: page.category_key }}</h1>

<p><a href="{{ '/categories/' | relative_url }}">← Back to Categories</a></p>

{% assign category_key = page.category_key %}
{% assign category_prefix = '_posts/' | append: category_key | append: '/' %}
{% assign category_posts = site.posts | where_exp: "p", "p.path contains category_prefix" %}

{% if category_posts and category_posts.size > 0 %}
<ul class="latest-posts-list">
{% for post in category_posts %}
  <li>
    <code>{{ post.date | date: "%Y-%m-%d" }}</code>
    <a href="{{ post.url | relative_url }}">{{ post.title }}</a>{% if post.tags.size > 0 %} · {{ post.tags | join: ", " }}{% endif %}
  </li>
{% endfor %}
</ul>
{% else %}
<p>No posts in this category yet.</p>
{% endif %}
