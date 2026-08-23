
require('dotenv').config();

async function main() {
  const res = await fetch('https://api.github.com/repos/bushraansari4428-beep/autopost-app/actions/runs?per_page=5', {
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  const data = await res.json();
  if (data.workflow_runs) {
    for (const run of data.workflow_runs) {
      console.log(`${run.id} - ${run.status} - ${run.conclusion} - ${run.created_at}`);
    }
  } else {
    console.log(data);
  }
}
main();
