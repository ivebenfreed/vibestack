// Script to test starting the MCP server directly
const fs = require('fs');
const logStream = fs.createWriteStream('mcp-server-log.txt', {flags: 'w'});

function log(message) {
  console.log(message);
  logStream.write(message + '\n');
}

log('Testing MCP server initialization');

// Set the API key as environment variable
process.env.BRAVE_API_KEY = 'BSAGD6XgoC_bjpRkQM8YO3iCXrllWLd';

// Using dynamic import for ES modules
import('./node_modules/@modelcontextprotocol/server-brave-search/dist/index.js')
  .then(braveSearchServer => {
    log('MCP server imported successfully');
    log('Module exports: ' + JSON.stringify(Object.keys(braveSearchServer)));
    
    // Server should automatically start in stdio mode
    // Let's verify it's running by logging some details
    log('Server should now be running in stdio mode');
    log('If you see this message without errors, the server initialization looks good');
    
    // Keep process running to maintain the server
    log('Keeping process alive. Press Ctrl+C to terminate.');
  })
  .catch(error => {
    log('Error starting MCP server: ' + error);
    log('Error details: ' + error.stack);
    process.exit(1);
  });

// Add an unhandled rejection handler to catch any promise errors
process.on('unhandledRejection', (reason, promise) => {
  log('Unhandled Rejection at: ' + JSON.stringify(promise) + ' reason: ' + reason);
});

// Add an exit handler
process.on('exit', (code) => {
  log(`Process exiting with code: ${code}`);
  logStream.end();
});