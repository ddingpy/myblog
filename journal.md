---
layout: default
title: Journal
permalink: /journal/
---
# Journal

This is your dedicated space for journal entries, sketches, ideas, and story notes.

{% assign journal_posts = site.posts | where_exp: "p", "p.path contains '_posts/journal/'" %}

{% if journal_posts and journal_posts.size > 0 %}
{: .latest-posts-list }
{% for post in journal_posts %}
- `{{ post.date | date: "%Y-%m-%d" }}` [{{ post.title }}]({{ post.url | relative_url }}){% if post.tags.size > 0 %} · {{ post.tags | join: ", " }}{% endif %}
{% endfor %}
{% else %}
No journal entries yet. Add one in `_posts/journal/`.
{% endif %}
