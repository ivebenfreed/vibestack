// Script to test starting the MCP server directly
console.log('Testing MCP server initialization');

// Set the API key as environment variable
process.env.BRAVE_API_KEY = 'BSAGD6XgoC_bjpRkQM8YO3iCXrllWLd';

// Using dynamic import for ES modules
import('./node_modules/@modelcontextprotocol/server-brave-search/dist/index.js')
  .then(braveSearchServer => {
    console.log('MCP server imported successfully');
    console.log('Module exports:', Object.keys(braveSearchServer));
    
    // Server should automatically start in stdio mode
    // Let's verify it's running by logging some details
    console.log('Server should now be running in stdio mode');
    console.log('If you see this message without errors, the server initialization looks good');
    
    // Keep process running to maintain the server
    console.log('Keeping process alive. Press Ctrl+C to terminate.');
  })
  .catch(error => {
    console.error('Error starting MCP server:', error);
    console.error('Error details:', error.stack);
    process.exit(1);
  });

// Add an unhandled rejection handler to catch any promise errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});