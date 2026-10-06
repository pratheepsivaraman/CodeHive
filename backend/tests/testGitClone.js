import axios from 'axios';

const API_URL = 'http://localhost:5000';

async function testGitCloneAndSync() {
  console.log('--- Testing Terminal Git Clone and Automatic Disk-to-Database Sync ---');

  // 1. Register test user
  const ts = Date.now();
  const regRes = await axios.post(`${API_URL}/api/auth/register`, {
    username: `git_user_${ts.toString().slice(-4)}`,
    email: `git_${ts}@test.com`,
    password: 'password123',
  });
  const token = regRes.data.token;
  console.log('✓ Registered test user:', regRes.data.username);

  // 2. Create project
  const projRes = await axios.post(
    `${API_URL}/api/projects`,
    { name: 'Git Clone Project', description: 'Testing git clone in terminal' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const projectId = projRes.data._id;
  console.log('✓ Created project:', projRes.data.name, '(', projectId, ')');

  // 3. Run git clone command in the terminal
  console.log('\nExecuting terminal command: "git clone --depth 1 https://github.com/octocat/Hello-World.git"...');
  const cloneRes = await axios.post(
    `${API_URL}/api/execute/command`,
    {
      projectId,
      command: 'git clone --depth 1 https://github.com/octocat/Hello-World.git',
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log('Terminal Response:');
  console.log('Success:', cloneRes.data.success);
  console.log('Exit Code:', cloneRes.data.exitCode);
  console.log('Stdout:', cloneRes.data.stdout);
  console.log('Stderr:', cloneRes.data.stderr);
  console.log('Files Updated:', cloneRes.data.filesUpdated);
  console.log('Imported Count:', cloneRes.data.importedCount);

  if (!cloneRes.data.success) {
    throw new Error('git clone command failed');
  }

  // 4. Verify that files are now present in MongoDB File collection
  console.log('\nFetching project files from API...');
  const filesRes = await axios.get(`${API_URL}/api/files/project/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`Total files/folders in project: ${filesRes.data.length}`);
  filesRes.data.forEach((f) => {
    console.log(` - ${f.isFolder ? '[FOLDER]' : '[FILE]'} ${f.path}/${f.name} (Lang: ${f.language})`);
  });

  const helloWorldFolder = filesRes.data.find((f) => f.name === 'Hello-World' && f.isFolder);
  const readmeFile = filesRes.data.find((f) => f.name.toLowerCase().includes('readme'));

  if (!helloWorldFolder) {
    throw new Error('Hello-World folder was not found in project files!');
  }
  if (!readmeFile) {
    throw new Error('README file was not found in cloned files!');
  }

  console.log('✓ Found Hello-World folder and README file in CodeHive database!');

  // 5. Test manual sync endpoint
  console.log('\nTesting manual /api/execute/sync endpoint...');
  const syncRes = await axios.post(
    `${API_URL}/api/execute/sync`,
    { projectId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  console.log('Sync count:', syncRes.data.count);
  if (!syncRes.data.success) {
    throw new Error('Sync endpoint failed');
  }

  console.log('\n=== ALL GIT CLONE & SYNC TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

testGitCloneAndSync().catch((err) => {
  console.error('Git clone test failed:', err.response?.data || err.message);
  process.exit(1);
});
