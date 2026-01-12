
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Calculate version based on GitHub commits
  // Logic: 0.0.10 (10 commits), 0.1.0 (100 commits), 1.0.0 (1000 commits)
  let commitCount = '0';
  try {
    commitCount = execSync('git rev-list --count HEAD').toString().trim();
  } catch (e) {
    // Fallback if git is not available or not a repository
    commitCount = '0';
  }

  const count = parseInt(commitCount, 10) || 0;
  const major = Math.floor(count / 1000);
  const minor = Math.floor((count % 1000) / 100);
  const patch = count % 100;
  const appVersion = `${major}.${minor}.${patch}`;

  return {
    plugins: [react()],
    base: './', // Garante que index.html use caminhos relativos para JS e CSS
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
      '__APP_VERSION__': JSON.stringify(appVersion),
      '__COMMIT_COUNT__': JSON.stringify(count)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  };
});
