# Integrity Reset Test Plan

## 🎯 **Expected Behavior After Fix**

After running integrity reset, you should see:

### **1. Correct State Transitions**
```
✅ live_sync → resetting_integrity → initializing → connecting → initial_sync → live_sync
```

### **2. LSN Progression**  
```
✅ LSN: current → 0/0 → progressive updates → final server LSN
```

### **3. Database Rebuild**
```
✅ Tables cleared → Initial sync starts → Data progressively loaded → Full sync complete
```

---

## 🧪 **Test Steps**

### **Step 1: Open Debug Page**
1. Navigate to `/debug/integrity`
2. Verify current sync state shows "live_sync"
3. Note current LSN (should be something like `0/1B1E4690`)

### **Step 2: Execute State Machine Reset**
1. Click **"Full Reset (Smart)"** button (uses `debugResetProper`)
2. Watch console logs carefully

### **Step 3: Verify Correct Flow**
You should see logs like:
```
🚨 Entered resetting_integrity state
🔄 Integrity reset completed! Database cleared, starting fresh with initial sync
📍 LSN Update: 0/1B1E4690 → 0/0                    // ✅ Sync machine tells orchestrator!
🔄 Reset completed - restarting sync (LSN updated by sync machine)
🚀 Starting sync with LSN: 0/0                     // ✅ Orchestrator uses fresh LSN!
➡️ ENTERING state: initializing  
➡️ ENTERING state: connecting
➡️ ENTERING state: initial_sync
📊 Sync phase: Initial sync started
📥 Processing initial sync changes...
[Tables being rebuilt progressively]
✅ Initial sync completed!  
➡️ ENTERING state: live_sync
```

### **Step 4: Verify LSN Progression**
- **Start**: LSN should reset to `0/0`
- **During**: LSN should increment progressively (`0/100`, `0/200`, etc.)
- **End**: LSN should reach final server position

### **Step 5: Verify Data Rebuild**
1. Check your app's main tables (users, projects, tasks)
2. All data should be repopulated from server
3. Counts should match server data

---

## ❌ **Previous Broken Behavior**

If you still see the old broken behavior:
```
❌ "Reset completed - sync machine back in live_sync state" (INSTANT!)
❌ LSN stays at high value like 0/1B1E4690 (WRONG!)  
❌ No "Starting sync with LSN: 0/0" log (WRONG!)
❌ No initial sync progression (WRONG!)
❌ No data rebuild process (WRONG!)
```

This means the fixes didn't take effect - try refreshing the page and clearing localStorage.

---

## 🎉 **Success Criteria**

✅ **State Machine**: Passes through `initializing → connecting → initial_sync` states
✅ **LSN**: Progressive increment from `0/0` to final
✅ **Database**: Complete rebuild of all domain tables  
✅ **Logs**: Clear initial sync progression messages
✅ **Timing**: Takes several seconds for full rebuild (not instant)

---

## 🐛 **If Issues Persist**

1. **Hard refresh** the page (Ctrl+F5)
2. **Clear localStorage** if needed
3. **Check console** for any compilation errors
4. **Verify** the state machine file was updated correctly 