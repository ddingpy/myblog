---
layout: default
title: Categories
permalink: /categories/
---
# Categories

Browse posts by topic.

{% capture category_csv %}{% for post in site.posts %}{% assign post_path_parts = post.path | split: '/' %}{% assign category_name = post_path_parts[1] %}{% if category_name and category_name != "" %}|{{ category_name }}{% endif %}{% endfor %}{% endcapture %}
{% assign category_list = category_csv | split: '|' | uniq | sort %}

## Category Index

{% for category_name in category_list %}
{% if category_name != "" %}
{% assign category_prefix = '_posts/' | append: category_name | append: '/' %}
{% assign posts = site.posts | where_exp: "p", "p.path contains category_prefix" %}
{% assign category_slug = category_name | slugify %}
- [{{ category_name }}]({{ '/categories/' | append: category_slug | append: '/' | relative_url }}) ({{ posts | size }})
{% endif %}
{% endfor %}
