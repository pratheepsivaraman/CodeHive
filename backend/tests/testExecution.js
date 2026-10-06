import axios from 'axios';

const API_URL = 'http://localhost:5000';

async function testExecutionFeatures() {
  console.log('--- Testing CodeHive Code Execution & Terminal Engine ---');

  // 1. Register test user
  const ts = Date.now();
  const regRes = await axios.post(`${API_URL}/api/auth/register`, {
    username: `runner_${ts.toString().slice(-4)}`,
    email: `runner_${ts}@test.com`,
    password: 'password123',
  });
  const token = regRes.data.token;
  console.log('✓ Registered user:', regRes.data.username);

  // 2. Create project
  const projRes = await axios.post(
    `${API_URL}/api/projects`,
    { name: 'Runner Project', description: 'Testing code execution' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const projectId = projRes.data._id;
  console.log('✓ Created project:', projRes.data.name, '(', projectId, ')');

  // 3. Test Running JavaScript Code
  console.log('Testing JS Code Execution...');
  const jsRes = await axios.post(
    `${API_URL}/api/execute/run`,
    {
      projectId,
      filename: 'index.js',
      language: 'javascript',
      code: `
function fibonacci(n) {
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    let c = a + b;
    a = b;
    b = c;
  }
  return n > 0 ? b : 0;
}
console.log("Fibonacci(10) =", fibonacci(10));
console.log("Hello from VS Code Runner in CodeHive!");
`,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log('JS Output:');
  console.log(jsRes.data.stdout);
  if (!jsRes.data.stdout.includes('Fibonacci(10) = 55')) {
    throw new Error('JS execution failed or output mismatched');
  }
  console.log(`✓ JS Execution successful! Exit code: ${jsRes.data.exitCode}, Duration: ${jsRes.data.executionTimeMs}ms`);

  // 4. Test Running Python Code
  console.log('\nTesting Python Code Execution...');
  const pyRes = await axios.post(
    `${API_URL}/api/execute/run`,
    {
      projectId,
      filename: 'main.py',
      language: 'python',
      code: `
squares = [x**2 for x in range(1, 6)]
print(f"Squares: {squares}")
print("Python runner working perfectly!")
`,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log('Python Output:');
  console.log(pyRes.data.stdout);
  if (!pyRes.data.stdout.includes('[1, 4, 9, 16, 25]')) {
    throw new Error('Python execution failed or output mismatched');
  }
  console.log(`✓ Python Execution successful! Exit code: ${pyRes.data.exitCode}, Duration: ${pyRes.data.executionTimeMs}ms`);

  // 5. Test Running Terminal Commands
  console.log('\nTesting Interactive Terminal Command...');
  const termRes = await axios.post(
    `${API_URL}/api/execute/command`,
    {
      projectId,
      command: 'node -v',
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log('Terminal command "node -v" output:', termRes.data.stdout.trim());
  if (!termRes.data.stdout.startsWith('v')) {
    throw new Error('Terminal command failed');
  }
  console.log('✓ Terminal command execution successful!');

  console.log('\n=== ALL CODE RUNNER & TERMINAL ENGINE TESTS PASSED! ===');
  process.exit(0);
}

testExecutionFeatures().catch((err) => {
  console.error('Test failed:', err.response?.data || err.message);
  process.exit(1);
});
