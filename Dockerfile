FROM jekyll/jekyll:pages

WORKDIR /srv/jekyll

EXPOSE 4000

CMD ["sh", "/srv/jekyll/scripts/dev-server.sh"]
