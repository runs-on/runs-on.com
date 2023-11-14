# runs-on.com

Repository for the static website at https://runs-on.com.

Blog posts are automatically taken from GitHub issues, and exported to markdown files using `moulinette`, a little GitHub Action embedded in `.github/actions/moulinette`.

On each push to `main`, the site is then statically compiled (with [Sitepress](https://sitepress.cc)) and deployed on Cloudflare Pages.
