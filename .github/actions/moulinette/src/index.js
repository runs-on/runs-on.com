const core = require('@actions/core');
const { Octokit } = require('@octokit/rest');
const slugify = require('slugify');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { rimrafSync } = require('rimraf')
const OpenAI = require('openai');
const mime = require('mime-types')

const REPO_OWNER = process.env.GITHUB_REPOSITORY.split('/')[0]
const REPO_NAME = process.env.GITHUB_REPOSITORY.split('/')[1]
const PUBLISHED_LABEL = core.getInput('published-label') || 'state:published';
const ISSUE_EXTENSION = core.getInput('issue-extension') || '.html.md';
const ISSUE_PATH = core.getInput('issue-path') || 'pages/posts/<issue-number>-<issue-filename>';
const IMAGE_PATH = core.getInput('image-path') || 'assets/images/posts/<issue-number>-<image-filename>';
const IMAGE_TAG = core.getInput('image-tag') || `/assets/posts/<issue-number>-<image-filename>`
const AI_DESCRIPTION_PROMPT = core.getInput('ai-description-prompt') || "You are a search engine optimization expert, tasked with generating short, optimized SEO descriptions of blog posts. The resulting description must be plain text, no links, and 3 sentences max."

let GITHUB_TOKEN;
if (core.getInput('github-token')?.length > 0) {
  console.log("Using GitHub token from input")
  GITHUB_TOKEN = core.getInput('github-token');
} else if (process.env.GITHUB_TOKEN?.length > 0) {
  console.log("Using GitHub token from environment")
  GITHUB_TOKEN = process.env.GITHUB_TOKEN;
} else {
  console.log("No GitHub token found")
}
let OPENAI_API_KEY;
if (core.getInput('openai-api-key')?.length > 0) {
  console.log("Using OpenAI API key from input")
  OPENAI_API_KEY = core.getInput('openai-api-key');
} else if (process.env.OPENAI_API_KEY?.length > 0) {
  console.log("Using OpenAI API key from environment")
  OPENAI_API_KEY = process.env.OPENAI_API_KEY;
} else {
  console.log("No OpenAI key given")
}

// fallback to default GITHUB_TOKEN, even though it most liklely doesn't have the necessary permissions
const GITHUB_TOKEN_FOR_PRIVATE_IMAGES = core.getInput('github-token-for-private-images') || GITHUB_TOKEN;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

const canUpdateIssue = ![undefined, ""].includes(GITHUB_TOKEN);
const canGenerateDescription = ![undefined, ""].includes(OPENAI_API_KEY);

function calculateReadingSeconds(content) {
  // Adjust this value based on your desired reading speed in words per minute
  const wordsPerSecond = 3;

  const wordCount = content.split(/\s+/).length;
  const calculateReadingSeconds = Math.ceil(wordCount / wordsPerSecond);

  return calculateReadingSeconds;
}

async function generateSEODescription(content) {
  if (!canGenerateDescription) {
    console.error("Skipping SEO description generation.")
    return null;
  }

  try {
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    console.log(`Generating SEO description...`);
    const response = await openai.chat.completions.create({
      messages: [
        { "role": "system", "content": AI_DESCRIPTION_PROMPT },
        { "role": "user", "content": `Blog post:\n\n###\n${content}\n\nDescription:` }
      ],
      model: 'gpt-3.5-turbo',
      max_tokens: 120,
    });

    const description = response.choices[0].message.content.trim();
    console.log(`Generated SEO description: ${description}`);
    return description;
  } catch (error) {
    throw new Error(`Error generating SEO description: ${error.message}`);
  }
}

async function updateIssue(issue) {
  const issueSlug = slugify(issue.title, { lower: true, strict: true });
  let issueContent = issue.body;

  const tags = issue.labels
    .filter(label => label.name.startsWith('tag:'))
    .map(label => label.name.replace(/^tag:/, ''));

  // Create front-matter
  const frontMatterData = {
    slug: issueSlug,
    title: issue.title,
    tags: tags,
    url: issue.html_url,
    comments_count: issue.comments,
    author_name: issue.user.login,
    author_avatar_url: issue.user.avatar_url,
    reading_time: calculateReadingSeconds(issueContent),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    layout: 'post',
  };

  if (!issueContent.includes('<!-- description:')) {
    const description = await generateSEODescription(issueContent);

    if (description) {
      // Update front matter with the description
      frontMatterData.description = description;

      // Add hidden HTML comment in the issue body
      const descriptionComment = `<!-- description: ${description} -->`;
      const newIssueContent = `${descriptionComment}\n${issueContent}`;

      if (canUpdateIssue) {
        console.log("Updating GitHub issue with new description...")
        // Update the issue body on GitHub. This won't trigger a new workflow.
        await octokit.issues.update({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          issue_number: issue.number,
          body: newIssueContent,
        });
      }
    }
  } else {
    // Extract the existing description from the HTML comment
    const descriptionMatch = /<!-- description: (.+?) -->/.exec(issueContent);
    if (descriptionMatch && descriptionMatch[1]) {
      frontMatterData.description = descriptionMatch[1];
    }
    // Remove comment from exported markdown
    issueContent = issueContent.replace(/<!-- description: .+? -->\n?/, '');
  }

  const frontMatterString = Object.entries(frontMatterData)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');

  const issueFilename = `${issueSlug}${ISSUE_EXTENSION}`;
  const filePath = path.join(ISSUE_PATH.replace('<issue-number>', issue.number).replace('<issue-filename>', issueFilename));

  // Fetch images and update links. Matches both markdown format and HTML format
  const imageMarkdownRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const imageHtmlRegex = /<img [^>]*src=["']([^"']+)["'][^>]*>/g;
  const imageMatches = [...issueContent.matchAll(imageMarkdownRegex), ...issueContent.matchAll(imageHtmlRegex)];

  for (const match of imageMatches) {
    const imageUrl = match[1];
    const headers = {};
    // Need to add a (classic) PAT for fetching private images, with full repo scope. There is no way to do it with the workflow's GITHUB_TOKEN
    // I raised a bug with GitHub about that.
    if (imageUrl.startsWith('https://github.com') && GITHUB_TOKEN_FOR_PRIVATE_IMAGES) {
      headers['Authorization'] = `Token ${GITHUB_TOKEN_FOR_PRIVATE_IMAGES}`;
    }
    console.log(`Fetching image: ${imageUrl}`)
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'stream',
        headers: headers,
      });

      let imageName = path.basename(imageUrl);
      if (!path.extname(imageName)) {
        const imageExtension = mime.extension(response.headers['content-type']);
        imageName = `${imageName}.${imageExtension}`;
      }
      const imageLocalPath = path.join(IMAGE_PATH.replace('<issue-number>', issue.number).replace('<image-filename>', imageName));

      fs.mkdirSync(path.dirname(imageLocalPath), { recursive: true });
      response.data.pipe(fs.createWriteStream(imageLocalPath));
      console.log(`Fetched and saved image: ${imageLocalPath}`);
      issueContent = issueContent.replace(imageUrl, IMAGE_TAG.replace('<issue-number>', issue.number).replace('<image-filename>', imageName));
    } catch (error) {
      throw new Error(`Error fetching image ${imageUrl}: ${error.message}`);
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${frontMatterString}\n---\n` + issueContent);

  console.log(`Saved content for issue #${issue.number} to ${filePath}`);
}

function removeIssue(issue) {
  const issueGlob = path.join(ISSUE_PATH.replace('<issue-number>', issue.number).replace('<issue-filename>', '*'));
  console.log(`Removing files at ${issueGlob}`)
  rimrafSync(issueGlob, { glob: true, verbose: true });

  // Remove downloaded images if any
  const imageGlob = path.join(IMAGE_PATH.replace('<issue-number>', issue.number).replace('<image-filename>', '*'));
  console.log(`Removing files at ${imageGlob}`)
  rimrafSync(imageGlob, { glob: true, verbose: true });
}

async function manageIssue(issue) {
  const labels = issue.labels.map(label => label.name);
  console.log(`Processing issue ${issue.number} - ${issue.title} with labels ${labels}`)

  // remove existing page if any
  removeIssue(issue);

  if (labels.includes(PUBLISHED_LABEL)) {
    console.log(`Updating issue ${issue.number} - ${issue.title}`)
    return await updateIssue(issue);
  }
}

async function run() {
  try {
    const eventName = process.env.GITHUB_EVENT_NAME;

    if (eventName === 'issues') {
      const eventData = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
      const issue = eventData.issue;
      await manageIssue(issue)
    } else {
      const { data: issues } = await octokit.issues.listForRepo({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        state: 'all'
      });

      for (const issue of issues) {
        if (process.env.ISSUE_NUMBER && issue.number !== parseInt(process.env.ISSUE_NUMBER)) {
          continue;
        }
        await manageIssue(issue);
      }
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
