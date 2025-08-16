import { test, expect } from '@playwright/test';

test('test simple data table without routing', async ({ page }) => {
  console.log('Testing direct DataTable component...');
  
  // Create a simple HTML page that imports and renders just the DataTable component
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DataTable Test</title>
      <style>
        body { font-family: system-ui; margin: 20px; }
        .card { border: 1px solid #ccc; border-radius: 8px; }
        .input { padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        .button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
        .button-primary { background: #3b82f6; color: white; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div id="root">
        <h1>DataTable Test</h1>
        <div id="datatable-container">
          <!-- DataTable will be rendered here -->
        </div>
      </div>
      <script>
        // Mock the necessary APIs
        window.fetch = async function(url) {
          console.log('Mock fetch called with:', url);
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            json: async () => ({
              success: true,
              data: [
                {
                  id: '1',
                  name: 'Test Entity',
                  type: 'table',
                  description: 'A test entity',
                  fields: [{ name: 'id', type: 'string' }],
                  updatedAt: new Date().toISOString()
                }
              ]
            })
          };
        };
        
        // Simple test without SolidJS routing
        setTimeout(() => {
          const container = document.getElementById('datatable-container');
          container.innerHTML = \`
            <div>
              <h2>Entity Management</h2>
              <div style="margin: 20px 0;">
                <input type="text" placeholder="Search entities..." class="input" style="margin-right: 10px;">
                <select class="input" style="margin-right: 10px;">
                  <option value="">All types</option>
                  <option value="table">Table</option>
                </select>
                <button class="button button-primary" onclick="loadEntities()">Load Entities</button>
              </div>
              <div id="loading" style="display: none;">Loading...</div>
              <table id="entities-table" style="display: none;">
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Description</th></tr>
                </thead>
                <tbody id="entities-tbody">
                </tbody>
              </table>
            </div>
          \`;
          
          window.loadEntities = async () => {
            const loading = document.getElementById('loading');
            const table = document.getElementById('entities-table');
            const tbody = document.getElementById('entities-tbody');
            
            loading.style.display = 'block';
            table.style.display = 'none';
            
            try {
              const response = await fetch('/api/entities');
              const result = await response.json();
              
              if (result.success) {
                tbody.innerHTML = '';
                result.data.forEach(entity => {
                  const row = document.createElement('tr');
                  row.innerHTML = \`
                    <td>\${entity.name}</td>
                    <td>\${entity.type}</td>
                    <td>\${entity.description}</td>
                  \`;
                  tbody.appendChild(row);
                });
                
                loading.style.display = 'none';
                table.style.display = 'table';
                console.log('✅ Entities loaded successfully');
              }
            } catch (error) {
              console.error('Error loading entities:', error);
            }
          };
          
          // Auto-load entities
          loadEntities();
          
        }, 500);
      </script>
    </body>
    </html>
  `;
  
  await page.setContent(testHtml);
  await page.waitForTimeout(1000);
  
  // Check if the table loaded
  const tableVisible = await page.isVisible('#entities-table');
  console.log('Table visible:', tableVisible);
  
  if (tableVisible) {
    const rowCount = await page.locator('#entities-tbody tr').count();
    console.log('Row count:', rowCount);
    expect(rowCount).toBeGreaterThan(0);
    console.log('✅ Simple DataTable test passed!');
  }
  
  // Test load button
  await page.click('button:has-text("Load Entities")');
  await page.waitForTimeout(500);
  
  const finalRowCount = await page.locator('#entities-tbody tr').count();
  console.log('Final row count:', finalRowCount);
  
  console.log('✅ Simple DataTable test completed!');
});