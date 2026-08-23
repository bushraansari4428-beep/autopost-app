require('dotenv').config();

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubToken) {
     console.log('No GITHUB_TOKEN in env');
     process.exit(1);
  }

  const response = await fetch('https://api.github.com/repos/bushraansari4428-beep/autopost-app/actions/workflows/auto-scraper.yml/dispatches', {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${githubToken}`,
      'User-Agent': 'AutoPost-App'
    },
    body: JSON.stringify({
      ref: 'main'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GitHub API error: ${response.status} - ${errorText}`);
  } else {
    console.log('GitHub Action triggered successfully.');
  }
}

main().catch(console.error);
