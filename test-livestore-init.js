/**
 * Debug LiveStore initialization sequence
 */

console.log('🧪 Testing LiveStore initialization sequence...');

// Check auth state
console.log('\n🔐 Checking authentication state...');
const authState = JSON.parse(localStorage.getItem('vibestack-auth-state') || '{}');
const lastOrgId = localStorage.getItem('vibestack-last-organization-id');
console.log('Auth state:', authState);
console.log('Last org ID:', lastOrgId);

// Check if user and organization are available
const checkAuthAndOrg = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const currentOrg = JSON.parse(localStorage.getItem('currentOrganization') || 'null');
  
  console.log('User from localStorage:', user);
  console.log('Current org from localStorage:', currentOrg);
  
  // Also check the auth machine state
  const authActor = (window as any).authMachineActor;
  if (authActor) {
    const authSnapshot = authActor.getSnapshot();
    console.log('Auth machine state:', authSnapshot.value);
    console.log('Auth machine context:', {
      user: authSnapshot.context.user,
      currentOrganization: authSnapshot.context.currentOrganization,
      isAuthenticated: authSnapshot.context.isAuthenticated
    });
  } else {
    console.log('Auth machine actor not available');
  }
};

// Check app init machine state
const checkAppInitMachine = () => {
  const appInitActor = (window as any).appInitActor;
  if (appInitActor) {
    const snapshot = appInitActor.getSnapshot();
    console.log('App init machine state:', snapshot.value);
    console.log('App init machine context:', {
      isDatabaseInitialized: snapshot.context.isDatabaseInitialized,
      organizationId: snapshot.context.organizationId,
      isLiveStoreReady: snapshot.context.isLiveStoreReady,
      liveStoreError: snapshot.context.liveStoreError
    });
  } else {
    console.log('App init machine actor not available');
  }
};

// Listen for events
const setupEventListeners = () => {
  console.log('\n📡 Setting up event listeners...');
  
  const events = [
    'database:check',
    'database:ready', 
    'database:error',
    'livestore:ready',
    'livestore:error',
    'livestore:init'
  ];
  
  events.forEach(eventName => {
    window.addEventListener(eventName, (event) => {
      console.log(`🎉 Event received: ${eventName}`, event.detail || '(no detail)');
    });
  });
  
  console.log('Event listeners set up for:', events.join(', '));
};

// Trigger database check manually
const triggerDatabaseCheck = () => {
  console.log('\n🔄 Manually triggering database:check event...');
  window.dispatchEvent(new CustomEvent('database:check'));
};

// Check LiveStore instances
const checkLiveStoreInstances = () => {
  console.log('\n📊 Checking LiveStore instances...');
  
  const globalLiveStore = (window as any).globalLiveStore || (window as any).LiveStore;
  if (globalLiveStore) {
    console.log('✅ Global LiveStore found:', globalLiveStore);
  } else {
    console.log('❌ Global LiveStore not found');
  }
  
  // Check if schema client has instances
  const liveStoreSchemaClient = (window as any).liveStoreSchemaClient;
  if (liveStoreSchemaClient && typeof liveStoreSchemaClient.getAllInstances === 'function') {
    const instances = liveStoreSchemaClient.getAllInstances();
    console.log('LiveStore schema client instances:', instances);
  } else {
    console.log('LiveStore schema client not available or no getAllInstances method');
  }
};

// Main test function
const runLiveStoreInitTest = async () => {
  console.log('🚀 Starting LiveStore initialization test...\n');
  
  // Check current state
  checkAuthAndOrg();
  console.log('');
  checkAppInitMachine();
  console.log('');
  checkLiveStoreInstances();
  
  // Set up listeners
  setupEventListeners();
  
  // Trigger initialization
  triggerDatabaseCheck();
  
  // Wait and check again
  setTimeout(() => {
    console.log('\n📊 Checking state after 3 seconds...');
    checkLiveStoreInstances();
    checkAppInitMachine();
  }, 3000);
  
  console.log('\n🎯 LiveStore initialization test setup complete');
  console.log('Check console for event logs and state changes');
};

// Run the test
setTimeout(runLiveStoreInitTest, 1000);

// Make functions available in console
window.testLiveStoreInit = {
  checkAuth: checkAuthAndOrg,
  checkAppInit: checkAppInitMachine,
  checkLiveStore: checkLiveStoreInstances,
  triggerCheck: triggerDatabaseCheck,
  runTest: runLiveStoreInitTest
};