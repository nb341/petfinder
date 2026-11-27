# Postgres 17 with the extensions the MVP schema uses: PostGIS, pgvector and btree_gist (contrib).
# postgis/postgis publishes amd64 only, so build on the official arm64-ready image with PGDG packages.
FROM postgres:17-bookworm
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-17-postgis-3 postgresql-17-pgvector \
  && rm -rf /var/lib/apt/lists/*
