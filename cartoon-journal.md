---
layout: default
title: Cartoon Journal
permalink: /cartoon-journal/
---
# Cartoon Journal

This is your dedicated space for cartoon journal entries, sketches, ideas, and story notes.

<section class="journal-space">
  <h2>Journal Space</h2>
  <p>
    Use this page as a calm index for your journal work. Keep entries small and consistent.
  </p>
  <ul class="journal-prompt-list">
    <li>What did I draw or imagine today?</li>
    <li>What character or scene felt strongest?</li>
    <li>What should I improve in the next session?</li>
  </ul>
</section>

## Entries

{% assign journal_posts = site.categories["cartoon-journal"] %}

{% if journal_posts and journal_posts.size > 0 %}
  <ul class="post-list journal-post-list">
    {% for post in journal_posts %}
      <li>
        <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
        <p class="post-meta">{{ post.date | date: "%Y-%m-%d" }}{% if post.tags.size > 0 %} • Tags: {{ post.tags | join: ", " }}{% endif %}</p>
        <p>{{ post.excerpt | strip_html | truncate: 180 }}</p>
      </li>
    {% endfor %}
  </ul>
{% else %}
  <p>No cartoon journal entries yet. Add one in <code>_posts/</code> with category <code>cartoon-journal</code>.</p>
{% endif %}
