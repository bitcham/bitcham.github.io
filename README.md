# Blog

Jekyll blog for GitHub Pages with two writing sections:

- `_tech`: technical articles, with `domain` set to `AI`, `BACKEND`, or `CS`
- `_mythought`: personal thought articles

## Write a Tech post

Create a file like `_tech/YYYY-MM-DD-post-slug.md`.

```yaml
---
title: "Post Title"
date: 2026-04-21 10:00:00 +0300
domain: BACKEND
tags: [kotlin, backend, coroutine]
excerpt: "A short summary for the article card."
---
```

`domain` must be one of:

```text
AI, BACKEND, CS
```

## Write a MyThought post

Create a file like `_mythought/YYYY-MM-DD-post-slug.md`.

```yaml
---
title: "Post Title"
date: 2026-04-21 10:00:00 +0300
tags: [writing, craft]
excerpt: "A short summary for the article card."
---
```

## Use images

Store images under `assets/images`. The recommended structure is one folder per post:

```text
assets/images/tech/YYYY-MM-DD-post-slug/
  request-scope.png
  cancellation-flow.png

assets/images/mythought/YYYY-MM-DD-post-slug/
  desk-note.png
```

Use lowercase English filenames with hyphens. This keeps URLs simple and avoids encoding issues.

Good:

```text
request-scope.png
distributed-cache-flow.webp
spring-filter-chain.jpg
```

Avoid:

```text
Screenshot 2026-04-21 at 3.22.11 PM.png
image (1).png
내그림.png
```

To show an image inside a post:

```markdown
![Image description](/assets/images/tech/YYYY-MM-DD-post-slug/image-name.png)
```

To use an image as the article card thumbnail, add `image` to the front matter:

```yaml
---
title: "Post Title"
date: 2026-04-21 10:00:00 +0300
domain: BACKEND
tags: [kotlin, backend, coroutine]
excerpt: "A short summary for the article card."
image: /assets/images/tech/YYYY-MM-DD-post-slug/image-name.png
---
```

Card media priority:

```text
image -> code_preview -> visual_text -> title
```

For captions, use HTML inside Markdown:

```html
<figure>
  <img src="/assets/images/tech/YYYY-MM-DD-post-slug/image-name.png" alt="Image description">
  <figcaption>Short caption for the image.</figcaption>
</figure>
```

Recommended formats:

```text
screenshots: png
diagrams: png or svg
photos: webp or jpg
transparent assets: png
```

## Preview locally

```powershell
bundle install
bundle exec jekyll serve
```

Then open `http://localhost:4000`.

## Publish

```powershell
git add .
git commit -m "Add blog update"
git push origin main
```
