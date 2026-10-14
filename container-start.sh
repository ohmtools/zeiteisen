#!/bin/sh
# Container entrypoint: writes the pages that carry absolute URLs (the link
# preview tags og:url / og:image in index.html and s/index.html) with the
# origin from SITE_URL, then starts static-web-server. The image builds them
# with the placeholder __SITE_URL__ (Containerfile); /public/index.html and
# /public/s/index.html are symlinks into the writable volume /public/_site.
set -eu

site=${SITE_URL:-}
site=${site%/}
case $site in
  "") echo "zeiteisen: SITE_URL is empty, link previews get no image" >&2 ;;
  http://* | https://*) ;;
  *)
    echo "zeiteisen: SITE_URL must start with https:// (got: $site)" >&2
    exit 1
    ;;
esac
# URL characters only: the value lands in HTML attributes and in sed below
if printf '%s' "$site" | grep -q '[^][A-Za-z0-9._~:/%-]'; then
  echo "zeiteisen: SITE_URL contains characters not allowed in an origin: $site" >&2
  exit 1
fi

out=/public/_site
if ! [ -w "$out" ]; then
  echo "zeiteisen: $out is not writable (the image declares it as a volume)" >&2
  exit 1
fi
cd /opt/zeiteisen/site
find . -type f | while IFS= read -r f; do
  mkdir -p "$out/${f%/*}"
  sed "s|__SITE_URL__|$site|g" "$f" >"$out/$f"
done

exec static-web-server "$@"
