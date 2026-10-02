# Articles

A simple black-and-white listing of uploaded articles, images, and documents. The public page has no writing, preview, publishing, token, or upload controls.

## Add content manually

Put your content in **`public/uploads/`**. On GitHub, open this folder, choose **Add file > Upload files**, drag in your files, and commit to `main` or `master`. The Pages workflow automatically rebuilds the listing and deploys the updated site.

You can also copy files into this folder locally, then commit and push. The local development server watches the folder and refreshes the webpage automatically.

- Markdown (`.md`, `.markdown`) is displayed as an article. Its first level-one heading becomes the title.
- Plain text (`.txt`) is displayed as literal text.
- HTML (`.html`, `.htm`) is rendered with scripts and unsafe handlers removed.
- Images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`, `.svg`) are displayed as image entries.
- PDFs and other files are listed with a link to open/download them. Word documents are not converted into webpage text.

Use matching filenames to pair an article with its cover image:

```text
public/uploads/
   my-article.md
   my-article.jpg
```

These become one listing with an image. Matching images also appear inside the article, including plain-text articles. An image already embedded in Markdown is not duplicated. The first Markdown image can also serve as a cover. Unpaired images become separate listings. Subfolders and filenames with spaces are supported. Relative images and links resolve next to the article file, for example:

```md
# My article

Article content here.

![A photo](my-article.jpg)
```

Files are sorted alphabetically by title. Hidden files such as `.gitkeep` are ignored. Removing an upload removes its listing after the next deployment. A reinforcement-learning example and its local PNG illustration are included. Regenerate that image with `node scripts/learning-image.js`.

Upload dates appear in the listing and inside each item. On GitHub Pages, the date is taken from the file's first-added Git commit (following renames), not the latest edit or deployment. The deployment fetches full Git history. For local files not yet committed, the date comes from filesystem creation time, with modification time as a fallback when creation time is unavailable. Dates display in UTC. Existing files cannot reveal an exact past server-upload time beyond the history available.

To preserve a specific date for an imported article, add an entry to `public/uploads/.metadata.json`, using the exact filename (or relative subfolder path) and a real `YYYY-MM-DD` date. This hidden file is not listed as an article. The override takes priority over Git and filesystem dates and survives rebuilds. For example:

```json
{
   "Distributed-transactions.md": {
      "uploadedAt": "2025-05-08"
   }
}
```

GitHub Pages cannot write into its own hosted folder. Manual uploads happen through GitHub's existing file-upload interface or by copying files locally, not through the public webpage. No access token is needed on the webpage.

## Run locally

Requires Node.js 22.12+ (or 24+).

```sh
npm install
npm run dev
```

The upload index is generated on startup, when local uploads change, and during builds. `public/articles.json` is generated; do not edit it manually. The old editor's browser drafts are left untouched but are no longer displayed.

## Host on GitHub Pages

1. Create an empty public GitHub repository, for example `articles`, with default branch `main`.
2. Push this project to it (include `.github`, `public`, and `package-lock.json`; do not upload `node_modules` or `dist`). You can use GitHub Desktop, or run the following commands from this folder, replacing YOUR_USERNAME:

   ```sh
   git init
   git add .
   git commit -m "Create article website"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/articles.git
   git push -u origin main
   ```

3. In the repository, open **Settings > Pages > Build and deployment > Source** and select **GitHub Actions**.
4. Open **Actions > Deploy to GitHub Pages > Run workflow**. After it succeeds, your site is at `https://YOUR_USERNAME.github.io/articles/`. The deployment also supports a user-site repository and a custom domain.

Every push to `main` or `master` indexes the uploads folder and deploys the site. If you use another branch, update the workflow's branch list too. Include `public/uploads/.gitkeep` so GitHub retains the empty upload folder.

## Content limits

There is no application-imposed article count or content length limit. GitHub's file, storage, and hosting limits and browser memory still apply. All uploaded files are publicly accessible.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Tests cover upload indexing, image pairing, supported files, long articles, read-only controls, safe rendering, file links, and desktop/mobile layouts. Actual GitHub deployment still requires your repository and Pages settings.