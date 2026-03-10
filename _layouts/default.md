<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {% seo %}
    <link rel="stylesheet" href="{{ '/assets/css/mynote.css' | relative_url }}">
    {% if site.google_analytics %}
      <script async src="https://www.googletagmanager.com/gtag/js?id={{ site.google_analytics }}"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '{{ site.google_analytics }}');
      </script>
    {% endif %}
  </head>
  <body{% if page.url == '/' %} class="is-home"{% endif %}>
    <header class="site-header">
      <div class="container">
        <a class="site-title" href="{{ '/' | relative_url }}">{{ site.title }}</a>
        <nav class="site-nav" aria-label="Main navigation">
          <a href="{{ '/' | relative_url }}">Home</a>
          <a href="{{ '/journal/' | relative_url }}">Journal</a>
          <a href="{{ '/categories/' | relative_url }}">Categories</a>
          <a href="{{ '/search/' | relative_url }}">Search</a>
          <a href="{{ '/about/' | relative_url }}">About</a>
        </nav>
      </div>
    </header>

    <main class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="{{ '/' | relative_url }}">Home</a>
        {% if page.url != '/' %}
          <span class="breadcrumb-separator">/</span>
          {% if page.collection == "posts" %}
            <a href="{{ '/categories/' | relative_url }}">Categories</a>
            {% assign page_path_parts = page.path | split: '/' %}
            {% assign primary_category = page_path_parts[1] %}
            {% if primary_category and primary_category != "" %}
              {% assign primary_category_slug = primary_category | slugify %}
              <span class="breadcrumb-separator">/</span>
              <a href="{{ '/categories/' | append: primary_category_slug | append: '/' | relative_url }}">{{ primary_category }}</a>
            {% endif %}
            <span class="breadcrumb-separator">/</span>
            <span aria-current="page">{{ page.title }}</span>
          {% else %}
            <span aria-current="page">{{ page.title | default: page.url }}</span>
          {% endif %}
        {% endif %}
      </nav>

      {{ content }}
    </main>

    <footer class="site-footer">
      <div class="container">
        <p>&copy; {{ site.time | date: '%Y' }} {{ site.title }}.</p>
      </div>
    </footer>
  </body>
</html>
