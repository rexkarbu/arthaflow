async function testRoutes() {
  const routes = ['/', '/transaksi', '/akun', '/analisis', '/budget', '/tujuan', '/pengaturan'];
  console.log('Testing HTTP routes on localhost:3000...\n');

  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route}`);
      console.log(`[ROUTE] ${route} -> Status: ${res.status} ${res.statusText}`);
      if (res.status !== 200) {
        console.error(`Route ${route} failed with status ${res.status}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`Route ${route} error:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n✓ ALL ROUTES RETURNED HTTP 200 OK!');
}

testRoutes();
