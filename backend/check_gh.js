const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function checkActions() {
  const token = process.env.GITHUB_TOKEN;
  const res = await axios.get('https://api.github.com/repos/bushraansari4428-beep/autopost-app/actions/runs?per_page=3', {
    headers: { 'Authorization': `token ${token}` }
  });
  
  for (const run of res.data.workflow_runs) {
    console.log(`Run ID: ${run.id}, Status: ${run.status}, Conclusion: ${run.conclusion}, CreatedAt: ${run.created_at}`);
  }
}
checkActions().catch(console.error);
