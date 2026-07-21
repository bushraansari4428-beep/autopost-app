const { execSync } = require('child_process');
try {
  execSync('npx next build', { stdio: 'inherit' });
} catch (e) {
  process.exit(1);
}
