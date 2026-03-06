---
layout: default
title: Home
---
# Latest Posts

Welcome to my blog. I share technical articles, tutorials, and practical tips.

{% if site.posts.size > 0 %}
{: .latest-posts-list }
{% for post in site.posts %}
{% assign post_category = post.path | split: '/' | slice: 1, 1 | first %}
{% assign post_category_slug = post_category | slugify %}
- `{{ post.date | date: "%Y-%m-%d" }}` [{{ post.title }}]({{ post.url | relative_url }}) · [{{ post_category }}]({{ '/categories/' | append: post_category_slug | append: '/' | relative_url }}){% if post.tags.size > 0 %} · {{ post.tags | join: ", " }}{% endif %}
{% endfor %}
{% else %}
No posts yet. Add markdown files under `_posts/` to publish articles.
{% endif %}
