const { execSync } = require('child_process');
const fs = require('fs');
try {
  const status = execSync('git status', { encoding: 'utf-8' });
  const diff = execSync('git diff', { encoding: 'utf-8' });
  fs.writeFileSync('git_status_node.txt', status);
  fs.writeFileSync('git_diff_node.txt', diff);
} catch (e) {
  fs.writeFileSync('git_error.txt', e.toString());
}
